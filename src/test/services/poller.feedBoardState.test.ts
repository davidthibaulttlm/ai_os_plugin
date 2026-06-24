import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProjectItemNode, FieldValue } from '../../services/graphql';
import type { AgentService } from '../../services/agent';
import { PollerService } from '../../services/poller';

// --- Helper to build a minimal ProjectItemNode ---
function createItem(options: {
  id?: string;
  databaseId?: number | null;
  status?: string | null;
  title?: string;
  labels?: string[];
}): ProjectItemNode {
  const id = options.id ?? 'test-node-id';
  const databaseId = options.databaseId ?? null;
  const title = options.title ?? 'Test Issue';
  const status = options.status;
  const labels = options.labels ?? [];

  const fieldValuesNodes: FieldValue[] = [];

  if (status !== null && status !== undefined) {
    fieldValuesNodes.push({
      name: status,
      field: { name: 'Status', id: 'status-field-id' },
    });
  }

  return {
    id,
    databaseId,
    type: 'ISSUE',
    fieldValues: { nodes: fieldValuesNodes },
    content: {
      id,
      number: databaseId ?? 0,
      title,
      url: 'https://github.com/test/repo/issues/1',
      state: 'open',
      repository: { id: 'repo-id', name: 'repo', owner: { login: 'owner' } },
      labels: { nodes: labels.map((name) => ({ name, color: 'ffffff' })) },
      assignees: { nodes: [] },
    },
  };
}

describe('PollerService.feedBoardState conditional', () => {
  let mockSetBoardState: ReturnType<typeof vi.fn>;
  let mockAgentService: Partial<AgentService>;
  let mockCallback: ReturnType<typeof vi.fn>;
  let mockGraphql: any;
  let poller: PollerService;

  beforeEach(() => {
    mockSetBoardState = vi.fn();
    mockAgentService = { setBoardState: mockSetBoardState };
    mockCallback = vi.fn();
    mockGraphql = { getProjectItems: vi.fn() };
    poller = new PollerService();
    poller.setAgentService(mockAgentService as AgentService);
  });

  afterEach(() => {
    poller.stop();
  });

  it('calls setBoardState when deltas are detected (first poll with new items)', async () => {
    const items = [createItem({ databaseId: 1, status: 'AI_SPEC', title: 'New Issue' })];
    mockGraphql.getProjectItems.mockResolvedValue(items);

    poller.start(mockGraphql, 'project-123', mockCallback);

    // Wait for initial poll to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // First poll: lastState is empty, so all items are "new" -> deltas detected
    // setBoardState should be called
    expect(mockSetBoardState).toHaveBeenCalledTimes(1);
    expect(mockSetBoardState).toHaveBeenCalledWith([
      { id: 1, projectItemId: 'test-node-id', title: 'New Issue', status: 'AI_SPEC', labels: [], assignees: [], body: undefined, owner: 'owner', repo: 'repo' },
    ]);

    // Callback should also be notified
    expect(mockCallback).toHaveBeenCalled();
  });

  it('does NOT call setBoardState when no deltas detected (unchanged board)', async () => {
    const items = [createItem({ databaseId: 1, status: 'AI_SPEC', title: 'Same Issue' })];
    mockGraphql.getProjectItems.mockResolvedValue(items);

    poller.start(mockGraphql, 'project-123', mockCallback);

    // Wait for first poll
    await new Promise((resolve) => setTimeout(resolve, 50));

    // First poll will detect deltas (new items from empty state)
    expect(mockSetBoardState).toHaveBeenCalledTimes(1);

    // Reset mock to track second poll
    mockSetBoardState.mockClear();
    mockCallback.mockClear();

    // Second poll: same items, no deltas
    // The interval is 30s, so we manually trigger by checking the internal state
    // Instead, verify that when getProjectItems returns the same data,
    // detectDeltas returns empty and setBoardState is NOT called.
    // Since we can't easily trigger a second poll without waiting 30s,
    // we verify the logic by confirming the first poll behavior above
    // and that the callback was NOT called on the second read.
    // For a direct test, we'll use a shorter approach:
    // Stop and restart with the same state already loaded.
    poller.stop();

    // Create a new poller that already has state
    const poller2 = new PollerService();
    poller2.setAgentService(mockAgentService as AgentService);

    // Pre-populate state by doing one poll
    mockGraphql.getProjectItems.mockResolvedValue(items);
    poller2.start(mockGraphql, 'project-123', mockCallback);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Reset after first poll
    mockSetBoardState.mockClear();
    mockCallback.mockClear();

    // Now start a third poller that inherits the same items (no change)
    poller2.stop();
    const poller3 = new PollerService();
    poller3.setAgentService(mockAgentService as AgentService);
    // Copy state from poller2
    (poller3 as any).lastState = (poller2 as any).lastState;

    mockGraphql.getProjectItems.mockResolvedValue(items);
    poller3.start(mockGraphql, 'project-123', mockCallback);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // No deltas — setBoardState should NOT be called
    expect(mockSetBoardState).not.toHaveBeenCalled();
    expect(mockCallback).not.toHaveBeenCalled();
    poller3.stop();
  });

  it('calls setBoardState when items change between polls', async () => {
    const itemsV1 = [createItem({ databaseId: 1, status: 'AI_SPEC', title: 'Issue' })];
    const itemsV2 = [createItem({ databaseId: 1, status: 'AI_CODE', title: 'Issue' })];

    mockGraphql.getProjectItems.mockResolvedValue(itemsV1);

    poller.start(mockGraphql, 'project-123', mockCallback);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // First poll: new item detected
    expect(mockSetBoardState).toHaveBeenCalledTimes(1);
    mockSetBoardState.mockClear();

    // Stop and create new poller with the same state
    poller.stop();
    const poller2 = new PollerService();
    poller2.setAgentService(mockAgentService as AgentService);
    (poller2 as any).lastState = (poller as any).lastState;

    // Now return changed items
    mockGraphql.getProjectItems.mockResolvedValue(itemsV2);
    poller2.start(mockGraphql, 'project-123', mockCallback);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Status changed from AI_SPEC to AI_CODE — delta detected
    expect(mockSetBoardState).toHaveBeenCalledTimes(1);
    expect(mockSetBoardState).toHaveBeenCalledWith([
      { id: 1, projectItemId: 'test-node-id', title: 'Issue', status: 'AI_CODE', labels: [], assignees: [], body: undefined, owner: 'owner', repo: 'repo' },
    ]);
    poller2.stop();
  });

  it('does not call setBoardState when agentService is not set', async () => {
    const items = [createItem({ databaseId: 1, status: 'AI_SPEC', title: 'New Issue' })];
    mockGraphql.getProjectItems.mockResolvedValue(items);

    // Create poller WITHOUT setting agent service
    const pollerNoAgent = new PollerService();
    pollerNoAgent.start(mockGraphql, 'project-123', mockCallback);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // No crash, and no setBoardState call
    expect(mockSetBoardState).not.toHaveBeenCalled();
    pollerNoAgent.stop();
  });
});

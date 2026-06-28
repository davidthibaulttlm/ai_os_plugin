import { describe, it, expect } from 'vitest';
import { detectDeltas } from '../../services/delta';
import type { ProjectItemNode, FieldValue } from '../../services/graphql';

// --- Helper to build a minimal ProjectItemNode with assignees ---
function createItem(options: {
  id?: string;
  databaseId?: number | null;
  status?: string | null;
  title?: string;
  labels?: string[];
  assignees?: { login: string; avatarUrl: string }[];
}): ProjectItemNode {
  const id = options.id ?? 'test-node-id';
  const databaseId = options.databaseId ?? null;
  const title = options.title ?? 'Test Issue';
  const status = options.status;
  const labels = options.labels ?? [];
  const assignees = options.assignees ?? [];

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
      assignees: { nodes: assignees },
    },
  };
}

describe('detectDeltas - item_assigned', () => {
  it('detects when assignee is added', () => {
    const lastState = new Map<string, { githubId: string; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set('1', {
      githubId: "1",
      status: 'AI_SPEC',
      title: 'Test Issue',
      labels: [],
      assignees: [{ login: 'alice' }],
    });

    const item = createItem({
      databaseId: 1,
      status: 'AI_SPEC',
      title: 'Test Issue',
      assignees: [
        { login: 'alice', avatarUrl: 'https://example.com/alice.png' },
        { login: 'bob', avatarUrl: 'https://example.com/bob.png' },
      ],
    });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('item_assigned');
    expect(events[0].issueId).toBe(1);
    expect(events[0].data).toHaveProperty('assignees');
  });

  it('detects when assignee is removed', () => {
    const lastState = new Map<string, { githubId: string; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set('1', {
      githubId: "1",
      status: 'AI_SPEC',
      title: 'Test Issue',
      labels: [],
      assignees: [{ login: 'alice' }, { login: 'bob' }],
    });

    const item = createItem({
      databaseId: 1,
      status: 'AI_SPEC',
      title: 'Test Issue',
      assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
    });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('item_assigned');
    expect(events[0].issueId).toBe(1);
  });

  it('does not emit event when assignees unchanged', () => {
    const lastState = new Map<string, { githubId: string; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set('1', {
      githubId: "1",
      status: 'AI_SPEC',
      title: 'Test Issue',
      labels: [],
      assignees: [{ login: 'alice' }],
    });

    const item = createItem({
      databaseId: 1,
      status: 'AI_SPEC',
      title: 'Test Issue',
      assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
    });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(0);
  });

  it('emits both item_assigned and item_updated when assignees and labels change', () => {
    const lastState = new Map<string, { githubId: string; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set('1', {
      githubId: "1",
      status: 'AI_SPEC',
      title: 'Test Issue',
      labels: ['bug'],
      assignees: [{ login: 'alice' }],
    });

    const item = createItem({
      databaseId: 1,
      status: 'AI_SPEC',
      title: 'Test Issue',
      labels: ['bug', 'priority'],
      assignees: [
        { login: 'alice', avatarUrl: 'https://example.com/alice.png' },
        { login: 'bob', avatarUrl: 'https://example.com/bob.png' },
      ],
    });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.type)).toContain('item_assigned');
    expect(events.map((e) => e.type)).toContain('item_updated');
  });

  it('emits both item_moved and item_assigned when status and assignees change', () => {
    const lastState = new Map<string, { githubId: string; status: string; title: string; labels: string[]; assignees: { login: string }[] }>();
    lastState.set('1', {
      githubId: "1",
      status: 'AI_SPEC',
      title: 'Test Issue',
      labels: [],
      assignees: [{ login: 'alice' }],
    });

    const item = createItem({
      databaseId: 1,
      status: 'AI_CODE',
      title: 'Test Issue',
      assignees: [
        { login: 'alice', avatarUrl: 'https://example.com/alice.png' },
        { login: 'bob', avatarUrl: 'https://example.com/bob.png' },
      ],
    });
    const events = detectDeltas(lastState, [item]);

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.type)).toContain('item_moved');
    expect(events.map((e) => e.type)).toContain('item_assigned');
  });
});

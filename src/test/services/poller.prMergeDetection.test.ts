import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PollerService } from '../../services/poller';
import { RepoManager } from '../../services/repoManager';
import type { ProjectItemNode } from '../../services/graphql';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('PollerService PR merge detection', () => {
  let poller: PollerService;
  let mockRepoManager: Partial<RepoManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoManager = {
      cleanupWorktree: vi.fn().mockResolvedValue({ success: true }),
      getReposDir: vi.fn().mockReturnValue('/tmp/repos'),
    };
    poller = new PollerService();
    poller.setRepoManager(mockRepoManager as RepoManager);
  });

  it('exposes last items via getItems', () => {
    const items = [{ id: '1', databaseId: 1, content: { title: 'Test' } }] as unknown as ProjectItemNode[];
    (poller as any).lastItems = items;
    expect(poller.getItems()).toEqual(items);
  });

  it('getItems returns empty when no items stored', () => {
    expect(poller.getItems()).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';
import type { ProjectItemNode } from '../../services/graphql';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

function createItem(options: {
  id?: string;
  projectItemId?: string;
  title?: string;
  status?: string;
  owner?: string;
  repo?: string;
  body?: string;
}) {
  return {
    id: options.id ?? '1',
    projectItemId: options.projectItemId ?? 'PVTI_test',
    title: options.title ?? 'Test Issue',
    status: options.status ?? 'AI_SPEC',
    content: {
      __typename: 'Issue',
      number: 1,
      title: options.title ?? 'Test Issue',
      body: options.body ?? '',
      repository: options.owner && options.repo
        ? { owner: { login: options.owner }, name: options.repo }
        : undefined,
    },
  } as unknown as ProjectItemNode;
}

describe('RepoManager.extractReposFromItems', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/repos', 'token123');
  });

  it('returns empty array when no items', () => {
    const result = mgr.extractReposFromItems([]);
    expect(result).toEqual([]);
  });

  it('extracts unique repos from items', () => {
    const items = [
      createItem({ owner: 'owner1', repo: 'repo1' }),
      createItem({ owner: 'owner2', repo: 'repo2' }),
    ];
    const result = mgr.extractReposFromItems(items);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ owner: 'owner1', repo: 'repo1' });
    expect(result).toContainEqual({ owner: 'owner2', repo: 'repo2' });
  });

  it('deduplicates same owner/repo', () => {
    const items = [
      createItem({ owner: 'owner1', repo: 'repo1' }),
      createItem({ owner: 'owner1', repo: 'repo1' }),
      createItem({ owner: 'owner1', repo: 'repo1' }),
    ];
    const result = mgr.extractReposFromItems(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ owner: 'owner1', repo: 'repo1' });
  });

  it('skips items without repository', () => {
    const items = [
      createItem({ owner: 'owner1', repo: 'repo1' }),
      createItem({}),
      createItem({ owner: 'owner2', repo: 'repo2' }),
    ];
    const result = mgr.extractReposFromItems(items);
    expect(result).toHaveLength(2);
  });

  it('skips items with missing owner or repo', () => {
    const items = [
      createItem({ owner: 'owner1', repo: 'repo1' }),
      createItem({ owner: 'owner2' }),
      createItem({ repo: 'repo3' }),
    ];
    const result = mgr.extractReposFromItems(items);
    expect(result).toHaveLength(1);
  });
});

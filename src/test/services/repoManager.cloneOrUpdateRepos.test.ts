import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  mkdtempSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  rmdirSync: vi.fn(),
  rmSync: vi.fn(),
}));

describe('RepoManager.cloneOrUpdateRepos', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/test-repos', 'token123');
  });

  it('handles empty repo list', async () => {
    const results = await mgr.cloneOrUpdateRepos([]);
    expect(results).toEqual([]);
  });

  it('returns array of results matching input count', async () => {
    const repos = [
      { owner: 'owner1', repo: 'repo1' },
      { owner: 'owner2', repo: 'repo2' },
    ];
    const results = await mgr.cloneOrUpdateRepos(repos);
    expect(results).toHaveLength(2);
  });
});

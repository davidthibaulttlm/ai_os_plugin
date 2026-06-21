import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('RepoManager.getRepoPath', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/repos', 'token123');
  });

  it('returns correct path for owner/repo', () => {
    const result = mgr.getRepoPath('myowner', 'myrepo');
    expect(result).toBe('/tmp/repos/myowner/myrepo');
  });

  it('handles nested owner names', () => {
    const result = mgr.getRepoPath('org-team', 'project-repo');
    expect(result).toBe('/tmp/repos/org-team/project-repo');
  });

  it('uses resolved reposDir', () => {
    const result = mgr.getRepoPath('owner', 'repo');
    expect(result).toContain('/tmp/repos');
  });
});

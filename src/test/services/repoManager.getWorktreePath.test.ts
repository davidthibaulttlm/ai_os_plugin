import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('RepoManager.getWorktreePath', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/repos', 'token123');
  });

  it('returns correct worktree path', () => {
    const result = mgr.getWorktreePath('owner', 'repo', 42, 'Fix bug');
    expect(result).toBe('/tmp/repos/owner/repo/.worktrees/42-fix-bug');
  });

  it('slugifies title in path', () => {
    const result = mgr.getWorktreePath('owner', 'repo', 1, 'Add!!! Feature');
    expect(result).toBe('/tmp/repos/owner/repo/.worktrees/1-add-feature');
  });

  it('includes .worktrees directory', () => {
    const result = mgr.getWorktreePath('o', 'r', 99, 'Test');
    expect(result).toContain('.worktrees');
  });

  it('uses repo path from getRepoPath', () => {
    const result = mgr.getWorktreePath('myowner', 'myrepo', 7, 'Issue');
    expect(result).toContain('myowner/myrepo');
  });
});

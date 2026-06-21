import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('RepoManager.getBranchName', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/repos', 'token123');
  });

  it('generates correct branch name format', () => {
    const result = mgr.getBranchName('myrepo', 42, 'Fix login bug');
    expect(result).toBe('ai-os/myrepo/42-fix-login-bug');
  });

  it('slugifies title with special characters', () => {
    const result = mgr.getBranchName('repo', 1, 'Fix!!! The @Login# Bug?');
    expect(result).toBe('ai-os/repo/1-fix-the-login-bug');
  });

  it('handles title with multiple spaces', () => {
    const result = mgr.getBranchName('repo', 2, 'Add    spacing   test');
    expect(result).toBe('ai-os/repo/2-add-spacing-test');
  });

  it('removes leading and trailing dashes from slug', () => {
    const result = mgr.getBranchName('repo', 3, '---Edge Case---');
    expect(result).toBe('ai-os/repo/3-edge-case');
  });

  it('handles empty slug after sanitization', () => {
    const result = mgr.getBranchName('repo', 5, '!!!@@@###');
    expect(result).toBe('ai-os/repo/5-');
  });

  it('converts to lowercase', () => {
    const result = mgr.getBranchName('Repo', 10, 'UPPERCASE Title');
    expect(result).toBe('ai-os/Repo/10-uppercase-title');
  });
});

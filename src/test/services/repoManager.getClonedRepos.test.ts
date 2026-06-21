import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

vi.mock('fs');

describe('RepoManager.getClonedRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when reposDir does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const mgr = new RepoManager('/tmp/nonexistent', 'token123');
    const result = mgr.getClonedRepos();
    expect(result).toEqual([]);
  });

  it('returns cloned repos with .git directories', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const path = p as string;
      // .git exists for owner1/repo1
      if (path.includes('.git')) return true;
      // owner dirs exist
      return true;
    });
    vi.mocked(fs.readdirSync).mockImplementation((p: unknown) => {
      const dirPath = p as string;
      if (dirPath.endsWith('/owner1')) {
        return [{ name: 'repo1', isDirectory: () => true } as any];
      }
      if (dirPath.endsWith('/owner1/repo1')) {
        return [] as any;
      }
      return [{ name: 'owner1', isDirectory: () => true } as any];
    });

    const mgr = new RepoManager('/tmp/repos', 'token123');
    const result = mgr.getClonedRepos();
    expect(result).toEqual([{ owner: 'owner1', repo: 'repo1' }]);
  });

  it('skips repos without .git directory', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const path = p as string;
      // .git does NOT exist
      if (path.includes('.git')) return false;
      return true;
    });
    vi.mocked(fs.readdirSync).mockImplementation((p: unknown) => {
      const dirPath = p as string;
      if (dirPath.endsWith('/owner1')) {
        return [{ name: 'repo1', isDirectory: () => true } as any];
      }
      if (dirPath.endsWith('/owner1/repo1')) {
        return [] as any;
      }
      return [{ name: 'owner1', isDirectory: () => true } as any];
    });

    const mgr = new RepoManager('/tmp/repos', 'token123');
    const result = mgr.getClonedRepos();
    expect(result).toEqual([]);
  });
});

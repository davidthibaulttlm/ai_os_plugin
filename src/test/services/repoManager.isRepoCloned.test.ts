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
}));

import * as fs from 'fs';

describe('RepoManager.isRepoCloned', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/test-repos', 'token123');
  });

  it('returns false when .git does not exist', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(mgr.isRepoCloned('owner', 'repo')).toBe(false);
  });

  it('returns true when .git exists', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(mgr.isRepoCloned('owner', 'repo')).toBe(true);
  });

  it('checks correct path for .git directory', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      expect(path).toContain('/tmp/test-repos/owner/repo/.git');
      return false;
    });
    mgr.isRepoCloned('owner', 'repo');
  });
});

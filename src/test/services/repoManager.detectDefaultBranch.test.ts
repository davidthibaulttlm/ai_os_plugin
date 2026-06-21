import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';
import { runGit } from '../../services/repoManager.git';

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

vi.mock('../../services/repoManager.git', () => ({
  runGit: vi.fn(),
  handleGitResult: vi.fn(),
}));

describe('RepoManager.detectDefaultBranch', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/test-repos', 'token123');
  });

  it('extracts branch name from symref output with tabs and newlines', async () => {
    vi.mocked(runGit).mockResolvedValue({
      stdout: 'ref: refs/heads/main\tHEAD\n6aadf5349653089ef722925eca1b8ad2cac61161\tHEAD',
      stderr: '',
      code: 0,
    });

    const branch = await mgr.detectDefaultBranch('owner', 'repo');
    expect(branch).toBe('main');
  });

  it('extracts non-main branch name correctly', async () => {
    vi.mocked(runGit).mockResolvedValue({
      stdout: 'ref: refs/heads/develop\tHEAD\nabc123\tHEAD',
      stderr: '',
      code: 0,
    });

    const branch = await mgr.detectDefaultBranch('owner', 'repo');
    expect(branch).toBe('develop');
  });

  it('falls back to main when symref not found', async () => {
    vi.mocked(runGit).mockResolvedValue({
      stdout: 'abc123\tHEAD',
      stderr: '',
      code: 0,
    });

    const branch = await mgr.detectDefaultBranch('owner', 'repo');
    expect(branch).toBe('main');
  });

  it('handles branch names with hyphens', async () => {
    vi.mocked(runGit).mockResolvedValue({
      stdout: 'ref: refs/heads/main-feature\tHEAD\nabc123\tHEAD',
      stderr: '',
      code: 0,
    });

    const branch = await mgr.detectDefaultBranch('owner', 'repo');
    expect(branch).toBe('main-feature');
  });
});

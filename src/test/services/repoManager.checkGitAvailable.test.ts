import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';

describe('RepoManager.checkGitAvailableAsync', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/repos', 'token123');
  });

  it('returns true when git exits with code 0', async () => {
    const mockChild = {
      on: vi.fn((event, cb) => {
        if (event === 'exit') cb(0);
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    };
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);

    const result = await mgr.checkGitAvailableAsync();
    expect(result).toBe(true);
  });

  it('returns false when spawn errors', async () => {
    const mockChild = {
      on: vi.fn((event, cb) => {
        if (event === 'error') cb(new Error('ENOENT'));
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    };
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);

    const result = await mgr.checkGitAvailableAsync();
    expect(result).toBe(false);
  });
});

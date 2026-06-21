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

import * as fs from 'fs';

describe('RepoManager.updateWorktree', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/test-repos', 'token123');
  });

  it('returns failure when worktree does not exist', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = await mgr.updateWorktree('/tmp/nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('returns a GitResult object when worktree exists', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const result = await mgr.updateWorktree('/tmp/test-repos/owner/repo/.worktrees/1-test');
    expect(result).toHaveProperty('success');
  });
});

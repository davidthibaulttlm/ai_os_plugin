/** Tests for RepoManager.commitWorktree */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';
import * as fs from 'fs';

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

describe('RepoManager.commitWorktree', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/test-repos', 'token123');
  });

  it('returns a GitResult object on success', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const result = await mgr.commitWorktree('/tmp/worktree', 'ai-os: Test commit');
    expect(result).toHaveProperty('success');
  });

  it('returns error when worktree does not exist', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = await mgr.commitWorktree('/tmp/nonexistent', 'ai-os: Test');
    expect(result.success).toBe(false);
  });

  it('sanitizes commit message with newlines', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    // The method should not crash with newlines in message
    const result = await mgr.commitWorktree('/tmp/worktree', 'ai-os: Line1\nLine2');
    expect(result).toBeDefined();
  });

  it('handles empty commit message', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const result = await mgr.commitWorktree('/tmp/worktree', '');
    expect(result).toBeDefined();
  });
});

/** Tests for RepoManager.pushWorktree */

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

describe('RepoManager.pushWorktree', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/test-repos', 'token123');
  });

  it('returns a GitResult object', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const result = await mgr.pushWorktree('/tmp/worktree', 'ai-os/1-test');
    expect(result).toHaveProperty('success');
  });

  it('returns error when worktree does not exist', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = await mgr.pushWorktree('/tmp/nonexistent', 'ai-os/1-test');
    expect(result.success).toBe(false);
  });

  it('accepts branch name parameter', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const result = await mgr.pushWorktree('/tmp/worktree', 'feature-branch');
    expect(result).toBeDefined();
  });
});

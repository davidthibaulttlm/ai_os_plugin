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

describe('RepoManager.createWorktree', () => {
  let mgr: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new RepoManager('/tmp/test-repos', 'token123');
  });

  it('returns existing worktree path when it exists', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      return path.includes('.worktrees/42-fix-bug');
    });

    const result = await mgr.createWorktree('owner', 'repo', 42, 'Fix bug');
    expect(result.success).toBe(true);
    expect(result.path).toContain('.worktrees/42-fix-bug');
  });

  it('returns a WorktreeResult object', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = await mgr.createWorktree('owner', 'repo', 42, 'Fix bug');
    expect(result).toHaveProperty('success');
  });
});

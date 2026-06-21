/** Tests for RepoManager.hasStagedChanges */

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

describe('RepoManager.hasStagedChanges', () => {
  let manager: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new RepoManager('/tmp/repos', 'test-token');
  });

  it('returns a boolean result', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const result = await manager.hasStagedChanges('/tmp/worktree');
    expect(typeof result).toBe('boolean');
  });

  it('handles non-existent worktree path', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = await manager.hasStagedChanges('/tmp/nonexistent');
    expect(result).toBe(false);
  });
});

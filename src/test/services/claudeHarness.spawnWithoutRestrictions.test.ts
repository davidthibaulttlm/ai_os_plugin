/** Tests for ClaudeHarness — spawns without --max-turns or --allowed-tools */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { ClaudeHarness } from '../../services/claudeHarness';
import { ColumnPromptService } from '../../services/columnPrompt';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'exit') cb();
    }),
    kill: vi.fn(),
  })),
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
    }),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../services/claudeHarness.pipeline', () => ({
  runPostRunPipeline: vi.fn().mockResolvedValue({
    success: true,
    issueNumber: 42,
    reason: 'COMPLETED',
  }),
}));

describe('ClaudeHarness — spawn without restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not read maxTurns or allowedTools from config', async () => {
    const mockRepoManager = {
      createWorktree: vi.fn().mockResolvedValue({
        success: true,
        path: '/tmp/worktree/test-42',
      }),
      updateWorktree: vi.fn().mockResolvedValue({ success: true }),
    } as any;
    const mockGraphql = {} as any;
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));
    await harness.run({
      issueNumber: 42,
      owner: 'test',
      repo: 'test',
      title: 'Test',
      column: 'AI_SPEC',
    });
    // The run method should complete without reading maxTurns/allowedTools
    const sessions = harness.getActiveSessions();
    expect(sessions.size).toBe(0);
  });

  it('should spawn claude without --max-turns flag', async () => {
    const mockRepoManager = {
      createWorktree: vi.fn().mockResolvedValue({
        success: true,
        path: '/tmp/worktree/test-42',
      }),
      updateWorktree: vi.fn().mockResolvedValue({ success: true }),
    } as any;
    const mockGraphql = {} as any;
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));
    await harness.run({
      issueNumber: 42,
      owner: 'test',
      repo: 'test',
      title: 'Test',
      column: 'AI_SPEC',
    });
    const args = vi.mocked(spawn).mock.calls[0][1];
    expect(args).not.toContain('--max-turns');
  });

  it('should spawn claude without --allowed-tools flag', async () => {
    const mockRepoManager = {
      createWorktree: vi.fn().mockResolvedValue({
        success: true,
        path: '/tmp/worktree/test-42',
      }),
      updateWorktree: vi.fn().mockResolvedValue({ success: true }),
    } as any;
    const mockGraphql = {} as any;
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));
    await harness.run({
      issueNumber: 42,
      owner: 'test',
      repo: 'test',
      title: 'Test',
      column: 'AI_SPEC',
    });
    const args = vi.mocked(spawn).mock.calls[0][1];
    expect(args).not.toContain('--allowed-tools');
  });
});

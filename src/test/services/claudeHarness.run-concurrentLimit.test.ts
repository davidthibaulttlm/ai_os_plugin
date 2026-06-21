/** Tests for ClaudeHarness.run — concurrent agent limit enforcement */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import type { RepoManager } from '../../services/repoManager';
import type { GraphQLClient } from '../../services/graphql';
import { ColumnPromptService } from '../../services/columnPrompt';
import type { AgentSession } from '../../services/claudeHarness';

vi.mock('child_process', () => ({
  spawn: vi.fn(function () {
    return {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((_event: string, cb: (code?: number) => void) => {
        if (_event === 'exit') setImmediate(() => cb(0));
      }),
      kill: vi.fn(),
    };
  }),
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
    }),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('ClaudeHarness.run — concurrent limit', () => {
  let mockRepoManager: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoManager = {
      createWorktree: vi.fn().mockResolvedValue({
        success: true,
        path: '/tmp/repos/test-repo/worktrees/1-test',
      }),
      updateWorktree: vi.fn().mockResolvedValue({ success: true }),
      getBranchName: vi.fn().mockReturnValue('ai-os/1-test'),
      hasStagedChanges: vi.fn().mockResolvedValue(false),
    } as unknown as RepoManager;
  });

  it('should reject when concurrent limit reached', async () => {
    // maxConcurrentAgents defaults to 3 from fallback
    const harness = new ClaudeHarness(mockRepoManager, {} as GraphQLClient, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));

    // Fill sessions to max (3)
    for (let i = 1; i <= 3; i++) {
      const fakeSession: AgentSession = {
        key: `test-owner:test-repo:${i}`,
        issueNumber: i,
        owner: 'test-owner',
        repo: 'test-repo',
        worktreePath: `/tmp/repos/test-repo/worktrees/${i}-test`,
        process: { kill: vi.fn() } as any,
        status: 'running',
        outputBuffer: [],
      outputBufferLength: 0,
        startTime: Date.now(),
      };
      (harness as any).sessions.set(`test-owner:test-repo:${i}`, fakeSession);
    }

    // Fourth run should be rejected
    const result = await harness.run({
      issueNumber: 4,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue 4',
      column: 'AI_SPEC',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('CONCURRENT_LIMIT_REACHED');
  });

  it('should allow run when under concurrent limit', async () => {
    const harness = new ClaudeHarness(mockRepoManager, {} as GraphQLClient, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));

    // Only 1 session active, limit is 3
    const fakeSession: AgentSession = {
      key: 'test-owner:test-repo:1',
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      worktreePath: '/tmp/repos/test-repo/worktrees/1-test',
      process: { kill: vi.fn() } as any,
      status: 'running',
      outputBuffer: [],
      outputBufferLength: 0,
      startTime: Date.now(),
    };
    (harness as any).sessions.set('test-owner:test-repo:1', fakeSession);

    const result = await harness.run({
      issueNumber: 2,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue 2',
      column: 'AI_SPEC',
    });

    // Should proceed past limit check
    expect(result.reason).not.toBe('CONCURRENT_LIMIT_REACHED');
  });

  it('should allow run when no sessions active', async () => {
    const harness = new ClaudeHarness(mockRepoManager, {} as GraphQLClient, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));

    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    // No sessions, should proceed
    expect(result.reason).not.toBe('CONCURRENT_LIMIT_REACHED');
  });
});

/** Tests for ClaudeHarness.run — duplicate spawn prevention */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import type { RepoManager } from '../../services/repoManager';
import { ColumnPromptService } from '../../services/columnPrompt';
import type { GraphQLClient } from '../../services/graphql';
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

describe('ClaudeHarness.run — duplicate spawn prevention', () => {
  let harness: ClaudeHarness;
  let mockRepoManager: RepoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoManager = {
      isRepoCloned: vi.fn().mockReturnValue(true),
      cloneOrUpdateRepos: vi.fn().mockResolvedValue([{ success: true }]),
      createWorktree: vi.fn().mockResolvedValue({
        success: true,
        path: '/tmp/repos/test-repo/worktrees/1-test',
      }),
      updateWorktree: vi.fn().mockResolvedValue({ success: true }),
      getBranchName: vi.fn().mockReturnValue('ai-os/1-test'),
      hasStagedChanges: vi.fn().mockResolvedValue(false),
    } as unknown as RepoManager;
    harness = new ClaudeHarness(mockRepoManager, {} as GraphQLClient, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));
  });

  it('should return ALREADY_RUNNING when session exists for same issue', async () => {
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
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('ALREADY_RUNNING');
  });

  it('should not call createWorktree when duplicate detected', async () => {
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

    await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(mockRepoManager.createWorktree).not.toHaveBeenCalled();
  });

  it('should allow different issues to run concurrently', async () => {
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

    expect(result.reason).not.toBe('ALREADY_RUNNING');
  });

  it('should allow same issue after session completes', async () => {
    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(result.reason).not.toBe('ALREADY_RUNNING');
  });
});

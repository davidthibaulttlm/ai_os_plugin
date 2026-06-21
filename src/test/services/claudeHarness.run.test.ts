/** Tests for ClaudeHarness.run — full lifecycle */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import type { RepoManager } from '../../services/repoManager';
import { ColumnPromptService } from '../../services/columnPrompt';
import type { GraphQLClient } from '../../services/graphql';

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

describe('ClaudeHarness.run — full lifecycle', () => {
  let mockRepoManager: RepoManager;
  let mockGraphql: GraphQLClient;
  let harness: ClaudeHarness;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepoManager = {
      createWorktree: vi.fn().mockResolvedValue({
        success: true,
        path: '/tmp/repos/test-repo/worktrees/1-test',
      }),
      updateWorktree: vi.fn().mockResolvedValue({ success: true }),
      hasStagedChanges: vi.fn().mockResolvedValue(true),
      commitWorktree: vi.fn().mockResolvedValue({ success: true }),
      pushWorktree: vi.fn().mockResolvedValue({ success: true }),
      detectDefaultBranch: vi.fn().mockResolvedValue('main'),
      getBranchName: vi.fn().mockReturnValue('ai-os/1-test'),
    } as unknown as RepoManager;

    mockGraphql = {
      createPullRequest: vi.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test-owner/test-repo/pull/1',
      }),
      execute: vi.fn().mockResolvedValue({
        repository: { id: 'repo-id-123' },
      }),
    } as unknown as GraphQLClient;

    harness = new ClaudeHarness(mockRepoManager, mockGraphql, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));
  });

  it('should complete full lifecycle on success', async () => {
    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      body: 'Test body',
      labels: ['bug'],
      column: 'AI_SPEC',
    });

    expect(result.success).toBe(true);
    expect(mockRepoManager.createWorktree).toHaveBeenCalled();
    expect(mockRepoManager.updateWorktree).toHaveBeenCalled();
    expect(mockRepoManager.hasStagedChanges).toHaveBeenCalled();
    expect(mockRepoManager.commitWorktree).toHaveBeenCalled();
    expect(mockRepoManager.pushWorktree).toHaveBeenCalled();
  });

  it('should create and then remove session', async () => {
    await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    const sessions = harness.getActiveSessions();
    expect(sessions.size).toBe(0);
  });

  it('should return success when no staged changes', async () => {
    (mockRepoManager.hasStagedChanges as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(result.success).toBe(true);
    expect(mockRepoManager.commitWorktree).not.toHaveBeenCalled();
    expect(mockRepoManager.pushWorktree).not.toHaveBeenCalled();
  });

  it('should handle commit failure', async () => {
    (mockRepoManager.commitWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Commit failed',
    });

    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('COMMIT_FAILED');
    expect(mockRepoManager.pushWorktree).not.toHaveBeenCalled();
  });

  it('should handle push failure', async () => {
    (mockRepoManager.pushWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Push failed',
    });

    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('PUSH_FAILED');
  });

  it('should include PR URL when PR creation succeeds', async () => {
    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(result.prUrl).toBe('https://github.com/test-owner/test-repo/pull/1');
  });

  it('should still succeed when PR creation fails (best-effort)', async () => {
    (mockGraphql.createPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'PR creation failed',
    });

    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(result.success).toBe(true);
    expect(result.prUrl).toBeUndefined();
  });
});

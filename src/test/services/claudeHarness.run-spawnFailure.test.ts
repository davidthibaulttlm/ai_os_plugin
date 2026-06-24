/** Tests for ClaudeHarness.run — spawn failure (ENOENT) */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import type { RepoManager } from '../../services/repoManager';
import { ColumnPromptService } from '../../services/columnPrompt';
import type { GraphQLClient } from '../../services/graphql';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    throw new Error('ENOENT: no such file or directory, spawn claude');
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
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ClaudeHarness.run — spawn failure', () => {
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
    } as unknown as RepoManager;
    harness = new ClaudeHarness(mockRepoManager, {} as GraphQLClient, new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any));
  });

  it('should return SPAWN_FAILED when claude binary not found', async () => {
    const result = await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('SPAWN_FAILED');
    expect(result.error).toContain('ENOENT');
  });

  it('should call createWorktree before attempting spawn', async () => {
    await harness.run({
      issueNumber: 1,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      column: 'AI_SPEC',
    });

    expect(mockRepoManager.createWorktree).toHaveBeenCalledWith(
      'test-owner',
      'test-repo',
      1,
      'Test Issue'
    );
  });

  it('should not create session when spawn fails', async () => {
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
});

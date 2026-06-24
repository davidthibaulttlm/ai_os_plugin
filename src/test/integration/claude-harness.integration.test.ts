/** Integration test: ClaudeHarness full agent lifecycle */

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

describe('ClaudeHarness integration — full lifecycle', () => {
  let mockRepoManager: RepoManager;
  let mockGraphql: GraphQLClient;
  let mockWebview: any;
  let harness: ClaudeHarness;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepoManager = {
      isRepoCloned: vi.fn().mockReturnValue(true),
      cloneOrUpdateRepos: vi.fn().mockResolvedValue([{ success: true }]),
      createWorktree: vi.fn().mockResolvedValue({
        success: true,
        path: '/tmp/repos/test-repo/worktrees/42-feature',
      }),
      updateWorktree: vi.fn().mockResolvedValue({ success: true }),
      hasStagedChanges: vi.fn().mockResolvedValue(true),
      commitWorktree: vi.fn().mockResolvedValue({ success: true }),
      pushWorktree: vi.fn().mockResolvedValue({ success: true }),
      detectDefaultBranch: vi.fn().mockResolvedValue('main'),
      getBranchName: vi.fn().mockReturnValue('ai-os/42-feature'),
    } as unknown as RepoManager;

    mockGraphql = {
      createPullRequest: vi.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test-owner/test-repo/pull/42',
      }),
      execute: vi.fn().mockResolvedValue({
        repository: { id: 'repo-id-456' },
      }),
    } as unknown as GraphQLClient;

    mockWebview = {
      postMessage: vi.fn().mockResolvedValue(true),
    };

    const promptService = new ColumnPromptService({ get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) } as any);
    harness = new ClaudeHarness(mockRepoManager, mockGraphql, promptService, mockWebview);
  });

  it('full lifecycle: worktree → spawn → exit → commit → push → PR', async () => {
    const result = await harness.run({
      issueNumber: 42,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Feature',
      body: 'Implement feature',
      labels: ['enhancement'],
      column: 'AI_CODE',
    });

    // Verify worktree preparation
    expect(mockRepoManager.createWorktree).toHaveBeenCalledWith(
      'test-owner', 'test-repo', 42, 'Feature'
    );
    expect(mockRepoManager.updateWorktree).toHaveBeenCalled();

    // Verify post-run pipeline
    expect(mockRepoManager.hasStagedChanges).toHaveBeenCalled();
    expect(mockRepoManager.commitWorktree).toHaveBeenCalled();
    expect(mockRepoManager.pushWorktree).toHaveBeenCalled();
    expect(mockGraphql.createPullRequest).toHaveBeenCalled();

    // Verify result
    expect(result.success).toBe(true);
    expect(result.prUrl).toBe('https://github.com/test-owner/test-repo/pull/42');

    // Verify session cleaned up
    expect(harness.getActiveSessions().size).toBe(0);
  });

  it('output buffering: recent lines available during run', async () => {
    const result = await harness.run({
      issueNumber: 42,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Feature',
      column: 'AI_CODE',
    });

    expect(result.success).toBe(true);

    // After session cleanup, buffer is cleared
    const buffered = harness.getBufferedOutput(42);
    expect(buffered).toEqual([]);
  });

  it('webview receives status updates', async () => {
    await harness.run({
      issueNumber: 42,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Feature',
      column: 'AI_CODE',
    });

    // Running status should be posted
    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'agentStatus', status: 'running' })
    );

    // Success status should be posted
    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'agentStatus', status: 'success' })
    );
  });

  it('no staged changes skips commit/push/PR', async () => {
    (mockRepoManager.hasStagedChanges as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await harness.run({
      issueNumber: 42,
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Feature',
      column: 'AI_CODE',
    });

    expect(result.success).toBe(true);
    expect(mockRepoManager.commitWorktree).not.toHaveBeenCalled();
    expect(mockRepoManager.pushWorktree).not.toHaveBeenCalled();
    expect(mockGraphql.createPullRequest).not.toHaveBeenCalled();
  });
});

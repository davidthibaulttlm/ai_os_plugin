import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RepoManager } from '../../services/repoManager';
import type { GraphQLClient } from '../../services/graphql';
import type { IssueContext } from '../../services/claudeHarness.types';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { runPostRunPipeline } from '../../services/claudeHarness.pipeline';

describe('runPostRunPipeline', () => {
  let mockRepoManager: Partial<RepoManager>;
  let mockGraphql: Partial<GraphQLClient>;
  const ctx: IssueContext = {
    issueNumber: 42,
    owner: 'test',
    repo: 'test',
    title: 'Test Issue',
    body: 'Test body',
    column: 'AI_CODE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoManager = {
      hasStagedChanges: vi.fn() as ReturnType<typeof vi.fn>,
      commitWorktree: vi.fn() as ReturnType<typeof vi.fn>,
      pushWorktree: vi.fn() as ReturnType<typeof vi.fn>,
      getBranchName: vi.fn().mockReturnValue('ai-os/test/42-test-issue'),
      detectDefaultBranch: vi.fn().mockResolvedValue('main'),
    };
    mockGraphql = {
      createPullRequest: vi.fn() as ReturnType<typeof vi.fn>,
      execute: vi.fn().mockResolvedValue({ repository: { id: 'repo123' } }),
    };
  });

  it('returns early when no staged changes', async () => {
    (mockRepoManager.hasStagedChanges as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const result = await runPostRunPipeline(ctx, '/worktree', 'test:test:42', mockRepoManager as RepoManager, mockGraphql as GraphQLClient);
    expect(result).toEqual({ success: true, issueNumber: 42, reason: 'No changes staged' });
    expect(mockRepoManager.commitWorktree).not.toHaveBeenCalled();
  });

  it('returns COMMIT_FAILED when commit fails', async () => {
    (mockRepoManager.hasStagedChanges as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (mockRepoManager.commitWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'git error' });
    const result = await runPostRunPipeline(ctx, '/worktree', 'test:test:42', mockRepoManager as RepoManager, mockGraphql as GraphQLClient);
    expect(result).toEqual({ success: false, issueNumber: 42, reason: 'COMMIT_FAILED', error: 'git error' });
  });

  it('returns PUSH_FAILED when push fails', async () => {
    (mockRepoManager.hasStagedChanges as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (mockRepoManager.commitWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (mockRepoManager.pushWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'push error' });
    const result = await runPostRunPipeline(ctx, '/worktree', 'test:test:42', mockRepoManager as RepoManager, mockGraphql as GraphQLClient);
    expect(result).toEqual({ success: false, issueNumber: 42, reason: 'PUSH_FAILED', error: 'push error' });
  });

  it('returns Complete with PR URL when PR succeeds', async () => {
    (mockRepoManager.hasStagedChanges as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (mockRepoManager.commitWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (mockRepoManager.pushWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (mockGraphql.createPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, prUrl: 'https://github.com/pr/1' });
    const result = await runPostRunPipeline(ctx, '/worktree', 'test:test:42', mockRepoManager as RepoManager, mockGraphql as GraphQLClient);
    expect(result).toEqual({ success: true, issueNumber: 42, reason: 'Complete', prUrl: 'https://github.com/pr/1' });
  });

  it('returns Complete without PR URL when PR fails (best-effort)', async () => {
    (mockRepoManager.hasStagedChanges as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (mockRepoManager.commitWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (mockRepoManager.pushWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (mockGraphql.createPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'pr error' });
    const result = await runPostRunPipeline(ctx, '/worktree', 'test:test:42', mockRepoManager as RepoManager, mockGraphql as GraphQLClient);
    expect(result).toEqual({ success: true, issueNumber: 42, reason: 'Complete' });
  });

  it('handles PR creation throwing error (best-effort)', async () => {
    (mockRepoManager.hasStagedChanges as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (mockRepoManager.commitWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (mockRepoManager.pushWorktree as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (mockGraphql.createPullRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    const result = await runPostRunPipeline(ctx, '/worktree', 'test:test:42', mockRepoManager as RepoManager, mockGraphql as GraphQLClient);
    expect(result).toEqual({ success: true, issueNumber: 42, reason: 'Complete' });
  });
});

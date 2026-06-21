import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoManager } from '../../services/repoManager';
import { AgentService } from '../../services/agent';
import type { ProjectItemNode } from '../../services/graphql';

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
      info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
    })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(async (_options, callback) => callback({ report: vi.fn() })),
  },
  ProgressLocation: { Notification: 1 },
  commands: { executeCommand: vi.fn() },
}));

describe('Clone repos integration flow', () => {
  let repoManager: RepoManager;
  let agentService: AgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    repoManager = new RepoManager('/tmp/test-repos', 'test-token');
    agentService = new AgentService();
  });

  it('extracts repos from board items and checks availability', () => {
    const items: unknown[] = [
      {
        id: '1',
        databaseId: 1,
        content: {
          __typename: 'Issue',
          number: 1,
          title: 'Issue 1',
          body: '',
          repository: { owner: { login: 'owner1' }, name: 'repo1' },
        },
      },
      {
        id: '2',
        databaseId: 2,
        content: {
          __typename: 'Issue',
          number: 2,
          title: 'Issue 2',
          body: '',
          repository: { owner: { login: 'owner1' }, name: 'repo1' },
        },
      },
      {
        id: '3',
        databaseId: 3,
        content: {
          __typename: 'Issue',
          number: 3,
          title: 'Issue 3',
          body: '',
          repository: { owner: { login: 'owner2' }, name: 'repo2' },
        },
      },
    ];

    const repos = repoManager.extractReposFromItems(items as ProjectItemNode[]);
    expect(repos).toHaveLength(2);
    expect(repos).toContainEqual({ owner: 'owner1', repo: 'repo1' });
    expect(repos).toContainEqual({ owner: 'owner2', repo: 'repo2' });
  });

  it('agent callback receives worktree cwd from repo manager', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    agentService.setCallback(callback);

    agentService.setBoardState([
      {
        id: 42,
        projectItemId: 'PVTI_42',
        title: 'Fix login',
        status: 'AI_SPEC',
        labels: [],
        owner: 'test-owner',
        repo: 'test-repo',
        body: 'Body text',
      },
    ]);

    await agentService.startAgent();

    expect(callback).toHaveBeenCalledWith(
      '42',
      'AI_SPEC',
      'Fix login',
      'Body text',
      'test-owner',
      'test-repo'
    );
  });

  it('branch naming is consistent between agent and repo manager', () => {
    const branchName = repoManager.getBranchName('myrepo', 123, 'Add Feature!!!');
    expect(branchName).toBe('ai-os/myrepo/123-add-feature');
  });

  it('worktree path matches branch naming', () => {
    const worktreePath = repoManager.getWorktreePath('owner', 'repo', 456, 'Bug Fix');
    expect(worktreePath).toBe('/tmp/test-repos/owner/repo/.worktrees/456-bug-fix');
  });
});

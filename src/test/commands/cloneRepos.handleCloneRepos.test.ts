import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { handleCloneRepos, checkMissingRepos } from '../../commands/cloneRepos';
import type { GraphQLClient } from '../../services/graphql';
import type { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
      info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
    })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(async (options, callback) => callback({ report: vi.fn() })),
  },
  ProgressLocation: { Notification: 1 },
  commands: { executeCommand: vi.fn() },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('handleCloneRepos', () => {
  let mockRepoManager: RepoManager & {
    checkGitAvailableAsync: ReturnType<typeof vi.fn>;
    extractReposFromItems: ReturnType<typeof vi.fn>;
    isRepoCloned: ReturnType<typeof vi.fn>;
    cloneRepo: ReturnType<typeof vi.fn>;
    updateRepo: ReturnType<typeof vi.fn>;
  };
  let mockGraphql: GraphQLClient & {
    getProjectItems: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoManager = {
      checkGitAvailableAsync: vi.fn().mockResolvedValue(true),
      extractReposFromItems: vi.fn().mockReturnValue([{ owner: 'owner1', repo: 'repo1' }]),
      isRepoCloned: vi.fn().mockReturnValue(false),
      cloneRepo: vi.fn().mockResolvedValue({ success: true }),
      updateRepo: vi.fn().mockResolvedValue({ success: true }),
    } as any;
    mockGraphql = {
      getProjectItems: vi.fn().mockResolvedValue([
        { content: { repository: { owner: { login: 'owner1' }, name: 'repo1' } } },
      ]),
    } as any;
  });

  it('shows error when git not available', async () => {
    mockRepoManager.checkGitAvailableAsync.mockResolvedValue(false);
    await handleCloneRepos(mockRepoManager, mockGraphql, 'project1');
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Git'));
  });

  it('shows error when fetch fails', async () => {
    mockGraphql.getProjectItems.mockRejectedValue(new Error('API error'));
    await handleCloneRepos(mockRepoManager, mockGraphql, 'project1');
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed'));
  });

  it('shows info when no repos found', async () => {
    mockRepoManager.extractReposFromItems.mockReturnValue([]);
    await handleCloneRepos(mockRepoManager, mockGraphql, 'project1');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('No repositories'));
  });

  it('clones missing repos', async () => {
    await handleCloneRepos(mockRepoManager, mockGraphql, 'project1');
    expect(mockRepoManager.cloneRepo).toHaveBeenCalledWith('owner1', 'repo1');
  });

  it('updates existing repos', async () => {
    mockRepoManager.isRepoCloned.mockReturnValue(true);
    await handleCloneRepos(mockRepoManager, mockGraphql, 'project1');
    expect(mockRepoManager.updateRepo).toHaveBeenCalledWith('owner1', 'repo1');
  });
});

describe('checkMissingRepos', () => {
  let mockRepoManager: RepoManager & {
    extractReposFromItems: ReturnType<typeof vi.fn>;
    isRepoCloned: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoManager = {
      extractReposFromItems: vi.fn().mockReturnValue([{ owner: 'owner1', repo: 'repo1' }]),
      isRepoCloned: vi.fn().mockReturnValue(false),
    } as any;
    (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('returns empty when all repos present', async () => {
    mockRepoManager.isRepoCloned.mockReturnValue(true);
    const result = await checkMissingRepos(mockRepoManager, []);
    expect(result).toEqual([]);
  });

  it('returns missing repos when some are not cloned', async () => {
    (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const result = await checkMissingRepos(mockRepoManager, []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ owner: 'owner1', repo: 'repo1' });
  });
});

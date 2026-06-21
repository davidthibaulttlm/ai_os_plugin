/** Clone Project Repos command — clones all repos referenced in the active board */

import * as vscode from 'vscode';
import type { GraphQLClient } from '../services/graphql';
import { RepoManager } from '../services/repoManager';
import { logger } from '../services/logger';

/**
 * Handle the aiOs.cloneRepos command.
 * Fetches board items, extracts unique repos, clones missing, updates existing.
 */
export async function handleCloneRepos(
  repoManager: RepoManager,
  graphql: GraphQLClient,
  projectId: string
): Promise<void> {
  logger.info(`[handleCloneRepos] Starting for project ${projectId}`);

  const gitAvailable = await repoManager.checkGitAvailableAsync();
  if (!gitAvailable) {
    logger.error('[handleCloneRepos] Git not available');
    vscode.window.showErrorMessage('Git is required but not found on PATH');
    return;
  }

  let items;
  try {
    logger.info('[handleCloneRepos] Fetching board items');
    items = await graphql.getProjectItems(projectId);
    logger.info(`[handleCloneRepos] Fetched ${items.length} board items`);
  } catch (error) {
    const errorMsg = (error as Error).message;
    logger.error(`[handleCloneRepos] Error fetching board items: ${errorMsg}`);
    vscode.window.showErrorMessage(`Failed to fetch board items: ${errorMsg}`);
    return;
  }

  const repos = repoManager.extractReposFromItems(items);
  if (repos.length === 0) {
    logger.info('[handleCloneRepos] No repos found in board items');
    vscode.window.showInformationMessage('No repositories found in this board');
    return;
  }

  logger.info(`[handleCloneRepos] Found ${repos.length} unique repos: ${repos.map(r => `${r.owner}/${r.repo}`).join(', ')}`);

  const results = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'AI OS: Cloning/Updating Repos',
      cancellable: false,
    },
    async (progress) => {
      const results: Array<{ owner: string; repo: string; success: boolean; error?: string }> = [];
      let done = 0;

      for (const { owner, repo } of repos) {
        progress.report({ message: `${owner}/${repo}`, increment: (1 / repos.length) * 100 });
        const isCloned = repoManager.isRepoCloned(owner, repo);
        logger.info(`[handleCloneRepos] Processing ${owner}/${repo} (cloned=${isCloned})`);

        let result;
        if (isCloned) {
          result = await repoManager.updateRepo(owner, repo);
        } else {
          result = await repoManager.cloneRepo(owner, repo);
        }

        results.push({ owner, repo, ...result });
        done++;
        logger.info(`[handleCloneRepos] ${owner}/${repo} result: success=${result.success} (${done}/${repos.length})`);
      }

      return results;
    }
  );

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  if (failCount === 0) {
    const repoNames = results.map((r) => `${r.owner}/${r.repo}`);
    let message: string;
    if (repoNames.length <= 5) {
      message = `Cloned ${results.length} repos: ${repoNames.join(', ')}`;
    } else {
      const truncated = repoNames.slice(0, 5).join(', ');
      message = `Cloned ${results.length} repos: ${truncated} +${repoNames.length - 5} more`;
    }
    logger.info(`[handleCloneRepos] Success: ${message}`);
    vscode.window.showInformationMessage(message);
  } else {
    const failures = results.filter((r) => !r.success);
    const failureDetails = failures.map((f) => `${f.owner}/${f.repo} — ${f.error || 'unknown error'}`).join('; ');
    const message = `Cloned ${successCount}/${results.length} repos. Failed: ${failureDetails}`;
    logger.warn(`[handleCloneRepos] Partial success: ${message}`);
    vscode.window.showWarningMessage(message);
  }

  logger.info(`[handleCloneRepos] Complete: ${successCount}/${results.length} succeeded`);
}

/**
 * Check for missing repos and show notification with action to clone.
 * Returns the list of missing repos (or empty if all present).
 */
export async function checkMissingRepos(
  repoManager: RepoManager,
  items: any[]
): Promise<{ owner: string; repo: string }[]> {
  logger.info(`[checkMissingRepos] Checking ${items.length} items`);

  const repos = repoManager.extractReposFromItems(items);
  const missing = repos.filter((r) => !repoManager.isRepoCloned(r.owner, r.repo));

  if (missing.length === 0) {
    logger.info('[checkMissingRepos] All repos present');
    return [];
  }

  logger.info(`[checkMissingRepos] ${missing.length} missing repos: ${missing.map(r => `${r.owner}/${r.repo}`).join(', ')}`);

  const repoNames = missing.map((r) => `${r.owner}/${r.repo}`);
  let message: string;
  if (repoNames.length <= 5) {
    message = `Missing repos: ${repoNames.join(', ')}`;
  } else {
    const truncated = repoNames.slice(0, 5).join(', ');
    message = `Missing repos: ${truncated} +${repoNames.length - 5} more`;
  }

  const action = await vscode.window.showInformationMessage(
    `${message}. Repos required for agent work.`,
    'Clone Missing Repos'
  );

  if (action === 'Clone Missing Repos') {
    logger.info('[checkMissingRepos] User clicked "Clone Missing Repos"');
    vscode.commands.executeCommand('aiOs.cloneRepos');
  }

  return missing;
}

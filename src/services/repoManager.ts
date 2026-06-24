import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ProjectItemNode } from './graphql';
import { logger } from './logger';
import type { GitResult, WorktreeResult, RepoRef } from './repoManager.types';
import { runGit, handleGitResult } from './repoManager.git';

export type { GitResult, WorktreeResult, RepoRef } from './repoManager.types';

export class RepoManager {
  private reposDir: string;
  private token: string;
  private repoChains = new Map<string, Promise<unknown>>();

  public constructor(reposDir: string, token: string) {
    logger.info('[RepoManager.constructor] Starting...');
    logger.info(`[RepoManager.constructor] reposDir=${reposDir}`);

    this.reposDir = reposDir.startsWith('~')
      ? reposDir.replace('~', os.homedir())
      : reposDir;
    this.token = token;

    logger.info(`[RepoManager.constructor] Resolved reposDir=${this.reposDir}`);
  }

  public getReposDir(): string {
    logger.debug(`[RepoManager.getReposDir] Returning ${this.reposDir}`);
    return this.reposDir;
  }

  public checkGitAvailable(): boolean {
    logger.info('[RepoManager.checkGitAvailable] Checking git availability');
    try {
      const { execSync } = require('child_process');
      execSync('git --version', { stdio: 'ignore' });
      logger.info('[RepoManager.checkGitAvailable] Result: true');
      return true;
    } catch (error) {
      logger.error(`[RepoManager.checkGitAvailable] Error: ${(error as Error).message}`);
      return false;
    }
  }

  public async checkGitAvailableAsync(): Promise<boolean> {
    logger.info('[RepoManager.checkGitAvailableAsync] Checking git availability');
    return new Promise((resolve) => {
      try {
        const child = spawn('git', ['--version']);
        child.on('exit', (code) => {
          const available = code === 0;
          logger.info(`[RepoManager.checkGitAvailableAsync] Result: ${available}`);
          resolve(available);
        });
        child.on('error', () => {
          logger.error('[RepoManager.checkGitAvailableAsync] Error spawning git');
          resolve(false);
        });
      } catch (error) {
        logger.error(`[RepoManager.checkGitAvailableAsync] Error: ${(error as Error).message}`);
        resolve(false);
      }
    });
  }

  public getRepoPath(owner: string, repo: string): string {
    logger.info(`[RepoManager.getRepoPath] owner=${owner} repo=${repo}`);
    const repoPath = path.join(this.reposDir, owner, repo);
    logger.info(`[RepoManager.getRepoPath] Result: ${repoPath}`);
    return repoPath;
  }

  public isRepoCloned(owner: string, repo: string): boolean {
    logger.info(`[RepoManager.isRepoCloned] owner=${owner} repo=${repo}`);
    const repoPath = this.getRepoPath(owner, repo);
    const gitDir = path.join(repoPath, '.git');
    const exists = fs.existsSync(gitDir);
    logger.info(`[RepoManager.isRepoCloned] Result: ${exists}`);
    return exists;
  }

  public getClonedRepos(): RepoRef[] {
    logger.info(`[RepoManager.getClonedRepos] Scanning ${this.reposDir}`);
    const cloned: RepoRef[] = [];
    try {
      if (!fs.existsSync(this.reposDir)) {
        logger.info('[RepoManager.getClonedRepos] reposDir does not exist');
        return cloned;
      }
      const owners = fs.readdirSync(this.reposDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      for (const owner of owners) {
        const ownerPath = path.join(this.reposDir, owner);
        const repos = fs.readdirSync(ownerPath, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        for (const repo of repos) {
          const gitDir = path.join(ownerPath, repo, '.git');
          if (fs.existsSync(gitDir)) {
            cloned.push({ owner, repo });
          }
        }
      }
    } catch (error) {
      logger.error(`[RepoManager.getClonedRepos] Error scanning: ${(error as Error).message}`);
    }
    logger.info(`[RepoManager.getClonedRepos] Found ${cloned.length} cloned repos`);
    return cloned;
  }

  public extractReposFromItems(items: ProjectItemNode[]): RepoRef[] {
    logger.info(`[RepoManager.extractReposFromItems] Starting with ${items.length} items`);
    const seen = new Set<string>();
    const repos: RepoRef[] = [];

    for (const item of items) {
      const content = item.content;
      if (!content || !content.repository) continue;
      const owner = content.repository.owner?.login;
      const repo = content.repository.name;
      if (!owner || !repo) continue;

      const key = `${owner}/${repo}`;
      if (!seen.has(key)) {
        seen.add(key);
        repos.push({ owner, repo });
      }
    }

    logger.info(`[RepoManager.extractReposFromItems] Result: ${repos.length} unique repos`);
    return repos;
  }

  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  public getBranchName(repoName: string, issueNumber: number, title: string): string {
    logger.info(`[RepoManager.getBranchName] repoName=${repoName} issueNumber=${issueNumber} title=${title}`);
    const slug = this.slugify(title);
    const branchName = `ai-os/${repoName}/${issueNumber}-${slug}`;
    logger.info(`[RepoManager.getBranchName] Result: ${branchName}`);
    return branchName;
  }

  public getWorktreePath(owner: string, repo: string, issueNumber: number, title: string): string {
    logger.info(`[RepoManager.getWorktreePath] owner=${owner} repo=${repo} issueNumber=${issueNumber} title=${title}`);
    const repoPath = this.getRepoPath(owner, repo);
    const slug = this.slugify(title);
    const worktreePath = path.join(repoPath, '.worktrees', `${issueNumber}-${slug}`);
    logger.info(`[RepoManager.getWorktreePath] Result: ${worktreePath}`);
    return worktreePath;
  }

  private getRepoKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }

  private async queueRepoOp<T>(owner: string, repo: string, op: () => Promise<T>): Promise<T> {
    const key = this.getRepoKey(owner, repo);
    const previous = this.repoChains.get(key) || Promise.resolve();
    await previous;
    try {
      return await op();
    } finally {
      // Chain is maintained via sequential awaits
    }
  }

  private async _runGit(cwd: string, args: string[]) {
    return runGit(this.token, cwd, args);
  }

  public async detectDefaultBranch(owner: string, repo: string): Promise<string> {
    logger.info(`[RepoManager.detectDefaultBranch] owner=${owner} repo=${repo}`);
    const result = await this._runGit('/tmp', ['ls-remote', '--symref', `https://github.com/${owner}/${repo}.git`, 'HEAD']);

    const match = result.stdout.match(/refs\/heads\/([^\s]+)/);
    const branch = match ? match[1] : 'main';
    logger.info(`[RepoManager.detectDefaultBranch] Result: ${branch}`);
    return branch;
  }

  public async cloneRepo(owner: string, repo: string): Promise<GitResult> {
    logger.info(`[RepoManager.cloneRepo] owner=${owner} repo=${repo}`);

    return this.queueRepoOp(owner, repo, async () => {
      try {
        const repoPath = this.getRepoPath(owner, repo);
        const defaultBranch = await this.detectDefaultBranch(owner, repo);

        const parentDir = path.dirname(repoPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        logger.info(`[RepoManager.cloneRepo] Cloning ${owner}/${repo} to ${repoPath} branch=${defaultBranch}`);
        const result = await this._runGit(parentDir, [
          'clone', '--single-branch', '--branch', defaultBranch,
          `https://github.com/${owner}/${repo}.git`, repo
        ]);

        return handleGitResult(result, 'clone', owner, repo);
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[RepoManager.cloneRepo] Error: ${errorMsg}`);
        return { success: false, error: errorMsg.substring(0, 100) };
      }
    });
  }

  public async updateRepo(owner: string, repo: string): Promise<GitResult> {
    logger.info(`[RepoManager.updateRepo] owner=${owner} repo=${repo}`);

    return this.queueRepoOp(owner, repo, async () => {
      try {
        const repoPath = this.getRepoPath(owner, repo);
        const result = await this._runGit(repoPath, ['pull', '--rebase']);

        return handleGitResult(result, 'pull', owner, repo);
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[RepoManager.updateRepo] Error: ${errorMsg}`);
        return { success: false, error: errorMsg.substring(0, 100) };
      }
    });
  }

  public async cloneOrUpdateRepos(repos: RepoRef[]): Promise<GitResult[]> {
    logger.info(`[RepoManager.cloneOrUpdateRepos] Processing ${repos.length} repos`);
    const results: GitResult[] = [];

    for (const { owner, repo } of repos) {
      if (this.isRepoCloned(owner, repo)) {
        results.push(await this.updateRepo(owner, repo));
      } else {
        results.push(await this.cloneRepo(owner, repo));
      }
    }

    logger.info(`[RepoManager.cloneOrUpdateRepos] Result: ${results.filter(r => r.success).length}/${results.length} succeeded`);
    return results;
  }

  public async createWorktree(owner: string, repo: string, issueNumber: number, title: string): Promise<WorktreeResult> {
    logger.info(`[RepoManager.createWorktree] owner=${owner} repo=${repo} issueNumber=${issueNumber} title=${title}`);
    return this.queueRepoOp(owner, repo, async () => {
      try {
        const repoPath = this.getRepoPath(owner, repo);
        const cloned = this.isRepoCloned(owner, repo);
        logger.info(`[RepoManager.createWorktree] Repo cloned check: ${cloned} for ${owner}/${repo} at ${repoPath}`);
        if (!cloned) {
          logger.warn(`[RepoManager.createWorktree] Repo ${owner}/${repo} is NOT cloned — cannot create worktree`);
          return { success: false, error: `Repo ${owner}/${repo} is not cloned. Run clone command first.` };
        }
        const branchName = this.getBranchName(repo, issueNumber, title);
        const worktreePath = this.getWorktreePath(owner, repo, issueNumber, title);
        if (fs.existsSync(worktreePath)) {
          logger.info(`[RepoManager.createWorktree] Already exists: ${worktreePath}`);
          return { success: true, path: worktreePath };
        }
        const worktreesDir = path.join(repoPath, '.worktrees');
        fs.mkdirSync(worktreesDir, { recursive: true });
        const branchCheck = await this._runGit(repoPath, ['branch', '--list', branchName]);
        const branchExists = branchCheck.stdout.includes(branchName);
        const result = branchExists
          ? await this._runGit(repoPath, ['worktree', 'add', worktreePath, branchName])
          : await this._runGit(repoPath, ['worktree', 'add', '-b', branchName, worktreePath]);
        if (result.code === 0) {
          logger.info(`[RepoManager.createWorktree] Success: ${worktreePath}`);
          return { success: true, path: worktreePath };
        } else {
          const error = result.stderr || 'Worktree creation failed';
          logger.error(`[RepoManager.createWorktree] Error: ${error}`);
          return { success: false, error: error.substring(0, 100) };
        }
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[RepoManager.createWorktree] Error: ${errorMsg}`);
        return { success: false, error: errorMsg.substring(0, 100) };
      }
    });
  }

  public async updateWorktree(worktreePath: string): Promise<GitResult> {
    logger.info(`[RepoManager.updateWorktree] worktreePath=${worktreePath}`);
    try {
      if (!fs.existsSync(worktreePath)) {
        logger.error(`[RepoManager.updateWorktree] Does not exist: ${worktreePath}`);
        return { success: false, error: 'Worktree does not exist' };
      }
      const fetchResult = await this._runGit(worktreePath, ['fetch', 'origin']);
      if (fetchResult.code !== 0) {
        const error = fetchResult.stderr || 'Fetch failed';
        logger.error(`[RepoManager.updateWorktree] Fetch error: ${error}`);
        return { success: false, error: error.substring(0, 100) };
      }
      const pullResult = await this._runGit(worktreePath, ['pull', '--rebase']);
      if (pullResult.code === 0) {
        logger.info('[RepoManager.updateWorktree] Success');
        return { success: true };
      } else {
        const error = pullResult.stderr || 'Pull --rebase failed';
        logger.error(`[RepoManager.updateWorktree] Pull error: ${error}`);
        return { success: false, error: error.substring(0, 100) };
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.error(`[RepoManager.updateWorktree] Error: ${errorMsg}`);
      return { success: false, error: errorMsg.substring(0, 100) };
    }
  }

  public async cleanupWorktree(owner: string, repo: string, issueNumber: number, title: string): Promise<GitResult> {
    logger.info(`[RepoManager.cleanupWorktree] owner=${owner} repo=${repo} issueNumber=${issueNumber} title=${title}`);
    return this.queueRepoOp(owner, repo, async () => {
      try {
        const repoPath = this.getRepoPath(owner, repo);
        const branchName = this.getBranchName(repo, issueNumber, title);
        const worktreePath = this.getWorktreePath(owner, repo, issueNumber, title);
        if (fs.existsSync(worktreePath)) {
          logger.info(`[RepoManager.cleanupWorktree] Removing: ${worktreePath}`);
          const removeResult = await this._runGit(repoPath, ['worktree', 'remove', '--force', worktreePath]);
          if (removeResult.code !== 0) {
            logger.warn(`[RepoManager.cleanupWorktree] Remove failed, trying manual`);
            try { fs.rmSync(worktreePath, { recursive: true, force: true }); }
            catch (e) { logger.error(`[RepoManager.cleanupWorktree] Manual remove failed: ${(e as Error).message}`); }
          }
        }
        const branchResult = await this._runGit(repoPath, ['branch', '-D', branchName]);
        if (branchResult.code !== 0) {
          logger.warn(`[RepoManager.cleanupWorktree] Delete branch failed: ${branchResult.stderr}`);
        }
        logger.info('[RepoManager.cleanupWorktree] Complete');
        return { success: true };
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[RepoManager.cleanupWorktree] Error: ${errorMsg}`);
        return { success: false, error: errorMsg.substring(0, 100) };
      }
    });
  }

  public async hasStagedChanges(worktreePath: string): Promise<boolean> {
    logger.info(`[RepoManager.hasStagedChanges] worktreePath=${worktreePath}`);
    try {
      const result = await this._runGit(worktreePath, ['diff', '--staged', '--name-only']);
      const hasChanges = result.code === 0 && result.stdout.length > 0;
      logger.info(`[RepoManager.hasStagedChanges] Result: ${hasChanges}`);
      return hasChanges;
    } catch (error) {
      logger.error(`[RepoManager.hasStagedChanges] Error: ${(error as Error).message}`);
      return false;
    }
  }

  public async commitWorktree(worktreePath: string, message: string): Promise<GitResult> {
    logger.info(`[RepoManager.commitWorktree] worktreePath=${worktreePath} message=${message}`);
    try {
      await this._runGit(worktreePath, ['config', 'user.name', 'ai-os-agent']);
      await this._runGit(worktreePath, ['config', 'user.email', 'ai-os@localhost']);

      const sanitized = message.replace(/\n/g, ' ').replace(/"/g, '\\"');
      const result = await this._runGit(worktreePath, ['commit', '-m', sanitized]);

      if (result.code === 0) {
        logger.info('[RepoManager.commitWorktree] Result: success');
        return { success: true };
      } else {
        if (result.stderr.includes('nothing added') || result.stderr.includes('no changes added')) {
          logger.warn('[RepoManager.commitWorktree] No staged changes to commit');
          return { success: false, error: 'No staged changes' };
        }
        const error = result.stderr || 'Commit failed';
        logger.error(`[RepoManager.commitWorktree] Error: ${error}`);
        return { success: false, error: error.substring(0, 100) };
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.error(`[RepoManager.commitWorktree] Error: ${errorMsg}`);
      return { success: false, error: errorMsg.substring(0, 100) };
    }
  }

  public async pushWorktree(worktreePath: string, branchName: string): Promise<GitResult> {
    logger.info(`[RepoManager.pushWorktree] worktreePath=${worktreePath} branchName=${branchName}`);
    try {
      const result = await this._runGit(worktreePath, ['push', '--set-upstream', 'origin', branchName]);

      if (result.code === 0) {
        logger.info('[RepoManager.pushWorktree] Result: success');
        return { success: true };
      } else {
        const error = result.stderr || 'Push failed';
        logger.error(`[RepoManager.pushWorktree] Error: ${error}`);
        return { success: false, error: error.substring(0, 100) };
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.error(`[RepoManager.pushWorktree] Error: ${errorMsg}`);
      return { success: false, error: errorMsg.substring(0, 100) };
    }
  }

  public async createPullRequest(
    repositoryId: string,
    headBranch: string,
    baseBranch: string,
    title: string,
    _body: string
  ): Promise<{ success: boolean; prUrl?: string; error?: string }> {
    logger.info(`[RepoManager.createPullRequest] repositoryId=${repositoryId} headBranch=${headBranch} baseBranch=${baseBranch} title=${title}`);
    logger.warn('[RepoManager.createPullRequest] Not implemented — use GraphQLClient directly');
    return { success: false, error: 'createPullRequest must be called via GraphQLClient' };
  }
}

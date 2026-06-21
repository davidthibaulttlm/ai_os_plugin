/** RepoManager — clones repos, manages git worktrees per issue */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ProjectItemNode } from './graphql';
import { logger } from './logger';

/** Result of a git operation */
export interface GitResult {
  success: boolean;
  error?: string;
}

/** Result of worktree creation */
export interface WorktreeResult extends GitResult {
  path?: string;
}

/** Repo identifier */
export interface RepoRef {
  owner: string;
  repo: string;
}

/**
 * Manages repository cloning and git worktrees for agent isolation.
 * Each issue gets its own worktree so agent work doesn't conflict with user's coding.
 */
export class RepoManager {
  private reposDir: string;
  private token: string;
  /** Per-repo promise chain to serialize git operations on same repo */
  private repoChains = new Map<string, Promise<unknown>>();

  /**
   * Create a new RepoManager instance.
   * @param reposDir - Base directory for cloned repos (supports ~ for home)
   * @param token - GitHub token for HTTPS auth via GIT_ASKPASS
   */
  public constructor(reposDir: string, token: string) {
    logger.info('[RepoManager.constructor] Starting...');
    logger.info(`[RepoManager.constructor] reposDir=${reposDir}`);

    // Resolve ~ to home directory
    this.reposDir = reposDir.startsWith('~')
      ? reposDir.replace('~', os.homedir())
      : reposDir;
    this.token = token;

    logger.info(`[RepoManager.constructor] Resolved reposDir=${this.reposDir}`);
  }

  /**
   * Get the resolved repos directory path.
   */
  public getReposDir(): string {
    logger.debug(`[RepoManager.getReposDir] Returning ${this.reposDir}`);
    return this.reposDir;
  }

  /**
   * Check if git is available on PATH.
   */
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

  /**
   * Sync version of checkGitAvailable for synchronous usage.
   */
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

  /**
   * Get the absolute path for a cloned repo.
   */
  public getRepoPath(owner: string, repo: string): string {
    logger.info(`[RepoManager.getRepoPath] owner=${owner} repo=${repo}`);
    const repoPath = path.join(this.reposDir, owner, repo);
    logger.info(`[RepoManager.getRepoPath] Result: ${repoPath}`);
    return repoPath;
  }

  /**
   * Check if a repo is already cloned (by checking for .git directory).
   */
  public isRepoCloned(owner: string, repo: string): boolean {
    logger.info(`[RepoManager.isRepoCloned] owner=${owner} repo=${repo}`);
    const repoPath = this.getRepoPath(owner, repo);
    const gitDir = path.join(repoPath, '.git');
    const exists = fs.existsSync(gitDir);
    logger.info(`[RepoManager.isRepoCloned] Result: ${exists}`);
    return exists;
  }

  /**
   * Extract unique repository identifiers from board items.
   */
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

  /**
   * Generate a slug from an issue title for branch/directory naming.
   */
  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Generate branch name for an issue.
   * Format: ai-os/{repoName}/{ISSUE}-{title-slug}
   */
  public getBranchName(repoName: string, issueNumber: number, title: string): string {
    logger.info(`[RepoManager.getBranchName] repoName=${repoName} issueNumber=${issueNumber} title=${title}`);
    const slug = this.slugify(title);
    const branchName = `ai-os/${repoName}/${issueNumber}-${slug}`;
    logger.info(`[RepoManager.getBranchName] Result: ${branchName}`);
    return branchName;
  }

  /**
   * Get the worktree path for an issue.
   * Format: <repoPath>/.worktrees/{ISSUE}-{title-slug}
   */
  public getWorktreePath(owner: string, repo: string, issueNumber: number, title: string): string {
    logger.info(`[RepoManager.getWorktreePath] owner=${owner} repo=${repo} issueNumber=${issueNumber} title=${title}`);
    const repoPath = this.getRepoPath(owner, repo);
    const slug = this.slugify(title);
    const worktreePath = path.join(repoPath, '.worktrees', `${issueNumber}-${slug}`);
    logger.info(`[RepoManager.getWorktreePath] Result: ${worktreePath}`);
    return worktreePath;
  }

  /**
   * Get the repo key for promise chain serialization.
   */
  private getRepoKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }

  /**
   * Queue an operation for a specific repo to prevent concurrent git commands.
   */
  private async queueRepoOp<T>(owner: string, repo: string, op: () => Promise<T>): Promise<T> {
    const key = this.getRepoKey(owner, repo);
    const previous = this.repoChains.get(key) || Promise.resolve();
    await previous; // Wait for previous operation to complete
    try {
      return await op();
    } finally {
      // Chain is maintained via sequential awaits
    }
  }

  /**
   * Run a git command with token auth via GIT_ASKPASS.
   */
  private runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
    logger.debug(`[RepoManager.runGit] cwd=${cwd} args=${args.join(' ')}`);

    const askpassScript = `#!/bin/sh
echo '${this.token}'`;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-os-'));
    const askpassPath = path.join(tmpDir, 'askpass.sh');
    fs.writeFileSync(askpassPath, askpassScript, { mode: 0o700 });

    const env = {
      ...process.env,
      GIT_ASKPASS: askpassPath,
      GIT_TERMINAL_PROMPT: '0',
    };

    return new Promise((resolve) => {
      const child = spawn('git', args, { cwd, env, shell: false });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('exit', (code) => {
        try { fs.unlinkSync(askpassPath); fs.rmdirSync(tmpDir); } catch { /* ignore cleanup errors */ }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
      });

      child.on('error', (error) => {
        try { fs.unlinkSync(askpassPath); fs.rmdirSync(tmpDir); } catch { /* ignore */ }
        resolve({ stdout: '', stderr: error.message, code: -1 });
      });
    });
  }

  /**
   * Convert git run result to GitResult with logging.
   */
  private handleGitResult(result: { code: number | null; stderr: string }, action: string, owner: string, repo: string): GitResult {
    if (result.code === 0) {
      logger.info(`[RepoManager.${action}] Successfully ${action}ed ${owner}/${repo}`);
      return { success: true };
    } else {
      const error = result.stderr || `${action.charAt(0).toUpperCase() + action.slice(1)} failed`;
      logger.error(`[RepoManager.${action}] Error ${action}ing ${owner}/${repo}: ${error}`);
      return { success: false, error: error.substring(0, 100) };
    }
  }

  /**
   * Detect the default branch name for a repo.
   */
  private async detectDefaultBranch(owner: string, repo: string): Promise<string> {
    logger.info(`[RepoManager.detectDefaultBranch] owner=${owner} repo=${repo}`);
    const result = await this.runGit('/tmp', ['ls-remote', '--symref', `https://github.com/${owner}/${repo}.git`, 'HEAD']);
    
    const match = result.stdout.match(/refs\/heads\/([^\\]+)/);
    const branch = match ? match[1] : 'main';
    logger.info(`[RepoManager.detectDefaultBranch] Result: ${branch}`);
    return branch;
  }

  /**
   * Clone a repository (single-branch, full history).
   */
  public async cloneRepo(owner: string, repo: string): Promise<GitResult> {
    logger.info(`[RepoManager.cloneRepo] owner=${owner} repo=${repo}`);

    return this.queueRepoOp(owner, repo, async () => {
      try {
        const repoPath = this.getRepoPath(owner, repo);
        const defaultBranch = await this.detectDefaultBranch(owner, repo);

        // Ensure parent directory exists
        const parentDir = path.dirname(repoPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        logger.info(`[RepoManager.cloneRepo] Cloning ${owner}/${repo} to ${repoPath} branch=${defaultBranch}`);
        const result = await this.runGit(parentDir, [
          'clone', '--single-branch', '--branch', defaultBranch,
          `https://github.com/${owner}/${repo}.git`, repo
        ]);

        return this.handleGitResult(result, 'clone', owner, repo);
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[RepoManager.cloneRepo] Error: ${errorMsg}`);
        return { success: false, error: errorMsg.substring(0, 100) };
      }
    });
  }

  /**
   * Update an existing repo with git pull --rebase.
   */
  public async updateRepo(owner: string, repo: string): Promise<GitResult> {
    logger.info(`[RepoManager.updateRepo] owner=${owner} repo=${repo}`);

    return this.queueRepoOp(owner, repo, async () => {
      try {
        const repoPath = this.getRepoPath(owner, repo);
        const result = await this.runGit(repoPath, ['pull', '--rebase']);

        return this.handleGitResult(result, 'pull', owner, repo);
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[RepoManager.updateRepo] Error: ${errorMsg}`);
        return { success: false, error: errorMsg.substring(0, 100) };
      }
    });
  }

  /**
   * Clone missing repos and update existing ones.
   */
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
        const branchName = this.getBranchName(repo, issueNumber, title);
        const worktreePath = this.getWorktreePath(owner, repo, issueNumber, title);
        if (fs.existsSync(worktreePath)) {
          logger.info(`[RepoManager.createWorktree] Already exists: ${worktreePath}`);
          return { success: true, path: worktreePath };
        }
        const worktreesDir = path.join(repoPath, '.worktrees');
        fs.mkdirSync(worktreesDir, { recursive: true });
        const branchCheck = await this.runGit(repoPath, ['branch', '--list', branchName]);
        const branchExists = branchCheck.stdout.includes(branchName);
        const result = branchExists
          ? await this.runGit(repoPath, ['worktree', 'add', worktreePath, branchName])
          : await this.runGit(repoPath, ['worktree', 'add', '-b', branchName, worktreePath]);
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
      const fetchResult = await this.runGit(worktreePath, ['fetch', 'origin']);
      if (fetchResult.code !== 0) {
        const error = fetchResult.stderr || 'Fetch failed';
        logger.error(`[RepoManager.updateWorktree] Fetch error: ${error}`);
        return { success: false, error: error.substring(0, 100) };
      }
      const pullResult = await this.runGit(worktreePath, ['pull', '--rebase']);
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
          const removeResult = await this.runGit(repoPath, ['worktree', 'remove', '--force', worktreePath]);
          if (removeResult.code !== 0) {
            logger.warn(`[RepoManager.cleanupWorktree] Remove failed, trying manual`);
            try { fs.rmSync(worktreePath, { recursive: true, force: true }); }
            catch (e) { logger.error(`[RepoManager.cleanupWorktree] Manual remove failed: ${(e as Error).message}`); }
          }
        }
        const branchResult = await this.runGit(repoPath, ['branch', '-D', branchName]);
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
}

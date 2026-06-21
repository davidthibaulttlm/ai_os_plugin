/** ClaudeHarness — full lifecycle manager for Claude Code agent processes */

import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { logger } from './logger';
import type { RepoManager } from './repoManager';
import type { GraphQLClient } from './graphql';

/** Active agent session tracking */
export interface AgentSession {
  key: string;
  issueNumber: number;
  owner: string;
  repo: string;
  worktreePath: string;
  process: ChildProcess;
  status: 'running' | 'success' | 'failed';
  outputBuffer: string[];
  outputBufferLength: number; // Track cumulative length to avoid O(n²) join
  startTime: number;
  timeoutId?: ReturnType<typeof setTimeout>;
  reason?: string;
}

/** Result returned after an agent run completes */
export interface AgentResult {
  success: boolean;
  issueNumber: number;
  reason: string;
  prUrl?: string;
  error?: string;
}

/** Known error reasons for agent runs */
export type AgentError =
  | 'ALREADY_RUNNING'
  | 'WORKTREE_FAILED'
  | 'SPAWN_FAILED'
  | 'TIMEOUT'
  | 'MAX_TURNS_REACHED'
  | 'COMMIT_FAILED'
  | 'PUSH_FAILED'
  | 'CONCURRENT_LIMIT_REACHED';

/** Context passed to the harness for a single issue */
export interface IssueContext {
  issueNumber: number;
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  column: string;
}

/** Next column mapping for successful completion */
const NEXT_COLUMN_MAP: Record<string, string> = {
  AI_SPEC: 'HUMAN_SPEC_REVIEW',
  AI_CODE: 'HUMAN_CODE_REVIEW',
};

/** Minimal interface for posting messages to a webview */
interface WebviewPoster {
  postMessage(message: unknown): Thenable<boolean | undefined>;
}

/**
 * ClaudeHarness manages the full lifecycle of Claude Code agent processes:
 * worktree preparation, prompt building, process spawning, output streaming,
 * result parsing, and post-run actions (commit, push, PR, card move).
 */
export class ClaudeHarness {
  private sessions = new Map<string, AgentSession>();
  private repoManager: RepoManager;
  private graphql: GraphQLClient;
  private webview: WebviewPoster | undefined;
  private maxConcurrentAgents: number;
  private timeoutSeconds: number;

  /**
   * Create a new ClaudeHarness instance.
   * @param repoManager - RepoManager for worktree/git operations
   * @param graphql - GraphQLClient for PR creation and card moves
   * @param webview - Optional webview poster for output streaming
   */
  public constructor(
    repoManager: RepoManager,
    graphql: GraphQLClient,
    webview?: WebviewPoster
  ) {
    logger.info('[ClaudeHarness.constructor] Initializing ClaudeHarness');
    this.repoManager = repoManager;
    this.graphql = graphql;
    this.webview = webview;

    const config = vscode.workspace.getConfiguration('aiOs');
    this.maxConcurrentAgents = config.get<number>('maxConcurrentAgents', 3);
    this.timeoutSeconds = config.get<number>('autoWorkTimeoutSeconds', 1800);

    logger.info(`[ClaudeHarness.constructor] maxConcurrentAgents=${this.maxConcurrentAgents} timeoutSeconds=${this.timeoutSeconds}`);
    logger.info('[ClaudeHarness.constructor] Result: initialized');
  }

  /**
   * Set/update the webview reference for output streaming.
   */
  public setWebview(webview: WebviewPoster | undefined): void {
    logger.info('[ClaudeHarness.setWebview] Updating webview reference');
    this.webview = webview;
    logger.info('[ClaudeHarness.setWebview] Result: updated');
  }

  /**
   * Build a structured prompt from issue context.
   */
  public buildPrompt(ctx: IssueContext): string {
    logger.info(`[ClaudeHarness.buildPrompt] issueNumber=${ctx.issueNumber} column=${ctx.column}`);

    const maxBodyLen = 4096;
    let bodySection = '';
    if (ctx.body && ctx.body.length > 0) {
      let body = ctx.body;
      if (body.length > maxBodyLen) {
        // Truncate at newline boundary
        let truncPoint = body.lastIndexOf('\n', maxBodyLen - 1);
        if (truncPoint < 0) truncPoint = maxBodyLen;
        body = body.substring(0, truncPoint) + '\n[TRUNCATED]';
      }
      bodySection = `\n\n## Description\n${body}`;
    }

    let labelsSection = '';
    if (ctx.labels && ctx.labels.length > 0) {
      labelsSection = `\n\n## Labels\n${ctx.labels.join(', ')}`;
    }

    const columnInstructions = ctx.column === 'AI_SPEC'
      ? 'Write a detailed technical specification for this issue. Include architecture decisions, API contracts, and implementation plan.'
      : ctx.column === 'AI_CODE'
        ? 'Implement the code for this issue. Follow the specification if one exists. Write tests. Stage your changes with git add.'
        : 'Analyze this issue and prepare initial thoughts or a specification draft.';

    const prompt = `# Issue #${ctx.issueNumber}: ${ctx.title}${bodySection}${labelsSection}

## Column
${ctx.column}

## Instructions
${columnInstructions}

## Repository
${ctx.owner}/${ctx.repo}

## Rules
- Stage your changes with 'git add' when done
- Do NOT commit — the harness will commit after you finish
- Do NOT push — the harness will push after you finish
- Focus on the task at hand
- Keep changes minimal and scoped`;

    logger.info(`[ClaudeHarness.buildPrompt] Result: prompt length=${prompt.length}`);
    return prompt;
  }

  /**
   * Get a copy of active sessions for UI display.
   */
  public getActiveSessions(): Map<string, AgentSession> {
    logger.debug(`[ClaudeHarness.getActiveSessions] Active sessions: ${this.sessions.size}`);
    return new Map(this.sessions);
  }

  /**
   * Get buffered output for a specific issue (for replay on reconnect).
   */
  public getBufferedOutput(issueNumber: number): string[] {
    logger.info(`[ClaudeHarness.getBufferedOutput] issueNumber=${issueNumber}`);
    const session = Array.from(this.sessions.values()).find((s) => s.issueNumber === issueNumber);
    const output = session ? [...session.outputBuffer] : [];
    logger.info(`[ClaudeHarness.getBufferedOutput] Result: ${output.length} lines`);
    return output;
  }

  /**
   * Sanitize a commit message: replace newlines with spaces, escape quotes.
   */
  private sanitizeCommitMessage(message: string): string {
    return message.replace(/\n/g, ' ').replace(/"/g, '\\"');
  }

  /**
   * Validate worktree path contains only safe characters.
   */
  private isValidWorktreePath(worktreePath: string): boolean {
    const valid = /^[a-zA-Z0-9/_\-\.]+$/.test(worktreePath);
    logger.debug(`[ClaudeHarness.isValidWorktreePath] path=${worktreePath} valid=${valid}`);
    return valid;
  }

  /**
   * Post an agent output line to the webview via IPC.
   */
  private postAgentOutput(issueNumber: number, line: string): void {
    if (!this.webview) return;
    try {
      this.webview.postMessage({
        type: 'agentOutput',
        issueNumber,
        line,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`[ClaudeHarness.postAgentOutput] Error posting output: ${(error as Error).message}`);
    }
  }

  /**
   * Post an agent status update to the webview via IPC.
   */
  private postAgentStatus(issueNumber: number, status: 'running' | 'success' | 'failed', reason?: string): void {
    if (!this.webview) return;
    try {
      this.webview.postMessage({
        type: 'agentStatus',
        issueNumber,
        status,
        reason,
      });
    } catch (error) {
      logger.error(`[ClaudeHarness.postAgentStatus] Error posting status: ${(error as Error).message}`);
    }
  }

  /**
   * Main entry point — run the full agent lifecycle for an issue.
   */
  public async run(ctx: IssueContext): Promise<AgentResult> {
    const key = `${ctx.owner}:${ctx.repo}:${ctx.issueNumber}`;
    logger.info(`[ClaudeHarness.run] Starting for ${key}`);
    logger.info(`[ClaudeHarness.run] title=${ctx.title} column=${ctx.column}`);

    // Check duplicate spawn
    if (this.sessions.has(key)) {
      logger.warn(`[ClaudeHarness.run] Already running for ${key}`);
      this.postAgentStatus(ctx.issueNumber, 'failed', 'ALREADY_RUNNING');
      return { success: false, issueNumber: ctx.issueNumber, reason: 'ALREADY_RUNNING' };
    }

    // Check concurrent limit
    if (this.sessions.size >= this.maxConcurrentAgents) {
      logger.warn(`[ClaudeHarness.run] Concurrent limit reached (${this.sessions.size}/${this.maxConcurrentAgents})`);
      return {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'CONCURRENT_LIMIT_REACHED',
      };
    }

    // Prepare worktree
    logger.info(`[ClaudeHarness.run] Preparing worktree for ${ctx.owner}/${ctx.repo} #${ctx.issueNumber}`);
    const worktreeResult = await this.repoManager.createWorktree(
      ctx.owner,
      ctx.repo,
      ctx.issueNumber,
      ctx.title
    );

    if (!worktreeResult.success || !worktreeResult.path) {
      logger.error(`[ClaudeHarness.run] Worktree preparation failed: ${worktreeResult.error}`);
      return {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'WORKTREE_FAILED',
        error: worktreeResult.error,
      };
    }

    // Validate worktree path
    if (!this.isValidWorktreePath(worktreeResult.path)) {
      logger.error(`[ClaudeHarness.run] Invalid worktree path: ${worktreeResult.path}`);
      return {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'WORKTREE_FAILED',
        error: 'Invalid worktree path',
      };
    }

    // Update worktree to latest
    await this.repoManager.updateWorktree(worktreeResult.path);

    // Build prompt
    const prompt = this.buildPrompt(ctx);

    // Read Claude config
    const config = vscode.workspace.getConfiguration('aiOs');
    const maxTurns = config.get<number>('autoWorkMaxTurns', 25);
    const allowedTools = config.get<string>('autoWorkAllowedTools', '');

    // Spawn Claude
    logger.info(`[ClaudeHarness.run] Spawning Claude in ${worktreeResult.path}`);
    const token = await this.getGitHubToken();

    const args: string[] = ['-p', prompt, '--max-turns', String(maxTurns)];
    if (allowedTools) {
      args.push('--allowed-tools', allowedTools);
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GITHUB_TOKEN: token ?? '',
    };

    let child: ChildProcess;
    try {
      child = spawn('claude', args, {
        cwd: worktreeResult.path,
        env,
        shell: false,
      });
    } catch (error) {
      logger.error(`[ClaudeHarness.run] Spawn error: ${(error as Error).message}`);
      return {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'SPAWN_FAILED',
        error: (error as Error).message,
      };
    }

    // Timeout enforcement (create before session so we can store it)
    const timeoutId = setTimeout(() => {
      logger.warn(`[ClaudeHarness.run] Timeout (${this.timeoutSeconds}s) for ${key}`);
      child.kill('SIGTERM');
    }, this.timeoutSeconds * 1000);

    // Create session
    const session: AgentSession = {
      key,
      issueNumber: ctx.issueNumber,
      owner: ctx.owner,
      repo: ctx.repo,
      worktreePath: worktreeResult.path,
      process: child,
      status: 'running',
      outputBuffer: [],
      outputBufferLength: 0,
      startTime: Date.now(),
    };
    session.timeoutId = timeoutId;
    this.sessions.set(key, session);
    logger.info(`[ClaudeHarness.run] Session created for ${key}`);

    // Post running status
    this.postAgentStatus(ctx.issueNumber, 'running');

    // Output collection with backpressure
    const outputQueue: string[] = [];
    const MAX_QUEUE_SIZE = 500;

    const collectLine = (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.length === 0) continue;
        outputQueue.push(line);
        session.outputBuffer.push(line);
        session.outputBufferLength += line.length + 1; // +1 for newline

        // Keep buffer to last 10KB using tracked length (O(1) per line)
        while (session.outputBufferLength > 10240 && session.outputBuffer.length > 1) {
          const removed = session.outputBuffer.shift()!;
          session.outputBufferLength -= removed.length + 1;
        }

        // Backpressure: drop oldest if queue too large
        if (outputQueue.length > MAX_QUEUE_SIZE) {
          outputQueue.shift();
        }

        this.postAgentOutput(ctx.issueNumber, line);
      }
    };

    child.stdout?.on('data', collectLine);
    child.stderr?.on('data', collectLine);

    // Wait for exit
    const exitCode = await new Promise<number>((resolve) => {
      child.on('exit', (code) => resolve(code ?? -1));
      child.on('error', (error) => {
        logger.error(`[ClaudeHarness.run] Process error for ${key}: ${error.message}`);
        resolve(-1);
      });
    });

    clearTimeout(session.timeoutId);

    // Determine result
    let result: AgentResult;

    if (exitCode === 0) {
      logger.info(`[ClaudeHarness.run] Claude exited successfully for ${key}`);
      result = await this.handleSuccess(ctx, worktreeResult.path, key);
    } else if (exitCode === 143 || exitCode === -15) {
      // SIGTERM (timeout)
      logger.warn(`[ClaudeHarness.run] Claude killed by timeout for ${key}`);
      result = { success: false, issueNumber: ctx.issueNumber, reason: 'TIMEOUT' };
    } else {
      logger.warn(`[ClaudeHarness.run] Claude exited with code ${exitCode} for ${key}`);
      result = {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'MAX_TURNS_REACHED',
        error: `Exit code ${exitCode}`,
      };
    }

    // Update session status
    session.status = result.success ? 'success' : 'failed';
    session.reason = result.reason;

    // Post final status
    this.postAgentStatus(ctx.issueNumber, result.success ? 'success' : 'failed', result.reason);

    // Remove session
    this.sessions.delete(key);
    logger.info(`[ClaudeHarness.run] Session removed for ${key}. Result: success=${result.success} reason=${result.reason}`);

    return result;
  }

  /**
   * Handle successful Claude exit: commit, push, PR, move card.
   */
  private async handleSuccess(
    ctx: IssueContext,
    worktreePath: string,
    key: string
  ): Promise<AgentResult> {
    logger.info(`[ClaudeHarness.handleSuccess] Starting post-run pipeline for ${key}`);

    // Check for staged changes
    const hasChanges = await this.repoManager.hasStagedChanges(worktreePath);
    if (!hasChanges) {
      logger.warn(`[ClaudeHarness.handleSuccess] No staged changes in ${worktreePath}`);
      return { success: true, issueNumber: ctx.issueNumber, reason: 'No changes staged' };
    }

    // Commit
    const commitMessage = `ai-os: ${ctx.title} (#${ctx.issueNumber})`;
    const sanitizedMessage = this.sanitizeCommitMessage(commitMessage);
    const commitResult = await this.repoManager.commitWorktree(worktreePath, sanitizedMessage);
    if (!commitResult.success) {
      logger.error(`[ClaudeHarness.handleSuccess] Commit failed: ${commitResult.error}`);
      return {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'COMMIT_FAILED',
        error: commitResult.error,
      };
    }
    logger.info(`[ClaudeHarness.handleSuccess] Commit succeeded for ${key}`);

    // Push
    const branchName = this.repoManager.getBranchName(ctx.repo, ctx.issueNumber, ctx.title);
    const pushResult = await this.repoManager.pushWorktree(worktreePath, branchName);
    if (!pushResult.success) {
      logger.error(`[ClaudeHarness.handleSuccess] Push failed: ${pushResult.error}`);
      return {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'PUSH_FAILED',
        error: pushResult.error,
      };
    }
    logger.info(`[ClaudeHarness.handleSuccess] Push succeeded for ${key}`);

    // PR (best-effort)
    try {
      const prResult = await this.graphql.createPullRequest(
        await this.getRepositoryNodeId(ctx.owner, ctx.repo),
        branchName,
        await this.getDefaultBranch(ctx.owner, ctx.repo),
        commitMessage,
        `Auto-generated by AI OS for issue #${ctx.issueNumber}\n\n${ctx.body ?? ''}`
      );
      if (prResult.success && prResult.prUrl) {
        logger.info(`[ClaudeHarness.handleSuccess] PR created: ${prResult.prUrl}`);
        return { success: true, issueNumber: ctx.issueNumber, reason: 'Complete', prUrl: prResult.prUrl };
      } else {
        logger.warn(`[ClaudeHarness.handleSuccess] PR creation failed (best-effort): ${prResult.error}`);
      }
    } catch (error) {
      logger.warn(`[ClaudeHarness.handleSuccess] PR creation error (best-effort): ${(error as Error).message}`);
    }

    return { success: true, issueNumber: ctx.issueNumber, reason: 'Complete' };
  }

  /**
   * Get the default branch for a repo.
   */
  private async getDefaultBranch(owner: string, repo: string): Promise<string> {
    logger.info(`[ClaudeHarness.getDefaultBranch] owner=${owner} repo=${repo}`);
    try {
      const branch = await this.repoManager.detectDefaultBranch(owner, repo);
      logger.info(`[ClaudeHarness.getDefaultBranch] Result: ${branch}`);
      return branch;
    } catch (error) {
      logger.warn(`[ClaudeHarness.getDefaultBranch] Error: ${(error as Error).message}. Defaulting to main`);
      return 'main';
    }
  }

  /**
   * Get the GitHub token from environment.
   */
  private async getGitHubToken(): Promise<string | undefined> {
    logger.info('[ClaudeHarness.getGitHubToken] Retrieving GitHub token');
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      logger.info('[ClaudeHarness.getGitHubToken] Result: found in env');
      return token;
    }
    logger.warn('[ClaudeHarness.getGitHubToken] No token found in environment');
    return undefined;
  }

  /**
   * Get the repository GraphQL node ID.
   */
  private async getRepositoryNodeId(owner: string, repo: string): Promise<string> {
    logger.info(`[ClaudeHarness.getRepositoryNodeId] owner=${owner} repo=${repo}`);
    // Query the repository node ID via GraphQL with parameterized variables
    try {
      const result = await this.graphql.execute<{ repository: { id: string } }>(
        'query GetRepoId($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id } }',
        { owner, name: repo }
      );
      const id = result.repository?.id ?? '';
      logger.info(`[ClaudeHarness.getRepositoryNodeId] Result: ${id}`);
      return id;
    } catch (error) {
      logger.error(`[ClaudeHarness.getRepositoryNodeId] Error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Stop a single agent session by issue key.
   */
  public stop(issueKey: string): void {
    logger.info(`[ClaudeHarness.stop] Stopping session: ${issueKey}`);
    const session = this.sessions.get(issueKey);
    if (!session) {
      logger.warn(`[ClaudeHarness.stop] Session not found: ${issueKey}`);
      return;
    }
    session.process.kill('SIGTERM');
    session.status = 'failed';
    session.reason = 'Stopped by user';
    this.postAgentStatus(session.issueNumber, 'failed', 'Stopped by user');
    this.sessions.delete(issueKey);
    logger.info(`[ClaudeHarness.stop] Result: session ${issueKey} stopped`);
  }

  /**
   * Stop all active agent sessions.
   */
  public stopAll(): void {
    logger.info(`[ClaudeHarness.stopAll] Stopping all ${this.sessions.size} sessions`);
    for (const [key, session] of this.sessions) {
      try {
        session.process.kill('SIGTERM');
        session.status = 'failed';
        session.reason = 'Extension deactivated';
        this.postAgentStatus(session.issueNumber, 'failed', 'Extension deactivated');
        logger.info(`[ClaudeHarness.stopAll] Killed session: ${key}`);
      } catch (error) {
        logger.error(`[ClaudeHarness.stopAll] Error killing ${key}: ${(error as Error).message}`);
      }
    }
    this.sessions.clear();
    logger.info('[ClaudeHarness.stopAll] Result: all sessions stopped');
  }
}

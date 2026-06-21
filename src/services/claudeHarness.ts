/** ClaudeHarness — full lifecycle manager for Claude Code agent processes */

import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { logger } from './logger';
import type { RepoManager } from './repoManager';
import type { GraphQLClient } from './graphql';
import type { AgentSession, AgentResult, IssueContext, WebviewPoster } from './claudeHarness.types';
import { runPostRunPipeline } from './claudeHarness.pipeline';

/** Next column mapping for successful completion */
const _NEXT_COLUMN_MAP: Record<string, string> = {
  AI_SPEC: 'HUMAN_SPEC_REVIEW',
  AI_CODE: 'HUMAN_CODE_REVIEW',
};

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

  public setWebview(webview: WebviewPoster | undefined): void {
    logger.info('[ClaudeHarness.setWebview] Updating webview reference');
    this.webview = webview;
    logger.info('[ClaudeHarness.setWebview] Result: updated');
  }

  public buildPrompt(ctx: IssueContext): string {
    logger.info(`[ClaudeHarness.buildPrompt] issueNumber=${ctx.issueNumber} column=${ctx.column}`);

    const maxBodyLen = 4096;
    let bodySection = '';
    if (ctx.body && ctx.body.length > 0) {
      let body = ctx.body;
      if (body.length > maxBodyLen) {
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

  public getActiveSessions(): Map<string, AgentSession> {
    logger.debug(`[ClaudeHarness.getActiveSessions] Active sessions: ${this.sessions.size}`);
    return new Map(this.sessions);
  }

  public getBufferedOutput(issueNumber: number): string[] {
    logger.info(`[ClaudeHarness.getBufferedOutput] issueNumber=${issueNumber}`);
    const session = Array.from(this.sessions.values()).find((s) => s.issueNumber === issueNumber);
    const output = session ? [...session.outputBuffer] : [];
    logger.info(`[ClaudeHarness.getBufferedOutput] Result: ${output.length} lines`);
    return output;
  }

  private sanitizeCommitMessage(message: string): string {
    return message.replace(/\n/g, ' ').replace(/"/g, '\\"');
  }

  private isValidWorktreePath(worktreePath: string): boolean {
    const valid = /^[a-zA-Z0-9/_\-.]+$/.test(worktreePath);
    logger.debug(`[ClaudeHarness.isValidWorktreePath] path=${worktreePath} valid=${valid}`);
    return valid;
  }

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

  public async run(ctx: IssueContext): Promise<AgentResult> {
    const key = `${ctx.owner}:${ctx.repo}:${ctx.issueNumber}`;
    logger.info(`[ClaudeHarness.run] Starting for ${key}`);
    logger.info(`[ClaudeHarness.run] title=${ctx.title} column=${ctx.column}`);

    if (this.sessions.has(key)) {
      logger.warn(`[ClaudeHarness.run] Already running for ${key}`);
      this.postAgentStatus(ctx.issueNumber, 'failed', 'ALREADY_RUNNING');
      return { success: false, issueNumber: ctx.issueNumber, reason: 'ALREADY_RUNNING' };
    }

    if (this.sessions.size >= this.maxConcurrentAgents) {
      logger.warn(`[ClaudeHarness.run] Concurrent limit reached (${this.sessions.size}/${this.maxConcurrentAgents})`);
      return {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'CONCURRENT_LIMIT_REACHED',
      };
    }

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

    if (!this.isValidWorktreePath(worktreeResult.path)) {
      logger.error(`[ClaudeHarness.run] Invalid worktree path: ${worktreeResult.path}`);
      return {
        success: false,
        issueNumber: ctx.issueNumber,
        reason: 'WORKTREE_FAILED',
        error: 'Invalid worktree path',
      };
    }

    await this.repoManager.updateWorktree(worktreeResult.path);

    const prompt = this.buildPrompt(ctx);

    logger.info(`[ClaudeHarness.run] Spawning Claude in ${worktreeResult.path}`);
    const token = await this.getGitHubToken();

    const args: string[] = ['-p', prompt];
    logger.info(`[ClaudeHarness.run] CLI args: ${args.join(' ')}`);

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

    const timeoutId = setTimeout(() => {
      logger.warn(`[ClaudeHarness.run] Timeout (${this.timeoutSeconds}s) for ${key}`);
      child.kill('SIGTERM');
    }, this.timeoutSeconds * 1000);

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

    this.postAgentStatus(ctx.issueNumber, 'running');

    const outputQueue: string[] = [];
    const MAX_QUEUE_SIZE = 500;

    const collectLine = (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.length === 0) continue;
        outputQueue.push(line);
        session.outputBuffer.push(line);
        session.outputBufferLength += line.length + 1;

        while (session.outputBufferLength > 10240 && session.outputBuffer.length > 1) {
          const removed = session.outputBuffer.shift()!;
          session.outputBufferLength -= removed.length + 1;
        }

        if (outputQueue.length > MAX_QUEUE_SIZE) {
          outputQueue.shift();
        }

        this.postAgentOutput(ctx.issueNumber, line);
      }
    };

    child.stdout?.on('data', collectLine);
    child.stderr?.on('data', collectLine);

    const exitCode = await new Promise<number>((resolve) => {
      child.on('exit', (code) => resolve(code ?? -1));
      child.on('error', (error) => {
        logger.error(`[ClaudeHarness.run] Process error for ${key}: ${error.message}`);
        resolve(-1);
      });
    });

    clearTimeout(session.timeoutId);

    let result: AgentResult;

    if (exitCode === 0) {
      logger.info(`[ClaudeHarness.run] Claude exited successfully for ${key}`);
      result = await runPostRunPipeline(ctx, worktreeResult.path, key, this.repoManager, this.graphql);
    } else if (exitCode === 143 || exitCode === -15) {
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

    session.status = result.success ? 'success' : 'failed';
    session.reason = result.reason;

    this.postAgentStatus(ctx.issueNumber, result.success ? 'success' : 'failed', result.reason);

    this.sessions.delete(key);
    logger.info(`[ClaudeHarness.run] Session removed for ${key}. Result: success=${result.success} reason=${result.reason}`);

    return result;
  }

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

// Re-export types for consumers
export type { AgentSession, AgentResult, IssueContext, WebviewPoster } from './claudeHarness.types';
export { AgentError } from './claudeHarness.types';

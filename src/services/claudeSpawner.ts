/**
 * Claude Spawner — spawns `claude -p` child processes for auto-work.
 * @deprecated Use ClaudeHarness instead. Kept for backward compatibility.
 */

import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { logger } from './logger';

export interface ClaudeProcessEntry {
  process: ChildProcess;
  outputChannel: vscode.OutputChannel;
  startTime: number;
}

/** Map of issue number -> active Claude process */
const activeProcesses = new Map<number, ClaudeProcessEntry>();

/** Optional callback to notify the webview about working status changes */
let workingStatusCallback: ((issueNumber: number, active: boolean) => void) | undefined;

/** Optional callback called when Claude process exits — used to trigger finishAgent */
let onFinishCallback: ((issueNumber: number) => void) | undefined;

export function setOnFinishCallback(cb: (issueNumber: number) => void): void {
  onFinishCallback = cb;
}

export function setWorkingStatusCallback(cb: (issueNumber: number, active: boolean) => void): void {
  workingStatusCallback = cb;
}

/**
 * Spawn Claude Code to work on an issue.
 * Returns true if spawned, false if already working on this issue.
 */
export function spawnClaude(
  issueNumber: number,
  prompt: string,
  options: {
    cwd: string;
    githubToken: string;
  }
): boolean {
  logger.info(`[claudeSpawner.spawnClaude] Starting for #${issueNumber} cwd=${options.cwd}`);
  // Prevent concurrent processes for the same issue
  if (activeProcesses.has(issueNumber)) {
    logger.warn(`[claudeSpawner.spawnClaude] Already working on issue #${issueNumber} — skipping duplicate trigger`);
    return false;
  }

  const outputChannel = vscode.window.createOutputChannel(`AI OS - Claude #${issueNumber}`);

  const args = [
    '-p', prompt,
  ];
  logger.info(`[claudeSpawner.spawnClaude] CLI args: ${args.join(' ')}`);

  // SECURITY: Do NOT spread process.env — only include minimum required vars.
  // This prevents leaking parent-process secrets (AWS keys, other tokens) to the child.
  // GITHUB_TOKEN is still visible in /proc/{pid}/environ; use fine-grained PATs with minimal scopes.
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    GITHUB_TOKEN: options.githubToken,
  };

  const child = spawn('claude', args, {
    cwd: options.cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data: Buffer) => {
    outputChannel.append(data.toString());
  });

  child.stderr.on('data', (data: Buffer) => {
    outputChannel.append(data.toString());
  });

  child.on('exit', (code) => {
    activeProcesses.delete(issueNumber);
    workingStatusCallback?.(issueNumber, false);

    if (code === 0) {
      vscode.window.showInformationMessage(
        `Claude completed work on #${issueNumber}`,
        'Review Changes'
      ).then((selection) => {
        if (selection === 'Review Changes') {
          outputChannel.show();
        }
      });
    } else {
      vscode.window.showWarningMessage(
        `Claude exited with code ${code} on #${issueNumber}`
      );
    }

    logger.info(`Claude process for #${issueNumber} exited with code ${code}`);

    // Notify agent service that Claude finished — it will clear WIP and auto-trigger next issue
    onFinishCallback?.(issueNumber);
  });

  child.on('error', (error) => {
    activeProcesses.delete(issueNumber);
    workingStatusCallback?.(issueNumber, false);
    logger.error(`Claude process error for #${issueNumber}: ${error.message}`);
    vscode.window.showErrorMessage(`Failed to start Claude: ${error.message}`);

    // On error, still clear WIP so the agent can work on the next issue
    onFinishCallback?.(issueNumber);
  });

  activeProcesses.set(issueNumber, {
    process: child,
    outputChannel,
    startTime: Date.now(),
  });

  workingStatusCallback?.(issueNumber, true);
  logger.info(`[claudeSpawner.spawnClaude] Spawned Claude for #${issueNumber}`);
  logger.info(`[claudeSpawner.spawnClaude] Result: success=true`);
  return true;
}

/**
 * Kill all active Claude processes.
 */
export function killAllClaudeProcesses(): void {
  for (const [issueNumber, entry] of activeProcesses) {
    entry.process.kill();
    entry.outputChannel.appendLine(`[AI OS] Claude process killed for #${issueNumber}`);
    logger.info(`Killed Claude process for #${issueNumber}`);
  }
  activeProcesses.clear();
}

/**
 * Get the set of issue numbers currently being worked on.
 */
export function getWorkingIssues(): Set<number> {
  return new Set(activeProcesses.keys());
}

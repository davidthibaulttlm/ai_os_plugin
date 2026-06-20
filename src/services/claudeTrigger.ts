/**
 * Claude Trigger — delta detection for assignee changes and column moves.
 * Emits events when issues should trigger auto-work.
 */

import * as vscode from 'vscode';
import { spawnClaude, getWorkingIssues } from './claudeSpawner';
import { logger } from './logger';

export interface TriggerEvent {
  issueNumber: number;
  title: string;
  body?: string;
  labels?: string[];
  column: string;
  reason: 'assigned' | 'column_move';
}

/** Callback for trigger events */
export type TriggerCallback = (event: TriggerEvent) => void;

/**
 * ClaudeTrigger — detects when issues should trigger Claude auto-work.
 */
export class ClaudeTrigger {
  private callback: TriggerCallback | undefined;
  private currentUser: string | undefined;

  setCallback(cb: TriggerCallback): void {
    this.callback = cb;
  }

  setCurrentUser(username: string): void {
    this.currentUser = username;
  }

  /**
   * Check if an issue should trigger Claude auto-work.
   */
  public checkTrigger(event: TriggerEvent): void {
    if (!this.callback) return;

    const config = vscode.workspace.getConfiguration('aiOs');
    const autoWorkEnabled = config.get<boolean>('autoWorkAssignments', false);

    if (!autoWorkEnabled) {
      logger.info(`Auto-work disabled — skipping trigger for #${event.issueNumber}`);
      return;
    }

    // Check if already working on this issue
    if (getWorkingIssues().has(event.issueNumber)) {
      logger.warn(`Already working on #${event.issueNumber} — skipping`);
      return;
    }

    this.callback(event);
  }

  /**
   * Handle a trigger event — show confirmation and spawn Claude.
   */
  public async handleTrigger(event: TriggerEvent, githubToken: string, workspaceRoot: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('aiOs');
    const confirmFirst = config.get<boolean>('autoWorkConfirmFirst', true);
    const maxTurns = config.get<number>('autoWorkMaxTurns', 50);
    const allowedTools = config.get<string>('autoWorkAllowedTools', 'Read,Edit,Bash');

    const prompt = this.buildPrompt(event);

    if (confirmFirst) {
      const selection = await vscode.window.showInformationMessage(
        `Starting work on #${event.issueNumber}: ${event.title}`,
        'Proceed',
        'Dismiss'
      );

      if (selection !== 'Proceed') {
        logger.info(`User dismissed trigger for #${event.issueNumber}`);
        return;
      }
    }

    spawnClaude(event.issueNumber, prompt, {
      cwd: workspaceRoot,
      githubToken,
      allowedTools,
      maxTurns,
    });
  }

  /**
   * Build a structured prompt from issue details.
   */
  private buildPrompt(event: TriggerEvent): string {
    const parts = [
      `You are working on issue #${event.issueNumber} in column "${event.column}".`,
      `Title: ${event.title}`,
    ];

    if (event.body) {
      parts.push(`Description:\n${event.body}`);
    }

    if (event.labels && event.labels.length > 0) {
      parts.push(`Labels: ${event.labels.join(', ')}`);
    }

    parts.push('');
    parts.push('INSTRUCTIONS:');
    parts.push('- Make the necessary code changes to address this issue');
    parts.push('- Stage your changes with git add when done');
    parts.push('- DO NOT commit — leave the changes staged for review');
    parts.push('- DO NOT push to the remote repository');

    return parts.join('\n');
  }
}

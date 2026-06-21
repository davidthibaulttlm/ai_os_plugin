/**
 * Claude Trigger — delta detection for assignee changes and column moves.
 * Emits events when issues should trigger auto-work.
 */

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
   * Always triggers — no config checks, no restrictions.
   */
  public checkTrigger(event: TriggerEvent): void {
    logger.info(`[ClaudeTrigger.checkTrigger] Starting for #${event.issueNumber}`);
    if (!this.callback) {
      logger.warn('[ClaudeTrigger.checkTrigger] No callback set');
      return;
    }

    // Check if already working on this issue
    if (getWorkingIssues().has(event.issueNumber)) {
      logger.warn(`[ClaudeTrigger.checkTrigger] Already working on #${event.issueNumber} — skipping`);
      return;
    }

    logger.info(`[ClaudeTrigger.checkTrigger] Triggering callback for #${event.issueNumber}`);
    this.callback(event);
  }

  /**
   * Handle a trigger event — spawn Claude immediately with no restrictions.
   * No confirmation dialog, no turn caps, no tool restrictions.
   */
  public async handleTrigger(event: TriggerEvent, githubToken: string, workspaceRoot: string): Promise<void> {
    logger.info(`[ClaudeTrigger.handleTrigger] Starting for #${event.issueNumber} title=${event.title}`);
    const prompt = this.buildPrompt(event);

    logger.info(`[ClaudeTrigger.handleTrigger] Spawning Claude for #${event.issueNumber} in ${workspaceRoot}`);
    spawnClaude(event.issueNumber, prompt, {
      cwd: workspaceRoot,
      githubToken,
    });
    logger.info(`[ClaudeTrigger.handleTrigger] Result: Claude spawned for #${event.issueNumber}`);
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
      // Truncate body to prevent prompt injection and token bloat
      const maxBodyLength = 4096;
      const body = event.body.length > maxBodyLength
        ? event.body.substring(0, maxBodyLength) + '\n\n[TRUNCATED — original body exceeded ' + event.body.length + ' characters]'
        : event.body;
      parts.push(`Description:\n${body}`);
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

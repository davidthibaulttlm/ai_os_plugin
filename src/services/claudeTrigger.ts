/**
 * Claude Trigger — delta detection for assignee changes and column moves.
 * Emits events when issues should trigger auto-work.
 */

import { spawnClaude, getWorkingIssues } from './claudeSpawner';
import { logger } from './logger';
import type { ColumnPromptService } from './columnPrompt';

export interface TriggerEvent {
  issueNumber: number;
  title: string;
  body?: string;
  labels?: string[];
  column: string;
  reason: 'assigned' | 'column_move';
  owner?: string;
  repo?: string;
}

/** Callback for trigger events */
export type TriggerCallback = (event: TriggerEvent) => void;

/**
 * ClaudeTrigger — detects when issues should trigger Claude auto-work.
 */
export class ClaudeTrigger {
  private callback: TriggerCallback | undefined;
  private currentUser: string | undefined;
  private promptService: ColumnPromptService | undefined;

  public constructor(promptService?: ColumnPromptService) {
    logger.info('[ClaudeTrigger.constructor] Initializing ClaudeTrigger');
    this.promptService = promptService;
    logger.info('[ClaudeTrigger.constructor] Result: initialized');
  }

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
    logger.info(`[ClaudeTrigger.buildPrompt] issueNumber=${event.issueNumber} column=${event.column}`);

    let bodySection = '';
    if (event.body && event.body.length > 0) {
      bodySection = `\n\nDescription:\n${event.body}`;
    }

    let labelsSection = '';
    if (event.labels && event.labels.length > 0) {
      labelsSection = `\n\nLabels: ${event.labels.join(', ')}`;
    }

    const userContent = `# Issue #${event.issueNumber}: ${event.title}${bodySection}${labelsSection}

## Column
${event.column}

## Rules
- Stage your changes with 'git add' when done
- Do NOT commit — the harness will commit after you finish
- Do NOT push — the harness will push after you finish
- Focus on the task at hand
- Keep changes minimal and scoped`;

    let prompt: string;
    if (this.promptService) {
      prompt = this.promptService.assemblePromptChain(event.column, userContent, event.owner, event.repo);
    } else {
      // Fallback: inline system instruction if no prompt service available
      const fallbackSystem = event.column === 'AI_SPEC'
        ? 'You are an expert software architect and technical writer.'
        : event.column === 'AI_CODE'
          ? 'You are a senior software engineer implementing code changes.'
          : '';
      prompt = fallbackSystem ? `${fallbackSystem}\n\n${userContent}` : userContent;
    }

    logger.info(`[ClaudeTrigger.buildPrompt] Result: prompt length=${prompt.length}`);
    return prompt;
  }
}

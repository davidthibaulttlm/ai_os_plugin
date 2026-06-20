/** AI Agent trigger service */

import type { GraphQLClient } from './graphql';
import { logger } from './logger';

/** Agent trigger hook callback */
export type AgentTriggerCallback = (issueId: string, columnName: string) => Promise<void>;

/**
 * AI Agent trigger service.
 * Handles triggering AI agents when issues enter AI_SPEC or AI_CODE columns.
 */
export class AgentService {
  private callback: AgentTriggerCallback | undefined;
  private activeAgents = new Map<string, AbortController>();

  /**
   * Set the callback for agent triggers.
   */
  public setCallback(callback: AgentTriggerCallback): void {
    this.callback = callback;
  }

  /**
   * Trigger the AI agent for an issue entering a specific column.
   * Only triggers for AI_SPEC and AI_CODE columns.
   */
  public async onAgentTrigger(issueId: string, columnName: string): Promise<void> {
    if (!AI_TRIGGER_COLUMNS.has(columnName)) {
      return;
    }

    // Cancel any existing agent for this issue
    this.cancelAgent(issueId);

    const abortController = new AbortController();
    this.activeAgents.set(issueId, abortController);

    if (this.callback) {
      await this.callback(issueId, columnName);
    }

    this.activeAgents.delete(issueId);
  }

  /**
   * Cancel in-progress agent work for a specific issue.
   */
  public cancelAgent(issueId: string): void {
    const controller = this.activeAgents.get(issueId);
    if (controller) {
      controller.abort();
      this.activeAgents.delete(issueId);
      logger.debug(`Cancelled agent for issue #${issueId}`);
    }
  }

  /**
   * Assign agent to a specific issue.
   */
  public async assignAgent(graphql: GraphQLClient, issueId: string): Promise<void> {
    void graphql;
    void issueId;
  }
}

/** Columns that trigger AI agent */
const AI_TRIGGER_COLUMNS = new Set(['AI_SPEC', 'AI_CODE']);

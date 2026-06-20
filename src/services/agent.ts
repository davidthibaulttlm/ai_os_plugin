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
    logger.info('[AgentService.setCallback] Setting agent trigger callback');
    this.callback = callback;
  }

  /**
   * Trigger the AI agent for an issue entering a specific column.
   * Only triggers for AI_SPEC and AI_CODE columns.
   */
  public async onAgentTrigger(issueId: string, columnName: string): Promise<void> {
    logger.info(`[AgentService.onAgentTrigger] issueId=${issueId} columnName=${columnName}`);

    if (!AI_TRIGGER_COLUMNS.has(columnName)) {
      logger.info(`[AgentService.onAgentTrigger] Column ${columnName} is not a trigger column, skipping`);
      return;
    }

    // Cancel any existing agent for this issue
    this.cancelAgent(issueId);

    const abortController = new AbortController();
    this.activeAgents.set(issueId, abortController);
    logger.info(`[AgentService.onAgentTrigger] Abort controller registered for issue #${issueId}`);

    if (this.callback) {
      logger.info(`[AgentService.onAgentTrigger] Invoking callback for issue #${issueId} in ${columnName}`);
      try {
        await this.callback(issueId, columnName);
        logger.info(`[AgentService.onAgentTrigger] Callback completed for issue #${issueId}`);
      } catch (error) {
        logger.error(`[AgentService.onAgentTrigger] Error in callback for issue #${issueId}: ${(error as Error).message}`);
      }
    } else {
      logger.warn('[AgentService.onAgentTrigger] No callback registered');
    }

    this.activeAgents.delete(issueId);
    logger.info(`[AgentService.onAgentTrigger] Cleaned up abort controller for issue #${issueId}`);
  }

  /**
   * Cancel in-progress agent work for a specific issue.
   */
  public cancelAgent(issueId: string): void {
    logger.info(`[AgentService.cancelAgent] Cancelling agent for issue #${issueId}`);
    const controller = this.activeAgents.get(issueId);
    if (controller) {
      controller.abort();
      this.activeAgents.delete(issueId);
      logger.info(`[AgentService.cancelAgent] Agent cancelled for issue #${issueId}`);
    } else {
      logger.info(`[AgentService.cancelAgent] No active agent found for issue #${issueId}`);
    }
  }

  /**
   * Assign agent to a specific issue.
   */
  public async assignAgent(graphql: GraphQLClient, issueId: string): Promise<void> {
    logger.info(`[AgentService.assignAgent] Assigning agent to issue #${issueId}`);
    void graphql;
    void issueId;
    logger.info(`[AgentService.assignAgent] Implementation pending for issue #${issueId}`);
  }
}

/** Columns that trigger AI agent */
const AI_TRIGGER_COLUMNS = new Set(['AI_SPEC', 'AI_CODE']);

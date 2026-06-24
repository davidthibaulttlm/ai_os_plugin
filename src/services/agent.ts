/** AI Agent prioritizer service */

import type { GraphQLClient } from './graphql';
import { logger } from './logger';

/** Options passed to the agent trigger callback */
export interface AgentTriggerOptions {
  issueId: string;
  columnName: string;
  title?: string;
  body?: string;
  owner?: string;
  repo?: string;
  worktreePath?: string;
}

/** Agent trigger hook callback */
export type AgentTriggerCallback = (options: AgentTriggerOptions) => Promise<void>;

/** AI-eligible columns for agent work */
export const AI_ELIGIBLE_COLUMNS = ['AI_CODE', 'AI_SPEC', 'BRAIN_DUMP'] as const;

/** Human-only columns — agent NEVER touches these */
export const HUMAN_COLUMNS = ['HUMAN_SPEC_REVIEW', 'HUMAN_CODE_REVIEW', 'PR_DONE'] as const;

/** Board item for prioritizer */
export interface PrioritizerItem {
  id: number;
  projectItemId: string;
  title: string;
  status: string;
  labels: string[];
  assignees: { login: string; avatarUrl: string }[];
  body?: string;
  owner?: string;
  repo?: string;
}

/** Result from selectNextIssue */
export interface PrioritizerSelection {
  issueId: number;
  title: string;
  column: string;
}

/** Result from finishAgent indicating what happened after completion */
export interface FinishAgentResult {
  /** Reason when no next issue was auto-triggered */
  reason?: 'no_assigned_issues' | 'same_issue' | 'none';
}

/**
 * AI Agent prioritizer service.
 * Selects the next issue based on deterministic priority rules:
 * 1. Bugs break WIP limit
 * 2. Column priority: AI_CODE > AI_SPEC > BRAIN_DUMP
 * 3. Top card = highest priority within column
 * 4. Auto-move from BRAIN_DUMP to AI_SPEC
 */
export class AgentService {
  private callback: AgentTriggerCallback | undefined;
  private currentWip: string | null = null;
  private bugWipSet = new Set<string>();
  private boardItems: PrioritizerItem[] = [];
  private graphql: GraphQLClient | undefined;
  private projectId: string | undefined;
  private currentUser: string | undefined;

  /**
   * Set the callback for agent triggers.
   */
  public setCallback(callback: AgentTriggerCallback): void {
    logger.info('[AgentService.setCallback] Setting agent trigger callback');
    this.callback = callback;
  }

  /**
   * Store board state snapshot (called by poller after each poll).
   */
  public setBoardState(items: PrioritizerItem[]): void {
    logger.info(`[AgentService.setBoardState] Storing ${items.length} board items`);
    this.boardItems = items;
  }

  /**
   * Store GraphQL client for mutations.
   */
  public setGraphql(client: GraphQLClient): void {
    logger.info('[AgentService.setGraphql] Setting GraphQL client');
    this.graphql = client;
  }

  /**
   * Store project ID for mutations.
   */
  public setProjectId(id: string): void {
    logger.info(`[AgentService.setProjectId] Setting projectId=${id}`);
    this.projectId = id;
  }

  /**
   * Store current user login for assignee filtering.
   */
  public setCurrentUser(login: string): void {
    logger.info(`[AgentService.setCurrentUser] Setting currentUser=${login}`);
    this.currentUser = login;
  }

  /**
   * Check if agent is currently busy.
   */
  public isBusy(): boolean {
    const busy = this.currentWip !== null || this.bugWipSet.size > 0;
    logger.debug(`[AgentService.isBusy] currentWip=${this.currentWip} bugWipSet=${Array.from(this.bugWipSet).join(', ')} -> ${busy}`);
    return busy;
  }

  /**
   * Get current WIP issue ID.
   */
  public getCurrentWip(): string | null {
    logger.debug(`[AgentService.getCurrentWip] currentWip=${this.currentWip}`);
    return this.currentWip;
  }

  /**
   * Check if any label includes "bug" (case-insensitive).
   */
  public static isBug(labels: string[]): boolean {
    const hasBug = labels.some((l) => l.toLowerCase().includes('bug'));
    logger.debug(`[AgentService.isBug] labels=${labels.join(', ')} -> ${hasBug}`);
    return hasBug;
  }

  /**
   * Prioritizer logic — select the next issue to work on.
   * Returns null if no issue should be started (busy or empty).
   */
  public selectNextIssue(): PrioritizerSelection | null {
    logger.info('[AgentService.selectNextIssue] Running prioritizer');
    logger.info(`[AgentService.selectNextIssue] currentWip=${this.currentWip} boardItems=${this.boardItems.length}`);

    // Filter to AI-eligible columns only
    let eligible = this.boardItems.filter(
      (item) => AI_ELIGIBLE_COLUMNS.includes(item.status as typeof AI_ELIGIBLE_COLUMNS[number])
    );
    logger.info(`[AgentService.selectNextIssue] ${eligible.length} items in AI-eligible columns`);

    // Filter to issues assigned to current user only
    if (this.currentUser) {
      const before = eligible.length;
      eligible = eligible.filter(
        (item) => item.assignees?.some((a) => a.login === this.currentUser)
      );
      logger.info(`[AgentService.selectNextIssue] Filtered ${before} -> ${eligible.length} items assigned to ${this.currentUser}`);
    } else {
      logger.warn('[AgentService.selectNextIssue] No currentUser set — skipping assignee filter');
    }

    // Scan eligible columns for bugs first
    const bugs = eligible.filter((item) => AgentService.isBug(item.labels));
    if (bugs.length > 0) {
      // Pick bug from highest-priority column
      for (const col of AI_ELIGIBLE_COLUMNS) {
        const bugInCol = bugs.find((b) => b.status === col);
        if (bugInCol) {
          logger.info(`[AgentService.selectNextIssue] Bug found: #${bugInCol.id} "${bugInCol.title}" in ${col}`);
          return { issueId: bugInCol.id, title: bugInCol.title, column: col };
        }
      }
    }

    // If busy and no bug found → return null
    if (this.currentWip !== null) {
      logger.info(`[AgentService.selectNextIssue] Busy (WIP=#${this.currentWip}), no bugs — returning null`);
      return null;
    }

    // Scan columns in priority order, return top card
    for (const col of AI_ELIGIBLE_COLUMNS) {
      const itemsInCol = eligible.filter((item) => item.status === col);
      if (itemsInCol.length > 0) {
        const top = itemsInCol[0];
        logger.info(`[AgentService.selectNextIssue] Selected: #${top.id} "${top.title}" from ${col}`);
        return { issueId: top.id, title: top.title, column: col };
      }
    }

    logger.info('[AgentService.selectNextIssue] No issues available');
    return null;
  }

  /**
   * Auto-move an issue from BRAIN_DUMP to AI_SPEC via GraphQL mutation.
   */
  public async autoMoveFromBrainDump(issueId: number): Promise<boolean> {
    logger.info(`[AgentService.autoMoveFromBrainDump] Moving #${issueId} from BRAIN_DUMP to AI_SPEC`);

    if (!this.graphql) {
      logger.error('[AgentService.autoMoveFromBrainDump] No GraphQL client available');
      return false;
    }

    if (!this.projectId) {
      logger.error('[AgentService.autoMoveFromBrainDump] No projectId set');
      return false;
    }

    // Find the item's project-level ID (GraphQL node ID, not issue number)
    const item = this.boardItems.find((i) => i.id === issueId && i.status === 'BRAIN_DUMP');
    if (!item) {
      logger.warn(`[AgentService.autoMoveFromBrainDump] Issue #${issueId} not found in BRAIN_DUMP`);
      return false;
    }

    try {
      // Use projectItemId (GraphQL node ID) for the mutation, not issue number
      const ok = await this.graphql.moveToColumn(this.projectId, item.projectItemId, 'AI_SPEC');
      if (ok) {
        logger.info(`[AgentService.autoMoveFromBrainDump] Successfully moved #${issueId} to AI_SPEC`);
      } else {
        logger.error(`[AgentService.autoMoveFromBrainDump] Failed to move #${issueId}`);
      }
      return ok;
    } catch (error) {
      logger.error(`[AgentService.autoMoveFromBrainDump] Error moving #${issueId}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Main entry point — start the agent for the next prioritized issue.
   */
  public async startAgent(): Promise<{ started: boolean; issueId?: number; reason?: string }> {
    logger.info('[AgentService.startAgent] Starting agent flow');

    const selection = this.selectNextIssue();

    if (!selection) {
      const reason = this.currentWip !== null ? 'busy' : (this.currentUser ? 'no_assigned_issues' : 'empty');
      logger.info(`[AgentService.startAgent] No selection — reason: ${reason}`);
      return { started: false, reason };
    }

    const { issueId, title, column } = selection;
    logger.info(`[AgentService.startAgent] Selected #${issueId} "${title}" in ${column}`);

    // Auto-move from BRAIN_DUMP to AI_SPEC if needed
    if (column === 'BRAIN_DUMP') {
      logger.info(`[AgentService.startAgent] Issue #${issueId} in BRAIN_DUMP — auto-moving to AI_SPEC`);
      const moved = await this.autoMoveFromBrainDump(issueId);
      if (!moved) {
        logger.error(`[AgentService.startAgent] Auto-move failed for #${issueId} — aborting`);
        return { started: false, issueId, reason: 'auto_move_failed' };
      }
    }

    // Set WIP (bugs bypass WIP limit but are still tracked)
    const isBug = AgentService.isBug(
      this.boardItems.find((i) => i.id === issueId)?.labels ?? []
    );
    if (!isBug) {
      this.currentWip = String(issueId);
      logger.info(`[AgentService.startAgent] WIP set to #${issueId}`);
    } else {
      this.bugWipSet.add(String(issueId));
      logger.info(`[AgentService.startAgent] Bug WIP tracked: #${issueId} (active bug WIPs: ${Array.from(this.bugWipSet).join(', ')})`);
    }

    // Invoke callback
    if (this.callback) {
      const targetColumn = column === 'BRAIN_DUMP' ? 'AI_SPEC' : column;
      const selectedItem = this.boardItems.find((i) => i.id === issueId);
      const itemTitle = selectedItem?.title;
      const itemBody = selectedItem?.body;
      const itemOwner = selectedItem?.owner;
      const itemRepo = selectedItem?.repo;
      logger.info(`[AgentService.startAgent] Invoking callback for #${issueId} in ${targetColumn} title=${itemTitle} body=${itemBody ? 'present' : 'empty'} owner=${itemOwner} repo=${itemRepo}`);
      try {
        await this.callback({ issueId: String(issueId), columnName: targetColumn, title: itemTitle, body: itemBody, owner: itemOwner, repo: itemRepo });
        logger.info(`[AgentService.startAgent] Callback completed for #${issueId}`);
      } catch (error) {
        logger.error(`[AgentService.startAgent] Error in callback for #${issueId}: ${(error as Error).message}`);
      }
    } else {
      logger.warn('[AgentService.startAgent] No callback registered');
    }

    return { started: true, issueId };
  }

  /**
   * Called when agent completes work on an issue.
   * Clears WIP and auto-triggers next issue.
   */
  public async finishAgent(issueId: string): Promise<FinishAgentResult> {
    logger.info(`[AgentService.finishAgent] Finishing agent for #${issueId}`);

    // Clear WIP — check both regular WIP and bug WIP set
    if (this.currentWip === issueId) {
      this.currentWip = null;
      logger.info(`[AgentService.finishAgent] WIP cleared (was #${issueId})`);
    }
    this.bugWipSet.delete(issueId);
    logger.debug(`[AgentService.finishAgent] Removed #${issueId} from bug WIP set. Remaining: ${Array.from(this.bugWipSet).join(', ')}`);

    // Auto-trigger next issue — but NOT the same one that just finished
    logger.info('[AgentService.finishAgent] Checking for next issue');
    const next = this.selectNextIssue();
    if (next && String(next.issueId) === issueId) {
      logger.info(`[AgentService.finishAgent] Next selection is same issue #${issueId} — skipping auto-trigger (board state will update on next poll)`);
      return { reason: 'same_issue' };
    }
    if (next) {
      logger.info(`[AgentService.finishAgent] Auto-triggering next issue #${next.issueId}`);
      try {
        const result = await this.startAgent();
        logger.info(`[AgentService.finishAgent] Auto-trigger result: started=${result.started}, issueId=${result.issueId}, reason=${result.reason}`);
      } catch (error) {
        logger.error(`[AgentService.finishAgent] Error auto-triggering next: ${(error as Error).message}`);
      }
      return { reason: 'none' };
    } else {
      logger.info('[AgentService.finishAgent] No next issue available');
      const reason = this.currentUser ? 'no_assigned_issues' : 'none';
      return { reason };
    }
  }

  /**
   * Legacy method — kept for backward compatibility with existing commands.
   * Triggers the agent for a specific issue directly (bypasses prioritizer).
   */
  public async onAgentTrigger(issueId: string, columnName: string): Promise<void> {
    logger.info(`[AgentService.onAgentTrigger] issueId=${issueId} columnName=${columnName}`);

    if (!AI_ELIGIBLE_COLUMNS.includes(columnName as typeof AI_ELIGIBLE_COLUMNS[number])) {
      logger.info(`[AgentService.onAgentTrigger] Column ${columnName} is not AI-eligible, skipping`);
      return;
    }

    if (this.callback) {
      logger.info(`[AgentService.onAgentTrigger] Invoking callback for issue #${issueId} in ${columnName}`);
      try {
        const selectedItem = this.boardItems.find((i) => String(i.id) === issueId);
        const itemTitle = selectedItem?.title;
        const itemBody = selectedItem?.body;
        const itemOwner = selectedItem?.owner;
        const itemRepo = selectedItem?.repo;
        await this.callback({ issueId, columnName, title: itemTitle, body: itemBody, owner: itemOwner, repo: itemRepo });
        logger.info(`[AgentService.onAgentTrigger] Callback completed for issue #${issueId}`);
      } catch (error) {
        logger.error(`[AgentService.onAgentTrigger] Error in callback for issue #${issueId}: ${(error as Error).message}`);
      }
    } else {
      logger.warn('[AgentService.onAgentTrigger] No callback registered');
    }
  }

  /**
   * Assign agent to a specific issue (legacy).
   */
  public async assignAgent(_graphql: GraphQLClient, _issueId: string): Promise<void> {
    logger.info(`[AgentService.assignAgent] Assigning agent to issue #${_issueId}`);
    logger.info(`[AgentService.assignAgent] Implementation pending for issue #${_issueId}`);
  }
}

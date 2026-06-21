/** Background polling service — polls GitHub every 30s for board changes */

import type { GraphQLClient, ProjectItemNode } from './graphql';
import { detectDeltas, extractStatus, extractLabels, hashToNumber, type BoardItemState, type DeltaEvent } from './delta';
import type { AgentService, PrioritizerItem } from './agent';
import type { RepoManager } from './repoManager';
import { logger } from './logger';
import { writeBoardState, type BoardState } from './stateBridge';

/** Poll interval in milliseconds — 30 seconds */
const POLL_INTERVAL = 30_000;

/** Callback for delta events */
export type DeltaCallback = (events: DeltaEvent[]) => void;

/**
 * Background polling service.
 * Polls GitHub at a fixed interval, detects deltas, and notifies callbacks.
 */
export class PollerService {
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private lastState = new Map<number, BoardItemState>();
  private projectId: string | undefined;
  private graphql: GraphQLClient | undefined;
  private callback: DeltaCallback | undefined;
  private isPolling = false;
  private isStopped = false;
  private stateFilePath: string | undefined;
  private agentService: AgentService | undefined;
  private repoManager: RepoManager | undefined;
  private lastItems: ProjectItemNode[] = [];

  /**
   * Start polling for a specific project.
   */
  public start(
    graphql: GraphQLClient,
    projectId: string,
    callback: DeltaCallback,
    stateFilePath?: string
  ): void {
    this.stop();
    this.isStopped = false;

    this.graphql = graphql;
    this.projectId = projectId;
    this.callback = callback;
    this.stateFilePath = stateFilePath;

    logger.info(`Poller started for project ${projectId} at ${POLL_INTERVAL}ms interval`);

    // Initial poll
    this.poll().catch((err) => {
      logger.error(`Initial poll failed: ${(err as Error).message}`);
    });

    this.intervalId = setInterval(() => {
      this.poll().catch((err) => {
        logger.error(`Poll interval failed: ${(err as Error).message}`);
      });
    }, POLL_INTERVAL);
  }

  /**
   * Stop polling.
   */
  public stop(): void {
    this.isStopped = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    logger.info('Poller stopped');
  }

  /**
   * Perform a single poll cycle.
   */
  private async poll(): Promise<void> {
    if (!this.graphql || !this.projectId || !this.callback || this.isStopped) {
      return;
    }

    // Prevent overlapping polls — if already polling, skip this cycle
    if (this.isPolling) {
      logger.warn('Poll skipped — previous poll still in progress');
      return;
    }

    this.isPolling = true;

    try {
      const items = await this.graphql.getProjectItems(this.projectId);

      // Guard against stale data if poller was stopped during await
      if (this.isStopped) {
        return;
      }

      // Detect deltas
      const events = detectDeltas(this.lastState, items);

      this.updateState(items);

      // Only feed board state to agent service when changes are detected
      if (events.length > 0) {
        this.feedBoardState(items);
      }

      if (this.stateFilePath) {
        this.writeStateBridge(items).catch((err) => {
          logger.error(`State bridge write error: ${(err as Error).message}`);
        });
      }

      if (this.repoManager) {
        this.checkMergedPrs(items).catch((err) => {
          logger.error(`PR merge check error: ${(err as Error).message}`);
        });
      }

      // Notify if there are changes
      if (events.length > 0) {
        this.callback(events);
      }
    } catch (error) {
      logger.error(`Poll error: ${(error as Error).message}`);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Check for merged PRs and trigger worktree cleanup.
   */
  private async checkMergedPrs(items: ProjectItemNode[]): Promise<void> {
    logger.debug(`[poller.checkMergedPrs] Checking ${items.length} items for merged PRs`);
    for (const item of items) {
      const content = item.content;
      if (!content) continue;
      // Check if this is a PR with MERGED state
      if (content.state === 'MERGED' && content.repository) {
        const owner = content.repository.owner?.login;
        const repo = content.repository.name;
        if (!owner || !repo) continue;
        logger.info(`[poller.checkMergedPrs] Detected merged PR #${content.number} in ${owner}/${repo}`);
        try {
          await this.repoManager!.cleanupWorktree(owner, repo, content.number, content.title);
          logger.info(`[poller.checkMergedPrs] Cleaned up worktree for merged PR #${content.number}`);
        } catch (error) {
          logger.warn(`[poller.checkMergedPrs] Failed to cleanup #${content.number}: ${(error as Error).message} (will retry next poll)`);
        }
      }
    }
  }

  /**
   * Store the last poll items for repo availability checks.
   */
  private updateState(items: ProjectItemNode[]): void {
    const newState = new Map<number, BoardItemState>();

    for (const item of items) {
      const githubId = item.databaseId ?? hashToNumber(item.id);
      const status = extractStatus(item);
      const title = item.content?.title ?? 'Unknown';
      const labels = extractLabels(item);
      const body = item.content?.body;
      newState.set(githubId, { githubId, status, title, labels, body });
    }

    this.lastState = newState;
    this.lastItems = items;
  }

  /**
   * Feed enriched board state to the agent service for prioritizer.
   */
  private feedBoardState(items: ProjectItemNode[]): void {
    if (!this.agentService) return;

    const prioritizerItems: PrioritizerItem[] = items.map((item) => {
      const owner = item.content?.repository?.owner?.login;
      const repo = item.content?.repository?.name;
      return {
        id: item.databaseId ?? hashToNumber(item.id),
        projectItemId: item.id,
        title: item.content?.title ?? 'Unknown',
        status: extractStatus(item),
        labels: extractLabels(item),
        body: item.content?.body,
        owner,
        repo,
      };
    });

    logger.debug(`[poller.feedBoardState] Feeding ${prioritizerItems.length} items to agent service`);
    this.agentService.setBoardState(prioritizerItems);
  }

  /**
   * Set the agent service reference for feeding board state.
   */
  public setAgentService(agentService: AgentService): void {
    logger.info('[poller.setAgentService] Setting agent service reference');
    this.agentService = agentService;
  }

  /**
   * Set the repo manager reference for PR merge cleanup.
   */
  public setRepoManager(repoManager: RepoManager): void {
    logger.info('[poller.setRepoManager] Setting repo manager reference');
    this.repoManager = repoManager;
  }

  /**
   * Get the last polled items (for repo availability checks).
   */
  public getItems(): ProjectItemNode[] {
    logger.debug(`[poller.getItems] Returning ${this.lastItems.length} items`);
    return this.lastItems;
  }

  /**
   * Get the current in-memory state.
   */
  public getState(): Map<number, BoardItemState> {
    return this.lastState;
  }

  /**
   * Write board state to the shared JSON file for the MCP server.
   */
  private async writeStateBridge(items: ProjectItemNode[]): Promise<void> {
    if (!this.stateFilePath) return;

    const columns: BoardState['columns'] = {};
    const issues: BoardState['issues'] = [];

    for (const item of items) {
      const githubId = item.databaseId ?? hashToNumber(item.id);
      const status = extractStatus(item);
      const title = item.content?.title ?? 'Unknown';
      const labels = extractLabels(item);

      if (!columns[status]) {
        columns[status] = [];
      }
      columns[status].push({ number: githubId, title, labels });

      issues.push({ number: githubId, title, column: status, labels });
    }

    const state: BoardState = {
      columns,
      issues,
      lastUpdated: new Date().toISOString(),
    };

    await writeBoardState(this.stateFilePath, state);
  }
}

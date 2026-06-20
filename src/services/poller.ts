/** Background polling service — polls GitHub every 30s for board changes */

import type { GraphQLClient, ProjectItemNode } from './graphql';
import { detectDeltas, extractStatus, hashToNumber, type BoardItemState, type DeltaEvent } from './delta';
import { logger } from './logger';
import { writeBoardState, type BoardState } from './stateBridge';

/** Columns that trigger AI agent */
const AI_TRIGGER_COLUMNS = new Set(['AI_SPEC', 'AI_CODE']);

/** Poll interval in milliseconds — configurable via POLL_INTERVAL env var (seconds, default 30) */
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30', 10) * 1000;

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

      if (this.stateFilePath) {
        this.writeStateBridge(items).catch((err) => {
          logger.error(`State bridge write error: ${(err as Error).message}`);
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
   * Update in-memory state with current items.
   */
  private updateState(items: ProjectItemNode[]): void {
    const newState = new Map<number, BoardItemState>();

    for (const item of items) {
      const githubId = item.databaseId ?? hashToNumber(item.id);
      const status = extractStatus(item);
      const title = item.content?.title ?? 'Unknown';
      newState.set(githubId, { githubId, status, title });
    }

    this.lastState = newState;
  }

  /**
   * Get the current in-memory state.
   */
  public getState(): Map<number, BoardItemState> {
    return this.lastState;
  }

  /**
   * Check if a column name triggers the AI agent.
   */
  public static isAiTriggerColumn(columnName: string): boolean {
    return AI_TRIGGER_COLUMNS.has(columnName);
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

      if (!columns[status]) {
        columns[status] = [];
      }
      columns[status].push({ number: githubId, title });

      issues.push({ number: githubId, title, column: status });
    }

    const state: BoardState = {
      columns,
      issues,
      lastUpdated: new Date().toISOString(),
    };

    await writeBoardState(this.stateFilePath, state);
  }
}

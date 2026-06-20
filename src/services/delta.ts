/** Delta detection: compare poll results against in-memory state */

import type { ProjectItemNode } from './graphql';
import { logger } from './logger';

/** Delta event types */
export type DeltaEventType = 'item_added' | 'item_moved' | 'item_removed';

/** Delta event representing a change in board state */
export interface DeltaEvent {
  issueId: number;
  type: DeltaEventType;
  data: Record<string, unknown>;
}

/** Board item state for delta comparison */
export interface BoardItemState {
  githubId: number;
  status: string;
  title: string;
}

/**
 * Detect deltas between last known state and current items.
 */
export function detectDeltas(
  lastState: Map<number, BoardItemState>,
  currentItems: ProjectItemNode[]
): DeltaEvent[] {
  logger.debug(`[delta.detectDeltas] Comparing ${currentItems.length} current items against ${lastState.size} last state entries`);
  const events: DeltaEvent[] = [];

  const currentMap = new Map<number, BoardItemState>();

  for (const item of currentItems) {
    const githubId = item.databaseId ?? hashToNumber(item.id);
    const status = extractStatus(item);
    const title = item.content?.title ?? 'Unknown';

    currentMap.set(githubId, { githubId, status, title });

    const last = lastState.get(githubId);
    if (!last) {
      // New item
      logger.info(`[delta.detectDeltas] New item: #${githubId} "${title}" in ${status}`);
      events.push({
        issueId: githubId,
        type: 'item_added',
        data: { status, title },
      });
    } else if (last.status !== status) {
      // Status changed (item moved)
      logger.info(`[delta.detectDeltas] Moved: #${githubId} "${title}" from ${last.status} -> ${status}`);
      events.push({
        issueId: githubId,
        type: 'item_moved',
        data: { from: last.status, to: status },
      });
    }
  }

  // Detect removed items
  for (const [githubId, last] of lastState) {
    if (!currentMap.has(githubId)) {
      logger.info(`[delta.detectDeltas] Removed: #${githubId} "${last.title}" from ${last.status}`);
      events.push({
        issueId: githubId,
        type: 'item_removed',
        data: { previousStatus: last.status },
      });
    }
  }

  logger.debug(`[delta.detectDeltas] Detected ${events.length} delta events`);
  return events;
}

/**
 * Extract status from a project item's field values.
 * Looks for the Status single-select field value.
 */
export function extractStatus(item: ProjectItemNode): string {
  for (const fv of item.fieldValues.nodes) {
    if (fv.field?.name === 'Status' && fv.name) {
      return fv.name;
    }
  }
  return 'UNKNOWN';
}

/**
 * Convert a GitHub node ID to a number for comparison.
 * Used as a fallback when databaseId is null.
 */
export function hashToNumber(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

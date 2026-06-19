/** Delta detection: compare poll results against in-memory state */

import type { ProjectItemNode } from './graphql';

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
  const events: DeltaEvent[] = [];

  // Build current state map
  const currentMap = new Map<number, BoardItemState>();

  for (const item of currentItems) {
    const githubId = item.databaseId ?? hashToNumber(item.id);
    const status = extractStatus(item);
    const title = item.content?.title ?? 'Unknown';

    currentMap.set(githubId, { githubId, status, title });

    const last = lastState.get(githubId);
    if (!last) {
      // New item
      events.push({
        issueId: githubId,
        type: 'item_added',
        data: { status, title },
      });
    } else if (last.status !== status) {
      // Status changed (item moved)
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
      events.push({
        issueId: githubId,
        type: 'item_removed',
        data: { previousStatus: last.status },
      });
    }
  }

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

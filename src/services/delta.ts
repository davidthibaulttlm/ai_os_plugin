/** Delta detection: compare poll results against in-memory state */

import type { ProjectItemNode } from './graphql';
import { logger } from './logger';

/** Delta event types */
export type DeltaEventType = 'item_added' | 'item_moved' | 'item_removed' | 'item_updated' | 'item_assigned';

/** Delta event representing a change in board state */
export interface DeltaEvent {
  issueId: number;
  type: DeltaEventType;
  data: Record<string, unknown>;
}

/** Board item state for delta comparison */
export interface BoardItemState {
  /** Stable identifier: databaseId (number as string) or raw node ID string */
  githubId: string;
  status: string;
  title: string;
  labels: string[];
  assignees: { login: string }[];
  body?: string;
}

/**
 * Compare two string arrays for equality ignoring order.
 * O(n) via Set, replaces JSON.stringify(sort()) pattern.
 */
function arraysEqualIgnoringOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const item of b) {
    if (!setA.has(item)) return false;
  }
  return true;
}

/**
 * Detect deltas between last known state and current items.
 */
export function detectDeltas(
  lastState: Map<string, BoardItemState>,
  currentItems: ProjectItemNode[]
): DeltaEvent[] {
  logger.debug(`[delta.detectDeltas] Comparing ${currentItems.length} current items against ${lastState.size} last state entries`);
  const events: DeltaEvent[] = [];

  const currentMap = new Map<string, BoardItemState>();

  for (const item of currentItems) {
    // Use databaseId as string key when available; fall back to raw node ID string (no hash collision risk)
    const githubId = item.databaseId != null ? String(item.databaseId) : item.id;
    const status = extractStatus(item);
    const title = item.content?.title ?? 'Unknown';
    const labels = extractLabels(item);
    const assignees = extractAssignees(item);

    currentMap.set(githubId, { githubId, status, title, labels, assignees });

    const last = lastState.get(githubId);
    if (!last) {
      // New item
      logger.info(`[delta.detectDeltas] New item: #${githubId} "${title}" in ${status}`);
      events.push({
        issueId: Number(githubId),
        type: 'item_added',
        data: { status, title },
      });
    } else {
      // Status changed (item moved)
      if (last.status !== status) {
        logger.info(`[delta.detectDeltas] Moved: #${githubId} "${title}" from ${last.status} -> ${status}`);
        events.push({
          issueId: Number(githubId),
          type: 'item_moved',
          data: { from: last.status, to: status },
        });
      }

      // Assignees changed — use set-based comparison (O(n))
      const lastAssigneeLogins = last.assignees.map((a) => a.login);
      const currentAssigneeLogins = assignees.map((a) => a.login);
      if (!arraysEqualIgnoringOrder(lastAssigneeLogins, currentAssigneeLogins)) {
        logger.info(`[delta.detectDeltas] Assigned: #${githubId} "${title}" assignees changed`);
        events.push({
          issueId: Number(githubId),
          type: 'item_assigned',
          data: { assignees, status },
        });
      }

      // Title or labels changed — use set-based comparison (O(n))
      if (last.title !== title || !arraysEqualIgnoringOrder(last.labels, labels)) {
        logger.info(`[delta.detectDeltas] Updated: #${githubId} "${last.title}" -> "${title}" in ${status}`);
        events.push({
          issueId: Number(githubId),
          type: 'item_updated',
          data: { oldTitle: last.title, title, labels, status },
        });
      }
    }
  }

  // Detect removed items
  for (const [githubId, last] of lastState) {
    if (!currentMap.has(githubId)) {
      logger.info(`[delta.detectDeltas] Removed: #${githubId} "${last.title}" from ${last.status}`);
      events.push({
        issueId: Number(githubId),
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
  logger.debug(`[delta.extractStatus] Extracting status for item id=${item.id}`);
  for (const fv of item.fieldValues.nodes) {
    if (fv.field?.name === 'Status' && fv.name) {
      logger.debug(`[delta.extractStatus] Found status: ${fv.name}`);
      return fv.name;
    }
  }
  logger.warn('[delta.extractStatus] No Status field found, returning UNKNOWN');
  return 'UNKNOWN';
}

/**
 * Extract labels from a project item's content.
 */
export function extractLabels(item: import('./graphql').ProjectItemNode): string[] {
  logger.debug(`[delta.extractLabels] Extracting labels for item id=${item.id}`);
  const labels = item.content?.labels?.nodes?.map((l) => l.name) ?? [];
  logger.debug(`[delta.extractLabels] Found ${labels.length} labels: ${labels.join(', ')}`);
  return labels;
}

/**
 * Extract assignees from a project item's content.
 */
export function extractAssignees(item: import('./graphql').ProjectItemNode): { login: string }[] {
  logger.debug(`[delta.extractAssignees] Extracting assignees for item id=${item.id}`);
  const assignees = item.content?.assignees?.nodes?.map((a) => ({ login: a.login })) ?? [];
  logger.debug(`[delta.extractAssignees] Found ${assignees.length} assignees: ${assignees.map((a) => a.login).join(', ')}`);
  return assignees;
}

/**
 * Convert a GitHub node ID to a number for comparison.
 * Used as a fallback when databaseId is null.
 */
export function hashToNumber(id: string): number {
  logger.debug(`[delta.hashToNumber] Converting id=${id} to number`);
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const result = Math.abs(hash);
  logger.debug(`[delta.hashToNumber] Result: ${result}`);
  return result;
}

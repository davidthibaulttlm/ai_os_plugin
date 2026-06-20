## Context

The kanban board currently supports drag-and-drop between columns but not within a column. The `handleDragEnd` handler detects same-column drops but takes no action, leaving the items array unchanged. GitHub Projects v2 provides `updateProjectV2ItemPosition` mutation with an `afterId` parameter to reorder items.

## Goals / Non-Goals

**Goals:**
- Allow users to reorder cards within the same column via drag-and-drop.
- Persist the new order to GitHub using `updateProjectV2ItemPosition`.
- Provide optimistic UI updates with revert on failure.

**Non-Goals:**
- Cross-column reordering (already supported via `updateProjectV2ItemFieldValue`).
- Bulk reordering or multi-select drag.
- Persisting column-specific order (GitHub uses project-level position, not per-column).

## Decisions

- **Use `updateProjectV2ItemPosition` with `afterId`**: This is the official GitHub API for reordering. The `afterId` parameter positions the item after the target card. Setting `afterId` to null moves to top.
- **Optimistic reordering with splice-based array update**: Remove the dragged item from its current index and insert it after the target index. This matches the visual drag-and-drop behavior.
- **Same IPC pattern as `moveItem`**: New `reorderItem` message type with `itemId` and `afterId`, confirmed via `itemReordered` response. Keeps the message protocol consistent.

## Risks / Trade-offs

- **GitHub position is project-level, not column-level**: `updateProjectV2ItemPosition` reorders at the project level. If the board view groups by Status, the visual order within a column depends on the project-level position. This matches GitHub's native behavior.
- **Rate limit cost**: Each reorder costs ~5-15 GraphQL points. Users reordering many cards rapidly could hit rate limits. Mitigation: existing exponential backoff retry handles 403 responses.

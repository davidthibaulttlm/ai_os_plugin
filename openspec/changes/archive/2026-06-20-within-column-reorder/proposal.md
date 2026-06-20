## Why

Cards cannot be reordered within the same column — dragging a card to a new position in the same column snaps it back to its original position because the drag handler only supported cross-column moves.

## What Changes

- **New**: Within-column card reordering via drag-and-drop using GitHub's `updateProjectV2ItemPosition` mutation with `afterId` parameter.
- **New**: `reorderItem` method on the GraphQL client for position updates.
- **New**: `reorderItem` IPC message type (webview → extension) and `itemReordered` response (extension → webview).
- **Modified**: `handleDragEnd` in `KanbanBoard` now detects same-column drops and triggers reorder instead of ignoring them.
- **Modified**: `boardStore` gains a `reorderItems` action for optimistic reordering.

## Capabilities

### New Capabilities
- `card-reorder`: Within-column card reordering with optimistic UI updates and persistence to GitHub via `updateProjectV2ItemPosition`.

### Modified Capabilities
- `kanban-webview`: Drag-and-drop now handles both cross-column moves and within-column reorders.
- `graphql-client`: New mutation `updateProjectV2ItemPosition` for item position updates.

## Impact

- `src/services/graphql.ts` — New mutation and `reorderItem()` method.
- `src/types/ipc.ts` — New `reorderItem` and `itemReordered` message types.
- `src/providers/KanbanPanel.ts` — New `reorderItem` message handler and `_reorderItem()` method.
- `webview-ui/src/store/boardStore.ts` — New `reorderItems` store action.
- `webview-ui/src/components/KanbanBoard.tsx` — Same-column reorder detection in `handleDragEnd`.
- `webview-ui/src/App.tsx` — New `handleReorderItem` with optimistic update and IPC wiring.

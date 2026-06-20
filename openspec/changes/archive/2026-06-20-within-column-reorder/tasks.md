## 1. GraphQL Client — Reorder Mutation

- [x] 1.1 Add `UPDATE_ITEM_POSITION_MUTATION` with `updateProjectV2ItemPosition` and `first: 1` pagination
- [x] 1.2 Add `UpdateItemPositionResponse` interface
- [x] 1.3 Add `reorderItem(projectId, itemId, afterId)` method to `GraphQLClient`

## 2. IPC Types — Reorder Messages

- [x] 2.1 Add `reorderItem` to `WebviewToExtension` type with `itemId` and `afterId`
- [x] 2.2 Add `itemReordered` to `ExtensionToWebview` type with `itemId`

## 3. Extension Host — Reorder Handler

- [x] 3.1 Add `reorderItem` to allowed message types in `_handleMessage`
- [x] 3.2 Implement `reorderItem` case handler calling `_reorderItem()`
- [x] 3.3 Implement `_reorderItem()` private method calling `graphql.reorderItem()`

## 4. Board Store — Reorder Action

- [x] 4.1 Add `reorderItems(items: IssueItem[])` action to `BoardState` interface
- [x] 4.2 Implement `reorderItems` in Zustand store

## 5. Kanban Board — Same-Column Reorder Detection

- [x] 5.1 Add `onReorderItem` prop to `KanbanBoardProps`
- [x] 5.2 Detect same-column drops in `handleDragEnd` and call `onReorderItem(activeId, overId)`
- [x] 5.3 Update Storybook stories with `onReorderItem` mock

## 6. App — Reorder Wiring

- [x] 6.1 Add `handleReorderItem` with optimistic splice-based reorder
- [x] 6.2 Send `reorderItem` IPC message and handle `itemReordered`/`error` responses
- [x] 6.3 Wire `onReorderItem` to `<KanbanBoard>` component

## 7. Build Verification

- [x] 7.1 Verify `npx tsc --noEmit` passes for extension
- [x] 7.2 Verify `npx tsc --noEmit` passes for webview

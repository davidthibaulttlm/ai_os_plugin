## ADDED Requirements

### Requirement: Users can reorder cards within the same column via drag-and-drop
The webview SHALL allow users to drag a card to a new position within the same column and persist the new order to GitHub.

#### Scenario: Card reordered within same column
- **WHEN** user drags a card and drops it on another card in the same column
- **THEN** the card is moved to the new position in the UI (optimistic update) and a `reorderItem` IPC message is sent with `itemId` and `afterId`

#### Scenario: Reorder confirmed by server
- **WHEN** the extension host confirms the reorder via `itemReordered` message
- **THEN** the new order is kept and a success status is shown

#### Scenario: Reorder fails and reverts
- **WHEN** the backend rejects the reorder
- **THEN** the items revert to their original order and an error is shown

### Requirement: GraphQL client uses updateProjectV2ItemPosition for reordering
The GraphQL client SHALL execute the `updateProjectV2ItemPosition` mutation with `afterId` to reorder items.

#### Scenario: Item positioned after another item
- **WHEN** `reorderItem(projectId, itemId, afterId)` is called with a valid `afterId`
- **THEN** the mutation executes with `afterId` set and returns success

#### Scenario: Item moved to top of list
- **WHEN** `reorderItem(projectId, itemId, null)` is called with `afterId` as null
- **THEN** the mutation executes with `afterId` as null, moving the item to the top

### Requirement: IPC messages support reorder operations
The IPC protocol SHALL include `reorderItem` (webview → extension) and `itemReordered` (extension → webview) message types.

#### Scenario: Webview sends reorder request
- **WHEN** the webview posts a `reorderItem` message with `itemId` and `afterId`
- **THEN** the extension host processes the reorder and responds with `itemReordered` or `error`

#### Scenario: Extension validates reorder message
- **WHEN** a `reorderItem` message is missing `itemId`
- **THEN** the extension logs a warning and does not attempt the reorder

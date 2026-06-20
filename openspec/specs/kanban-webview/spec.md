## MODIFIED Requirements

### Requirement: Users can drag and drop items between columns with optimistic updates
The webview SHALL allow moving items between columns via drag-and-drop with optimistic UI updates, AND reordering items within the same column.

#### Scenario: Optimistic update on drop
- **WHEN** user drops an item in a new column
- **THEN** the item is immediately moved in the UI (optimistic update) before the backend response arrives

#### Scenario: Item moved to new column
- **WHEN** user drags an item card to a different column
- **THEN** the item is visually moved and a `moveItem` IPC message is sent

#### Scenario: Move fails gracefully
- **WHEN** the backend rejects the move
- **THEN** the item reverts to its original column and an error is shown

#### Scenario: Item reordered within same column
- **WHEN** user drags an item card and drops it on another card in the same column
- **THEN** the item is visually reordered and a `reorderItem` IPC message is sent with the target card's ID as `afterId`

#### Scenario: Reorder fails gracefully
- **WHEN** the backend rejects the reorder
- **THEN** the item reverts to its original position and an error is shown

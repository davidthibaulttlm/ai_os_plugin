## ADDED Requirements

### Requirement: Webview displays 6-column Kanban board
The webview SHALL render a Kanban board with exactly 6 columns: BRAIN_DUMP, AI_SPEC, HUMAN_SPEC_REVIEW, AI_CODE, HUMAN_CODE_REVIEW, PR_DONE.

#### Scenario: Board renders with all columns
- **WHEN** board data is loaded
- **THEN** all 6 columns are displayed in the correct order

#### Scenario: Items are grouped by status column
- **WHEN** board data contains items with different statuses
- **THEN** each item appears in its corresponding status column

#### Scenario: Loading indicator shown while data loads
- **WHEN** board data is being loaded
- **THEN** a loading indicator is displayed

#### Scenario: Empty board shows all columns
- **WHEN** the board has no items
- **THEN** all 6 columns are displayed as empty

### Requirement: Users can drag and drop items between columns with optimistic updates
The webview SHALL allow moving items between columns via drag-and-drop with optimistic UI updates.

#### Scenario: Optimistic update on drop
- **WHEN** user drops an item in a new column
- **THEN** the item is immediately moved in the UI (optimistic update) before the backend response arrives

#### Scenario: Item moved to new column
- **WHEN** user drags an item card to a different column
- **THEN** the item is visually moved and a `moveItem` IPC message is sent

#### Scenario: Move fails gracefully
- **WHEN** the backend rejects the move
- **THEN** the item reverts to its original column and an error is shown

### Requirement: Issue cards display key information
Each issue card SHALL show the issue number, title, repository name, and priority.

#### Scenario: Card shows issue details
- **WHEN** an issue item is rendered
- **THEN** the card displays issue number, title, repo name, and priority label

#### Scenario: Card links to GitHub
- **WHEN** user clicks an issue card
- **THEN** the GitHub issue URL opens in the browser

#### Scenario: PR card shows PR indicator
- **WHEN** a PullRequest item is rendered
- **THEN** the card displays a PR indicator and PR number

### Requirement: Webview persists state across panel visibility changes
The webview SHALL use `acquireVsCodeApi().setState()` to preserve board state.

#### Scenario: State survives panel hide
- **WHEN** user hides the webview panel
- **THEN** board state is preserved via `setState`

#### Scenario: State restored on panel show
- **WHEN** user shows the webview panel again
- **THEN** the board renders with the previously saved state

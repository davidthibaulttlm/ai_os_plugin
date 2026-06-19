## ADDED Requirements

### Requirement: Poller queries project state at 30-second intervals
The poller SHALL query the selected GitHub Project every 30 seconds (configurable via `POLL_INTERVAL`).

#### Scenario: Regular polling
- **WHEN** poller is started with a project ID
- **THEN** it queries the project state every 30 seconds

#### Scenario: Configurable interval
- **WHEN** `POLL_INTERVAL` environment variable is set
- **THEN** the poller uses that value as the interval in seconds

#### Scenario: Poller survives individual query failures
- **WHEN** a poll query fails with an error
- **THEN** the error is logged and the poller continues to the next interval

### Requirement: Poller detects deltas between polls using in-memory state
The poller SHALL compare each poll result against the last-known state stored in-memory and detect changes.

#### Scenario: New item detected
- **WHEN** an item appears that wasn't in the last poll
- **THEN** an `item_added` event is dispatched

#### Scenario: Item status changed
- **WHEN** an item's Status field changes
- **THEN** an `item_moved` event is dispatched with old and new status

#### Scenario: Item removed detected
- **WHEN** an item exists in the last poll but not in the current poll
- **THEN** an `item_removed` event is dispatched

#### Scenario: No changes detected
- **WHEN** the board state is identical to last poll
- **THEN** no events are dispatched

### Requirement: Poller dispatches events to extension host via HTTP
The poller SHALL send delta events to the extension host via HTTP notification.

#### Scenario: Event forwarded to webview
- **WHEN** a delta is detected
- **THEN** the poller sends the delta to the extension host via HTTP, and the extension host posts a `boardData` message to the webview with updated state

### Requirement: Poller starts and stops with extension lifecycle
The poller SHALL start when a board is opened and stop when the panel is closed.

#### Scenario: Poller starts on board open
- **WHEN** user opens a board
- **THEN** the poller begins polling that project

#### Scenario: Poller stops on panel close
- **WHEN** the webview panel is disposed
- **THEN** the poller stops and releases resources

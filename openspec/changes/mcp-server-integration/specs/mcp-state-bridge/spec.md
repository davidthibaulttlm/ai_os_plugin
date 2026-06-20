## ADDED Requirements

### Requirement: Poller writes board state to shared JSON file
After each successful poll cycle, the poller SHALL write the latest board state to a JSON file located in the VS Code global storage directory.

#### Scenario: Board state file written after poll
- **WHEN** the poller completes a successful GraphQL poll
- **THEN** a file named `board-state.json` is written to `context.globalStorageUri`

#### Scenario: Board state file contains valid JSON
- **WHEN** the poller writes the board state file
- **THEN** the file content is valid JSON containing `columns`, `issues`, and `lastUpdated` fields

#### Scenario: Board state file written atomically
- **WHEN** the poller writes the board state file
- **THEN** the write is atomic (write to temp file then rename) to prevent the MCP server from reading a partially-written file

### Requirement: MCP server reads board state from shared JSON file
The MCP server SHALL read the board state from the shared JSON file when handling tool requests. The file path SHALL be provided via the `AI_OS_STATE_FILE` environment variable.

#### Scenario: MCP server reads state file on tool call
- **WHEN** a tool is called that requires board state
- **THEN** the MCP server reads the board state from the file path in `AI_OS_STATE_FILE` env var

#### Scenario: MCP server handles missing state file
- **WHEN** the state file does not exist (first tool call before first poll)
- **THEN** the MCP server returns an error message indicating no board data is available yet

### Requirement: State file includes timestamp for freshness checking
The board state JSON file SHALL include a `lastUpdated` field with an ISO 8601 timestamp indicating when the data was last polled.

#### Scenario: Timestamp present in state file
- **WHEN** the MCP server reads the state file
- **THEN** the JSON contains a `lastUpdated` field with an ISO 8601 timestamp

#### Scenario: MCP server warns on stale data
- **WHEN** the `lastUpdated` timestamp is older than 2x the poll interval (60 seconds)
- **THEN** the MCP server includes a staleness warning in the tool response

### Requirement: State file is stored in VS Code managed directory
The shared state file SHALL be stored in `context.globalStorageUri` to ensure proper permissions and user-scoped isolation.

#### Scenario: File stored in global storage
- **WHEN** the poller writes the state file
- **THEN** the file path is under `context.globalStorageUri.fsPath`

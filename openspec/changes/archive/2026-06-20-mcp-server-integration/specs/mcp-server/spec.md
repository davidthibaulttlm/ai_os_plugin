## ADDED Requirements

### Requirement: MCP server supports dual activation modes
The MCP server SHALL support two activation modes: (1) VS Code native provider mode where VS Code spawns the server via `McpStdioServerDefinition`, and (2) Claude Code direct mode where Claude Code spawns the server from `~/.claude/settings.json`. Both modes SHALL use the same server binary (`out/mcp/server.js`) and the same `AI_OS_STATE_FILE` for data. The server SHALL detect which mode it's running in based on the presence of `AI_OS_MODE` env var (`vscode` or `claude`).

#### Scenario: Server runs in VS Code provider mode
- **WHEN** the server is spawned by VS Code with `AI_OS_MODE=vscode`
- **THEN** the server reads state from `AI_OS_STATE_FILE` and uses `GITHUB_TOKEN` from env

#### Scenario: Server runs in Claude Code direct mode
- **WHEN** the server is spawned by Claude Code with `AI_OS_MODE=claude`
- **THEN** the server reads state from `AI_OS_STATE_FILE` and uses `GITHUB_TOKEN` from env

#### Scenario: Server runs without mode env var
- **WHEN** the server is spawned without `AI_OS_MODE` set
- **THEN** the server defaults to `claude` mode for backward compatibility

### Requirement: MCP server exposes board state tools
The MCP server SHALL expose the following tools over stdio transport: `get_kanban_board`, `get_column_issues`, `get_issue_details`, `get_project_stats`. Each tool SHALL return structured JSON content wrapped in MCP text content items. The response JSON SHALL include: `columns` (object mapping column names to issue arrays), `issues` (array of issue objects with `number`, `title`, `column`, `labels`), and `lastUpdated` (ISO 8601 timestamp).

#### Scenario: Client lists available tools
- **WHEN** an MCP client calls `tools/list`
- **THEN** the server responds with all registered tools including name, description, and input schema

#### Scenario: Client calls get_kanban_board tool
- **WHEN** a client calls `get_kanban_board` with no parameters
- **THEN** the server returns the full board state as a JSON string in a text content item

#### Scenario: Client calls get_column_issues with valid column
- **WHEN** a client calls `get_column_issues` with column set to `AI_CODE`
- **THEN** the server returns issues currently in the AI_CODE column as JSON

#### Scenario: Client calls get_column_issues with invalid column
- **WHEN** a client calls `get_column_issues` with a column name not in the fixed 6-column list
- **THEN** the server returns an error response with a descriptive message

#### Scenario: Client calls get_issue_details with valid issue number
- **WHEN** a client calls `get_issue_details` with `issueNumber: 42`
- **THEN** the server returns issue details including `title`, `body`, `labels`, `assignees`, and `column` as JSON

#### Scenario: Client calls get_issue_details with non-existent issue
- **WHEN** a client calls `get_issue_details` with an issue number that doesn't exist on the board
- **THEN** the server returns an error message "Issue #N not found on the board"

#### Scenario: Client calls get_project_stats
- **WHEN** a client calls `get_project_stats`
- **THEN** the server returns JSON with `columnCounts` (object mapping column names to issue counts) and `totalIssues` (number)

#### Scenario: Tool returns no data when no board is selected
- **WHEN** a client calls any board tool and no board has been loaded yet
- **THEN** the server returns an error message "No board loaded. Open a board in AI OS first."

### Requirement: MCP server exposes board state resources
The MCP server SHALL expose resources: `board://state` (full board JSON) and `board://column/{name}` (per-column JSON template). Resources SHALL return `application/json` MIME type.

#### Scenario: Client reads board state resource
- **WHEN** a client reads the `board://state` resource
- **THEN** the server returns the full board state as JSON with `application/json` MIME type

#### Scenario: Client reads column resource template
- **WHEN** a client reads `board://column/AI_SPEC`
- **THEN** the server returns issues in the AI_SPEC column as JSON

### Requirement: MCP server validates tool inputs with Zod schemas
The MCP server SHALL validate all tool input parameters using Zod schemas. Invalid inputs SHALL return an MCP error response with a descriptive message.

#### Scenario: Client calls tool with missing required parameter
- **WHEN** a client calls `get_column_issues` without providing the `column` parameter
- **THEN** the server returns an MCP error indicating the missing parameter

#### Scenario: Client calls tool with wrong parameter type
- **WHEN** a client calls `get_issue_details` with `issueNumber` as a string instead of number
- **THEN** the server returns an MCP error indicating the type mismatch

### Requirement: MCP server runs on stdio transport
The MCP server SHALL connect to a `StdioServerTransport` for JSON-RPC communication over stdin/stdout. The server SHALL log startup and error messages to stderr.

#### Scenario: Server starts successfully
- **WHEN** the MCP server process is launched via `node out/mcp/server.js`
- **THEN** the server logs `[AI OS] MCP server running on stdio` to stderr and begins accepting requests

#### Scenario: Server handles fatal error
- **WHEN** an unhandled exception occurs during server initialization
- **THEN** the server logs the error to stderr and exits with code 1

### Requirement: MCP server strips sensitive data from responses
The MCP server SHALL NOT include GitHub authentication tokens, API keys, or internal VS Code state paths in any tool response or resource content.

#### Scenario: Tool response contains no tokens
- **WHEN** a client calls any MCP tool
- **THEN** the response content does not contain the GitHub token or any auth headers

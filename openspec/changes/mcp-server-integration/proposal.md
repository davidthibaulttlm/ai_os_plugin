## Why

AI OS extension holds rich GitHub Projects v2 kanban board state (columns, issues, deltas) that's invisible to AI coding assistants like Claude Code. Developers currently need to manually copy-paste board information or switch contexts to get AI help on project tracking. An MCP server bridges this gap, allowing any MCP-compatible AI client to query board state programmatically. Additionally, when an issue is assigned to the user or moves into an AI-triggered column (like `AI_CODE`), Claude Code should automatically start working on it headlessly without any manual intervention.

## What Changes

- **New MCP server module** (`src/mcp/`) that exposes kanban board data as MCP tools and resources over stdio transport
- **VS Code MCP server definition provider** registered via `vscode.lm.registerMcpServerDefinitionProvider` — makes the MCP server discoverable in VS Code's MCP server marketplace UI without manual configuration
- **Shared state file bridge** between the extension host poller (in-memory) and the MCP server child process (separate Node.js process)
- **Assignment trigger** that detects when an issue is assigned to the user or moves into an AI-triggered column, then spawns `claude -p` headlessly to work on the issue automatically
- **Settings webview panel** (`src/providers/SettingsPanel.ts`) — single GUI page for all AI OS configuration (MCP connection, auto-work toggles, max-turns, allowed tools, trigger columns)
- **New npm dependencies**: `@modelcontextprotocol/sdk` and `zod` for schema validation
- **Build system update**: Separate esbuild bundle for the MCP server entry point
- **package.json contribution**: `mcpServerDefinitionProviders` extension point for marketplace distribution

## Capabilities

### New Capabilities

- `mcp-server`: MCP server implementation exposing board state via tools (`get_kanban_board`, `get_column_issues`, `get_issue_details`, `get_project_stats`) and resources (`board://state`, `board://column/{name}`) over stdio transport
- `mcp-provider`: VS Code MCP server definition provider that registers the MCP server with VS Code's native MCP registry, handling token injection and lifecycle management
- `mcp-state-bridge`: Shared JSON file mechanism for passing board state from the extension host poller to the MCP server child process
- `claude-trigger`: Delta detection for issue assignments and column moves into AI-triggered columns (`AI_SPEC`, `AI_CODE`), spawning `claude -p` headlessly with a structured prompt to automatically work on the issue (requires Claude Code CLI)
- `settings-webview`: Webview settings panel that provides a single GUI page for all AI OS configuration (MCP connection status, auto-work toggle, max-turns, allowed tools, trigger columns) — user NEVER needs to search VS Code settings or type commands

### Modified Capabilities

- `graphql-client`: Add new query for fetching single issue details by number (needed for `get_issue_details` MCP tool)

## Impact

- **New directory**: `src/mcp/` with server entry, tool handlers, and resource handlers
- **New provider**: `src/providers/SettingsPanel.ts` for the settings webview panel
- **New service**: `src/services/claudeTrigger.ts` for delta detection and Claude CLI spawning
- **New dependencies**: `@modelcontextprotocol/sdk`, `zod` added to package.json
- **Modified files**: `src/extension.ts` (register MCP provider + assignment trigger + settings panel), `src/services/poller.ts` (write shared state file, emit delta events), `src/services/graphql.ts` (new issue detail query), `esbuild.js` (MCP server bundle), `package.json` (dependencies + contributions + settings + commands)
- **New settings**: `aiOs.autoWorkAssignments`, `aiOs.autoWorkMaxTurns`, `aiOs.autoWorkAllowedTools`, `aiOs.autoWorkColumns`, `aiOs.autoWorkConfirmFirst`
- **Marketplace**: Extension now contributes `mcpServerDefinitionProviders` — visible in VS Code Extensions view under `@mcp` filter
- **Security**: GitHub token passed via env var to MCP child process; never written to disk. MCP responses strip auth headers. Claude headless runs use `--allowedTools` whitelist (not `--dangerously-skip-permissions`).
- **Required dependency**: Claude Code CLI (`npm install -g @anthropic-ai/claude-code`) is required for auto-work. Extension detects and warns if missing.

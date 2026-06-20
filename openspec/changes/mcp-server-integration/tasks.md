## 1. Setup

- [x] 1.1 Add `@modelcontextprotocol/sdk` and `zod` dependencies to package.json
- [x] 1.2 Create `src/mcp/` directory structure with `server.ts`, `tools/`, and `resources/` subdirectories
- [x] 1.3 Update `esbuild.js` to add a separate build target for `src/mcp/server.ts` → `out/mcp/server.js`
- [x] 1.4 Verify MCP server bundle compiles successfully with `node esbuild.js`

## 2. MCP Server Core

- [x] 2.1 Create `src/mcp/server.ts` with `McpServer` instance and `StdioServerTransport` connection
- [x] 2.2 Add startup logging to stderr and fatal error handling with process.exit(1)
- [ ] 2.3 Verify MCP server starts and accepts connections using `npx @modelcontextprotocol/inspector`

## 3. State Bridge

- [x] 3.1 Create `src/services/stateBridge.ts` with functions to write/read board state JSON to `context.globalStorageUri`
- [x] 3.2 Update `src/services/poller.ts` to call state bridge write after each successful poll cycle
- [x] 3.3 Ensure state file includes `lastUpdated` ISO 8601 timestamp field
- [ ] 3.4 Test that state file is written correctly after a poll cycle

## 4. MCP Tools

- [x] 4.1 Implement `get_kanban_board` tool in `src/mcp/tools/board.ts` — reads state file, returns full board JSON
- [x] 4.2 Implement `get_column_issues` tool in `src/mcp/tools/board.ts` — Zod-validated column enum, returns column issues
- [x] 4.3 Implement `get_issue_details` tool in `src/mcp/tools/issues.ts` — fetches single issue via GraphQL
- [x] 4.4 Implement `get_project_stats` tool in `src/mcp/tools/stats.ts` — returns column counts and delta summary
- [x] 4.5 Add staleness warning when `lastUpdated` is older than 60 seconds
- [x] 4.6 Register all tools in `src/mcp/server.ts`

## 5. MCP Resources

- [x] 5.1 Implement `board://state` resource in `src/mcp/resources/boardState.ts` — returns full board JSON
- [x] 5.2 Implement `board://column/{name}` resource template — returns per-column JSON
- [x] 5.3 Register all resources in `src/mcp/server.ts`

## 6. Security Hardening

- [x] 6.1 Ensure MCP tool responses strip any GitHub tokens or auth headers from output
- [x] 6.2 Verify state file is stored in `context.globalStorageUri` (not user home or temp)
- [x] 6.3 Add Zod schema validation to all tool inputs — verify rejection of malformed inputs

## 7. VS Code MCP Provider

- [x] 7.1 Add `mcpServerDefinitionProviders` contribution to `package.json` with id `aiOsMcpProvider`
- [x] 7.2 Register `McpServerDefinitionProvider` in `src/extension.ts` activate using `vscode.lm.registerMcpServerDefinitionProvider`
- [x] 7.3 Implement `provideMcpServerDefinitions` to return `McpStdioServerDefinition` pointing to `out/mcp/server.js`
- [x] 7.4 Inject `GITHUB_TOKEN` via env var from auth service
- [x] 7.5 Inject `AI_OS_STATE_FILE` env var pointing to the shared state file path
- [x] 7.6 Add provider registration to `context.subscriptions` for proper disposal

## 8. Claude Code GUI Configuration

- [x] 8.1 Create `src/services/claudeDetector.ts` with `detectClaudeCode()` function that checks both VS Code extension and CLI
- [x] 8.2 Implement VS Code extension detection: `vscode.extensions.getExtension('anthropic.claude-code')` — returns installed/missing
- [x] 8.3 Implement CLI detection: spawn `which claude` (Linux/macOS) or `where claude` (Windows) — check exit code
- [x] 8.4 Create `src/commands/configureClaude.ts` with `configureClaudeCode` command that writes MCP entry to `~/.claude/settings.json`
- [x] 8.5 Add pre-configure check: warn user if Claude CLI not detected, offer "Install" (opens URL) and "Configure Anyway" buttons
- [x] 8.6 Implement config merge logic: read existing `settings.json`, merge `ai-os` entry, write back
- [x] 8.7 Add success notification with "Restart Claude Code" action button
- [x] 8.8 Handle missing `~/.claude/` directory — create it automatically
- [x] 8.9 Handle authentication error — show error message when not authenticated
- [x] 8.10 Create `disconnectClaude` command that removes `ai-os` entry from Claude config
- [x] 8.11 Register both commands in `extension.ts` and `package.json` contributes.commands
- [x] 8.12 Add onboarding notification in `extension.ts` activate — show "Connect to Claude Code?" on first activation

## 9. GraphQL Client Update

- [x] 9.1 Add GraphQL query for fetching single issue details by number to `src/services/graphql.ts`
- [x] 9.2 Export the new query function for use by the `get_issue_details` MCP tool

## 10. Integration Testing

- [x] 10.1 Build extension with `node esbuild.js` and verify both bundles compile
- [ ] 10.2 Load extension in VS Code with `code --extensionDevelopmentPath=$PWD`
- [ ] 10.3 Verify MCP server appears in VS Code Extensions view under `@mcp` filter
- [ ] 10.4 Test "AI OS: Connect to Claude Code" command — verify `~/.claude/settings.json` is written correctly
- [ ] 10.5 Test configure command idempotency — run twice, verify no duplicate entries
- [ ] 10.6 Test disconnect command — verify `ai-os` entry is removed
- [ ] 10.7 Test MCP tools with Claude Code after GUI configuration — call `get_kanban_board`
- [ ] 10.8 Test MCP resources: verify `board://state` returns valid JSON
- [ ] 10.9 Verify extension deactivation properly disposes MCP provider

## 11. Claude Trigger

- [x] 11.1 Add `aiOs.autoWorkAssignments`, `aiOs.autoWorkMaxTurns`, `aiOs.autoWorkAllowedTools`, `aiOs.autoWorkColumns`, `aiOs.autoWorkConfirmFirst` settings to `package.json` contributes.configuration
- [x] 11.2 Create `src/services/claudeTrigger.ts` with delta detection logic for assignee changes and column moves
- [ ] 11.3 Implement assignee delta detection: compare `assignees` arrays between consecutive poll results, emit event when current user is added
- [ ] 11.4 Implement column-move delta detection: compare issue column positions, emit event when issue enters configured trigger columns (default: `AI_SPEC`, `AI_CODE`)
- [ ] 11.5 Integrate assignment trigger with `src/services/poller.ts` — call delta detection after each successful poll
- [x] 11.6 Create `src/services/claudeSpawner.ts` with function to spawn `claude -p "<prompt>" --allowedTools "<tools>" --max-turns <N>` child process
- [x] 11.7 Implement prompt builder: construct structured prompt from issue number, title, body, labels, and column name with instructions to stage but not commit
- [x] 11.8 Set child process `cwd` to workspace root and inject `GITHUB_TOKEN` environment variable
- [x] 11.9 Create dedicated VS Code output channel `AI OS - Claude #<N>` and stream stdout/stderr from Claude process
- [x] 11.10 Implement confirmation notification ("Starting work on #N: <title>" with Proceed/Dismiss) when `aiOs.autoWorkConfirmFirst` is true
- [x] 11.11 Implement completion notifications: success (exit 0) with "Review Changes" button, error (non-zero exit) with exit code
- [x] 11.12 Implement active process tracking map keyed by issue number — prevent concurrent Claude processes for same issue
- [x] 11.13 Kill all active Claude processes on extension deactivate
- [x] 11.14 Register "AI OS: Enable Auto-Work" command in `extension.ts` and `package.json`
- [x] 11.15 Add `workingOnIssues` set to extension state, populated when Claude spawns and cleared when it exits
- [x] 11.16 Send `workingStatus` message to kanban webview when spinner starts/stops (issue number + active/inactive boolean)
- [x] 11.17 Implement spinning indicator component in webview — CSS animation using `color-vscode-progressBar-background`
- [x] 11.18 Display spinner on issue card when `workingStatus` message marks issue as active

## 12. Assignment Trigger Integration Testing

- [ ] 12.1 Test delta detection: simulate assignee change in poll result, verify assignment event emitted
- [ ] 12.2 Test column-move detection: simulate issue moving into `AI_CODE`, verify trigger event emitted
- [ ] 12.3 Test auto-work disabled by default: verify no Claude spawn when setting is unset
- [ ] 12.4 Test confirmation notification flow: verify Proceed spawns Claude, Dismiss blocks spawn
- [ ] 12.5 Test Claude process spawning: verify correct CLI flags (`-p`, `--allowedTools`, `--max-turns`) in spawned process
- [ ] 12.6 Test output channel: verify Claude stdout/stderr appears in `AI OS - Claude #<N>` channel
- [ ] 12.7 Test concurrent prevention: verify duplicate trigger for same issue is blocked
- [ ] 12.8 Test process cleanup: verify Claude processes killed on extension deactivate

## 13. Settings Webview Panel

- [x] 13.1 Create `src/providers/SettingsPanel.ts` with `WebviewPanel` provider (singleton pattern like `KanbanPanel`)
- [x] 13.2 Register "AI OS: Open Settings" command in `extension.ts` and `package.json` contributes.commands
- [x] 13.3 Create settings webview HTML with sections: Claude Installation, MCP Connection, Auto-Work, Max Turns, Allowed Tools, Trigger Columns, Confirm First
- [x] 13.4 Implement Claude installation detection section: call `detectClaudeCode()` on panel open, display extension/CLI status with green/red indicators
- [x] 13.5 Implement "Install Claude Code" button: opens https://claude.ai/download via `vscode.env.openExternal()` when Claude not detected
- [x] 13.6 Implement MCP connection status section: read `~/.claude/settings.json` to determine connected/disconnected state, display with green/red indicator
- [x] 13.7 Implement Connect/Disconnect buttons with IPC messages to extension host
- [x] 13.8 Implement auto-work toggle switch with immediate save to `vscode.workspace.getConfiguration('aiOs')`
- [x] 13.9 Implement max-turns numeric input with validation (1-500 range)
- [x] 13.10 Implement allowed tools text input (comma-separated)
- [x] 13.11 Implement trigger columns checkboxes (all 6 kanban columns)
- [x] 13.12 Implement confirm-first toggle switch
- [x] 13.13 Load all current setting values on panel open via `vscode.workspace.getConfiguration('aiOs')`
- [x] 13.14 Save settings immediately on change (toggle: instant, input: on blur) — no "Save" button needed
- [ ] 13.15 Use Tailwind utility classes from `@theme` (e.g., `bg-vscode-panel-background`, `text-vscode-panel-foreground`) — NO raw `var(--vscode-*)` or inline styles
- [x] 13.16 Add IPC message validation in settings panel message handler

## 14. Settings Webview Integration Testing

- [ ] 14.1 Test "AI OS: Open Settings" command opens panel with all fields populated
- [ ] 14.2 Test Claude detection displays correctly (extension installed/missing, CLI installed/missing)
- [ ] 14.3 Test "Install Claude Code" button opens https://claude.ai/download
- [ ] 14.4 Test MCP connection status displays correctly (connected vs disconnected)
- [ ] 14.5 Test Connect button writes to `~/.claude/settings.json` and updates status
- [ ] 14.6 Test Disconnect button removes MCP entry and updates status
- [ ] 14.7 Test auto-work toggle saves immediately to VS Code settings
- [ ] 14.8 Test max-turns validation rejects values outside 1-500
- [ ] 14.9 Test allowed tools input saves comma-separated list
- [ ] 14.10 Test trigger column checkboxes update `aiOs.autoWorkColumns` array

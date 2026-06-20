## Context

The AI OS extension polls GitHub Projects v2 boards every 30 seconds via GraphQL, storing board state in VS Code Memento and memory. This data is currently only accessible through the webview kanban UI. AI coding assistants (Claude Code, Copilot) running inside VS Code have no programmatic way to access this board state.

VS Code provides a native MCP server definition provider API (`vscode.lm.registerMcpServerDefinitionProvider`) that allows extensions to contribute MCP servers to VS Code's MCP registry. The MCP server runs as a separate Node.js child process using stdio transport, communicating via JSON-RPC over stdin/stdout.

## Goals / Non-Goals

**Goals:**
- Expose kanban board state to any MCP-compatible AI client through tools and resources
- Zero manual configuration: MCP server auto-registers when extension is installed
- Secure token handling: GitHub token passed via env var, never persisted to disk by MCP layer
- Marketplace-ready: Single VSIX distribution, no external dependencies required

**Non-Goals:**
- Writing back to GitHub from MCP tools (read-only for now)
- WebSocket/SSE transport (stdio is sufficient for VS Code integration)
- Custom MCP client implementation (rely on existing Claude Code / Copilot clients)

## Decisions

### 1. VS Code Native MCP Provider API over standalone `claude mcp add`

**Decision**: Use `vscode.lm.registerMcpServerDefinitionProvider` with `McpStdioServerDefinition` to register the MCP server programmatically.

**Rationale**: 
- Users install one extension — no manual `claude mcp add` command needed
- VS Code manages server lifecycle (start, restart on crash, dev mode)
- Works with any AI client that reads VS Code's MCP registry
- The provider ID in `package.json` makes the server discoverable via `@mcp` filter

**Alternatives considered**:
- Standalone MCP server binary: Requires user to manually configure Claude. Fragile for marketplace distribution.
- HTTP/SSE transport: Adds complexity (port management, CORS) with no benefit for local stdio use case.

### 2. Shared JSON file for extension host ↔ MCP server communication

**Decision**: The poller writes board state to a JSON file in `context.globalStorageUri`. The MCP server reads this file when tools are called.

**Rationale**:
- Simplest IPC pattern — no sockets, no HTTP server
- MCP tools are pull-based (called on demand), so eventual consistency is acceptable
- File is in VS Code's managed storage directory (secure, user-scoped)
- Poller already runs every 30s — file freshness is bounded by poll interval

**Alternatives considered**:
- In-process MCP server: Would eliminate IPC but requires the MCP SDK to run inside the extension host thread, which blocks the UI.
- Local HTTP side channel: Adds port management complexity. Overkill for reading a JSON file.
- Named pipe: Platform-specific (Windows named pipes vs Unix sockets). JSON file is cross-platform.

### 3. Separate esbuild bundle for MCP server

**Decision**: Compile the MCP server to a separate bundle (`out/mcp/server.js`) that runs as a child Node.js process.

**Rationale**:
- MCP SDK uses stdio — must run in a separate process
- Keeps the extension host bundle lean (no MCP SDK in main bundle)
- Standard pattern used by existing marketplace MCP extensions (Azure MCP Server, vscode-mcp-server)

**Alternatives considered**:
- Single bundle with dynamic import: MCP SDK requires stdio access which conflicts with extension host.
- Ship TypeScript source and `npx tsx`: Requires Node.js and tsx to be installed on user machine. Not marketplace-friendly.

### 4. Read-only MCP tools with Zod-validated inputs

**Decision**: All MCP tools are read-only (query board state). Inputs validated with Zod schemas.

**Rationale**:
- Write operations (move cards, assign agents) already exist as VS Code commands — no need to duplicate
- Read-only reduces security surface area
- Zod schemas prevent injection attacks via malformed tool inputs

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| MCP server process crashes | VS Code auto-restarts stdio servers. Extension logs errors to output channel. |
| Stale board state (file not updated) | MCP tools check file mtime and warn if data is older than 2x poll interval. |
| GitHub token leaked in MCP process | Token passed via `env` only. MCP server never logs the token. Responses strip auth headers. |
| Large board state file I/O | Board state is typically <100KB. File read is fast. Cache in MCP server memory after first read. |
| VS Code MCP API changes | `registerMcpServerDefinitionProvider` is stable API (shipped with VS Code 1.93+). Fallback: document manual `claude mcp add` command. |

## Migration Plan

1. Add `@modelcontextprotocol/sdk` and `zod` dependencies
2. Create `src/mcp/` directory with server, tools, and resources
3. Update `esbuild.js` to bundle MCP server separately
4. Register MCP provider in `extension.ts` activate
5. Add `mcpServerDefinitionProviders` to `package.json` contributions
6. Update poller to write shared state file
7. Test with Claude Code: verify tools appear after extension install
8. Rollback: Remove MCP provider registration — existing extension functionality unaffected

## Cross-Platform Configuration

The Claude Code VS Code extension runs inside the VS Code Server environment. This means:

- **WSL**: The extension runs as a native Linux process inside WSL. `os.platform()` returns `linux`. The MCP config uses `command: "node"` directly (NOT `wsl`, because `wsl` does not exist inside WSL).
- **macOS/Linux native**: Same as WSL — `command: "node"`.
- **Windows native**: `os.platform()` returns `win32`. The MCP config uses `command: "node"`.

Claude Code reads MCP servers from multiple config files:
- `~/.claude.json` — Global `mcpServers` section AND project-level entries under `projects["/path/to/workspace"].mcpServers`
- `~/.claude/.mcp.json` — MCP-specific config file
- `~/.claude/settings.json` — General settings (some Claude Code versions read MCP here)
- `.mcp.json` in workspace root — Project-scoped MCP config

**Critical**: Project-level `mcpServers: {}` in `~/.claude.json` overrides the global `mcpServers`. The extension MUST write the `ai-os` entry to BOTH the global section AND the current workspace's project entry.

## Open Questions

- Should MCP tools support filtering by repository? (Currently returns all issues on the board.)
- Should we add a `board://deltas` resource for recent changes since last poll?

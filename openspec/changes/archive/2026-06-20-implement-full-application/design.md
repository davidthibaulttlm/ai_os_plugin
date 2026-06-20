## Context

The AI OS project has complete architectural specifications in [`BUILD_GUIDE.md`](../../BUILD_GUIDE.md) (1,950 lines) and [`CONTEXT_FOR_NEW_SESSION.md`](../../CONTEXT_FOR_NEW_SESSION.md). The repository currently contains only documentation — no source code files exist. This design implements the full three-layer architecture: VS Code extension host (TypeScript), React webview, and Python FastAPI backend.

## Goals / Non-Goals

**Goals:**
- Working VS Code extension that loads in development mode via `code --extensionDevelopmentPath=$PWD`
- GitHub authentication via `gh` CLI token
- Kanban board display with 6 fixed columns from GitHub Projects v2
- Drag-and-drop to move items between columns
- Background polling (30s) with delta detection
- AI agent trigger when issues enter AI_SPEC/AI_CODE columns

**Non-Goals:**
- VS Code Marketplace publishing (requires publisher account)
- User-configurable kanban columns (fixed 6-column template)
- Webhook support (polling model only)
- Database persistence (VS Code Memento + in-memory only)

## Decisions

### 1. Three-Process Architecture
Extension host spawns Python backend as a subprocess; communication via HTTP (FastAPI on localhost). This keeps the extension host lightweight and leverages Python's async ecosystem for GraphQL polling.

**Alternatives considered:**
- JSON-RPC over stdin/stdout: Simpler but harder to debug and no health checks
- All-in-TypeScript: Would require rewriting GraphQL client and poller in Node.js

### 2. esbuild for Extension Bundling
esbuild bundles the TypeScript extension into a single CJS file. Fast, no configuration needed beyond entry point.

**Alternatives considered:**
- webpack: Heavier, slower builds
- tsc only: No bundling, requires managing multiple output files

### 3. Vite for Webview Build
Vite with React plugin builds the webview into static assets. HMR for development, optimized bundles for production.

**Alternatives considered:**
- CRA: Deprecated, slow
- Webpack: More configuration, slower HMR

### 4. Zustand for Webview State
Lightweight state management without Redux boilerplate. Perfect for a single-panel webview.

**Alternatives considered:**
- Redux: Overkill for this scope
- React Context: Works but no devtools or middleware support

### 5. @dnd-kit for Drag-and-Drop
Accessible, composable drag-and-drop library. Better than HTML5 DnD API which has poor mobile support and limited customization.

### 6. httpx for Python GraphQL Client
Async HTTP client with built-in connection pooling and timeout support. Essential for reliable 30s polling intervals.

### 7. uv for Python Package Management
Fast, reliable package manager. Replaces pip + virtualenv with a single tool.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| GraphQL rate limit exhaustion (5,000 pts/hr) | Monitor `X-RateLimit-Remaining`; back off on 403; query only needed fields |
| Python backend crashes | Extension host monitors process; auto-restart on exit |
| Webview loses state on panel hide | Use `acquireVsCodeApi().setState()` for persistence |
| gh CLI not authenticated | Show warning message with link to docs on extension activate |
| Token stored in memory only | Acceptable — self-hosted, single-user extension |

## Migration Plan

Not applicable — this is initial implementation. Deployment is loading the extension in VS Code via development host.

## Open Questions

- AI agent implementation details (which LLM, how to invoke) — deferred to future change
- Multi-board support — MVP supports one board at a time

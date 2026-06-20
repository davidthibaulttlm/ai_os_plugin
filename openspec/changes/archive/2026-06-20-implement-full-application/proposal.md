## Why

The AI OS project has complete architecture specifications in [`BUILD_GUIDE.md`](../../BUILD_GUIDE.md) and [`CONTEXT_FOR_NEW_SESSION.md`](../../CONTEXT_FOR_NEW_SESSION.md) but zero source code. This change implements the entire VS Code extension from spec to working code, enabling developers to install and use the kanban automation tool immediately.

## What Changes

- Create the full VS Code extension project structure with TypeScript extension host, React webview, and Python FastAPI backend
- Implement `package.json`, `tsconfig.json`, `esbuild.js` for extension build tooling
- Implement extension entry point with command registration, auth service, state management, and backend process manager
- Implement webview panel provider with IPC message routing
- Build React webview with Kanban board UI, drag-and-drop columns, issue cards, and VS Code IPC hook
- Build Python FastAPI backend with GraphQL client, background poller, delta detection, and AI agent trigger service
- Create `.vscode/launch.json` debug configurations

## Capabilities

### New Capabilities

- `extension-host`: VS Code extension entry point, command registration, webview panel provider, state management via Memento API
- `github-auth`: GitHub authentication via `gh` CLI token extraction with fallback to `GITHUB_TOKEN` environment variable
- `kanban-webview`: React-based Kanban board UI with drag-and-drop columns, issue cards, and VS Code IPC communication
- `graphql-client`: Python async GraphQL client for GitHub Projects v2 API with rate limit awareness and pagination
- `background-poller`: 30-second interval polling service with delta detection and event dispatching
- `ai-agent-trigger`: Service that detects issues entering AI_SPEC/AI_CODE columns and triggers AI agent workflows

### Modified Capabilities

<!-- None — this is a greenfield implementation -->

## Impact

- **New directories**: `src/`, `webview-ui/`, `backend/`, `.vscode/`
- **New dependencies**: TypeScript/Node.js (extension + webview), Python/FastAPI/httpx (backend)
- **Build system**: esbuild for extension bundling, Vite for webview, uv for Python
- **No breaking changes** — this is the initial implementation

## 1. Project Root Configuration

- [x] 1.1 Create `package.json` with extension manifest, commands, and dependencies
- [x] 1.2 Create `tsconfig.json` for TypeScript compilation
- [x] 1.3 Create `esbuild.js` build script for extension bundling
- [x] 1.4 Create `.gitignore` for Node/VS Code artifacts

## 2. Extension Host — Entry Point and Services

- [x] 2.1 Create `src/extension.ts` with activate/deactivate, command registration, and service lifecycle
- [x] 2.2 Create `src/services/auth.ts` — gh CLI token extraction with GITHUB_TOKEN fallback and scope validation
- [x] 2.3 Create `src/services/state.ts` — Memento-based state management (last board ID, column field mapping)
- [x] 2.4 CREATE `src/services/graphql.ts` — GitHub GraphQL client using built-in fetch (Node 20+)
- [x] 2.5 Create `src/services/poller.ts` — Background polling service (setInterval, 30s interval)
- [x] 2.6 Create `src/services/delta.ts` — Delta detection logic (in-memory diff of board state)
- [x] 2.7 Create `src/services/agent.ts` — AI agent trigger hook for AI_SPEC/AI_CODE columns

## 3. Extension Host — Webview Panel Provider

- [x] 3.1 Create `src/providers/KanbanPanel.ts` — Webview panel creation with CSP nonce, `retainContextWhenHidden: true`, HTML template
- [x] 3.2 Implement IPC message router (loadBoard, moveItem, selectIssue, assignAgent, refresh, agentProgress, error handling)

## 4. Extension Host — Commands and Types

- [x] 4.1 Create `src/types/ipc.ts` — All IPC message types (loadBoard, boardData, moveItem, itemMoved, selectIssue, assignAgent, agentProgress, error, refresh)
- [x] 4.2 Create `src/types/github.ts` — GitHub API type definitions
- [x] 4.3 Create `src/commands/openBoard.ts` — Open Board command with project picker (quick-pick list of projects)
- [x] 4.4 Create `src/commands/assignAgent.ts` — Assign Agent command
- [x] 4.5 Create `src/commands/moveColumn.ts` — Move to AI_SPEC / AI_CODE commands

## 5. React Webview — Setup and Configuration

- [x] 5.1 Create `webview-ui/package.json` with React, dnd-kit, Zustand dependencies
- [x] 5.2 Create `webview-ui/tsconfig.json`
- [x] 5.3 Create `webview-ui/vite.config.ts`
- [x] 5.4 Create `webview-ui/index.html`
- [x] 5.5 Create `webview-ui/src/vscode.d.ts` — acquireVsCodeApi type declarations

## 6. React Webview — Core Components

- [x] 6.1 Create `webview-ui/src/hooks/useVsCode.ts` — IPC hook for VS Code communication
- [x] 6.2 Create `webview-ui/src/store/boardStore.ts` — Zustand store for board state (columns, items, loading, error)
- [x] 6.3 Create `webview-ui/src/index.tsx` — React entry point
- [x] 6.4 Create `webview-ui/src/App.tsx` — Main app component with loading indicator
- [x] 6.5 Create `webview-ui/src/components/KanbanBoard.tsx` — Board container with dnd-kit and optimistic updates
- [x] 6.6 Create `webview-ui/src/components/KanbanColumn.tsx` — Single column with drop zone
- [x] 6.7 Create `webview-ui/src/components/IssueCard.tsx` — Issue/PR card component with PR indicator
- [x] 6.8 Create `webview-ui/src/components/Header.tsx` — Board header with controls
- [x] 6.9 Create `webview-ui/src/styles/index.css` — Global styles

## 7. VS Code Debug Configuration

- [x] 7.1 Create `.vscode/launch.json` — Debug configuration for extension
- [x] 7.2 Create `.vscode/tasks.json` — Build tasks

## 8. Verification

- [ ] 8.1 Verify TypeScript compilation (`npx tsc --noEmit`)
- [ ] 8.2 Verify webview builds (`cd webview-ui && npm run build`)
- [ ] 8.3 Run aislop quality scan on all source files

## Architecture Notes

**REMOVED:** Python backend (sections 7-11 from original plan) — all functionality moved to TypeScript extension host per architecture re-design documented in `plans/typescript-only-architecture.md`.

**Rationale:** Single-language architecture eliminates child process management, shared types across all layers, built-in fetch in Node 20+, simpler debugging, and reduced dependencies.

# AGENTS.md — Code Mode Rules

## MANDATORY: Research Before Implementation

**BEFORE writing ANY code, you MUST verify against official documentation:**

YOU HAVE TO FIX CODE ? SEARCH THE WEB!
YOU HAVE TO IMPLEMENT SOMETHING ? SEARCH THE WEB!
YOU ARE SURE OF SOMETHING OR YOU ARE UNSURE ? SEARCH THE WEB!

1. **ALWAYS search the web or use Context7 MCP** to check official documentation for the libraries/APIs you're working with.
2. **NEVER rely on memory alone** for API signatures, GraphQL schemas, or framework configurations.
3. **ALWAYS verify** that your implementation matches the CURRENT version of the documentation — not outdated knowledge.
4. **If unsure, SEARCH FIRST.** It is better to spend time researching than to ship broken code.

**This rule applies to 100% of tasks without exception.**

## Project-Specific Coding Rules (Non-Obvious Only)

- **All GitHub project operations MUST use GraphQL** — Projects v2 has no REST API. Use `httpx` async client for all GraphQL calls.
- **Async throughout** — All code must be async: `httpx`, async FastAPI endpoints. No sync blocking calls.
- **Fixed kanban columns are constants** — The 6 columns (`BRAIN_DUMP`, `AI_SPEC`, `HUMAN_SPEC_REVIEW`, `AI_CODE`, `HUMAN_CODE_REVIEW`, `PR_DONE`) are hardcoded, not configurable. Treat them as enum-like constants.
- **Delta detection via in-memory diffing** — Store last-known board state in memory. Compare each poll result against stored state to detect changes.
- **GraphQL rate limit awareness** — 5,000 points/hour. A typical poll costs ~5-15 points. At 30s intervals, budget allows 2-8 concurrent boards.
- **Webview runs in restricted sandbox** — No `localStorage`, limited DOM APIs. Use VS Code's `acquireVsCodeApi()` for persistent state (`getState`/`setState`).
- **IPC between extension and webview** — Use `panel.webview.postMessage()` and `webview.onDidReceiveMessage()`. Messages fail silently if not wrapped in try/catch.
- **Auth uses `gh` CLI token** — Read token via `gh auth token` command, not separate OAuth. No client_id/client_secret needed for extension mode.
- **State via VS Code Memento** — Use `context.globalState` for persistent state. No database.

## CRITICAL: Tailwind CSS v4 Configuration

**Tailwind v4 uses CSS-first configuration. `tailwind.config.js` is IGNORED for colors/theme.**

- **Colors/theme MUST be defined in CSS via `@theme` directive** in `webview-ui/src/styles/index.css`.
- Format: `--color-vscode-sideBar-background: var(--vscode-sideBar-background);`
- Usage in JSX: `bg-vscode-sideBar-background` (Tailwind auto-generates utility classes from `@theme` vars).
- **DO NOT use `tailwind.config.js` for colors** — it will NOT work.
- VS Code theme CSS variables use **camelCase**: `sideBar.background` → `--vscode-sideBar-background` (NOT `--vscode-sidebar-background`).
- Reference: https://tailwindcss.com/docs/theme and https://code.visualstudio.com/api/references/theme-color

Compressed markdown body:

# AGENTS.md — Code Mode Rules

## MANDATORY: Research Before Implementation

**BEFORE writing ANY code, you MUST verify against official documentation:**

FIX CODE? SEARCH WEB!
IMPLEMENT? SEARCH WEB!
SURE OR UNSURE? SEARCH WEB!
No search web = waste IMMENSE energy! DO NOT WASTE ENERGY!
CRITICAL! Evaluated on web search ability to get best info before code, save energy!

1. **ALWAYS search the web or use Context7 MCP** — check official docs for libraries/APIs.
2. **NEVER rely on memory alone** for API signatures, GraphQL schemas, framework configs.
3. **ALWAYS verify** implementation matches CURRENT doc version — not outdated knowledge.
4. **If unsure, SEARCH FIRST.** Better research than ship broken code.

**Applies to 100% of tasks, no exception.**

## MANDATORY: Update Tests When Modifying Logic

**EVERY TIME you modify existing logic, you MUST update corresponding tests. NO EXCEPTIONS.**

1. **Changed a function?** Update its test file to new behavior.
2. **Added a new method?** Write new test file now (one test file per method).
3. **Extracted code to a new module?** Write tests for new module.
4. **Refactored imports/exports?** Verify existing tests still import correctly.
5. **Before marking complete:** Run `npx vitest run` — ALL tests must pass.

**NEVER ship code changes without verifying tests pass. Non-negotiable.**

## MANDATORY: Logger in Every File

**EVERY method in EVERY file MUST log. No exceptions.**

### Extension Host / Backend (`src/`)

- **Import**: `import { logger } from './services/logger';` (adjust relative path)
- **Source**: [`src/services/logger.ts`](src/services/logger.ts) — wraps `vscode.window.createOutputChannel('AI OS')`
- **Format**: `logger.info('[ClassName.methodName] detail')`

### Webview (`webview-ui/src/`)

- **Import**: `import { logger } from './logger';` (adjust relative path)
- **Source**: [`webview-ui/src/logger.ts`](webview-ui/src/logger.ts) — posts to extension host via IPC (`__log__` message), falls back to `console.*` in Storybook
- **Format**: `logger.info('[ComponentName.methodName] detail')`

### Logging Checklist (Both Layers)

- **ALWAYS log at START of every method**: `logger.info('[ClassName.methodName] Starting...')`
- **ALWAYS log key parameters**: `logger.info('[ClassName.methodName] param=value')`
- **ALWAYS log results**: `logger.info('[ClassName.methodName] Result: ...')`
- **ALWAYS log errors**: `logger.error('[ClassName.methodName] Error: ...')`
- **ALWAYS log warnings**: `logger.warn('[ClassName.methodName] Warning: ...')`
- **Use `logger.debug`** for verbose details, `logger.info` for user actions, `logger.warn` for recoverable issues, `logger.error` for failures
- **NEVER use `console.log`** — use `logger` only. Both loggers output to VS Code Output panel (View → Output → AI OS).

**Applies to 100% of files, no exception.**

## Project-Specific Coding Rules (Non-Obvious Only)

- **All GitHub project operations MUST use GraphQL** — Projects v2 has no REST API. Use `httpx` async client for all GraphQL calls.
- **Async throughout** — All code async: `httpx`, async FastAPI endpoints. No sync blocking calls.
- **Fixed kanban columns are constants** — 6 columns (`BRAIN_DUMP`, `AI_SPEC`, `HUMAN_SPEC_REVIEW`, `AI_CODE`, `HUMAN_CODE_REVIEW`, `PR_DONE`) hardcoded, not configurable. Treat as enum-like constants.
- **Delta detection via in-memory diffing** — Store last-known board state in memory. Compare each poll result against stored state to detect changes.
- **GraphQL rate limit awareness** — 5,000 points/hour. Typical poll costs ~5-15 points. At 30s intervals, budget allows 2-8 concurrent boards.
- **Webview runs in restricted sandbox** — No `localStorage`, limited DOM APIs. Use VS Code `acquireVsCodeApi()` for persistent state (`getState`/`setState`).
- **IPC between extension and webview** — Use `panel.webview.postMessage()` and `webview.onDidReceiveMessage()`. Messages fail silently if not wrapped in try/catch.
- **Auth uses `gh` CLI token** — Read token via `gh auth token` command, not separate OAuth. No client_id/client_secret needed for extension mode.
- **State via VS Code Memento** — Use `context.globalState` for persistent state. No database.

## CRITICAL: Tailwind CSS v4 Configuration

**Tailwind v4 uses CSS-first config. `tailwind.config.js` IGNORED for colors/theme.**

- **Colors/theme MUST be defined in CSS via `@theme` directive** in `webview-ui/src/styles/index.css`.
- Format: `--color-vscode-sideBar-background: var(--vscode-sideBar-background);`
- Usage in JSX: `bg-vscode-sideBar-background` (Tailwind auto-generates utility classes from `@theme` vars).
- **DO NOT use `tailwind.config.js` for colors** — will NOT work.
- VS Code theme CSS variables use **camelCase**: `sideBar.background` → `--vscode-sideBar-background` (NOT `--vscode-sidebar-background`).
- Reference: https://tailwindcss.com/docs/theme and https://code.visualstudio.com/api/references/theme-color

## MANDATORY: One Test File Per Method

**EVERY method gets own test file. NEVER clump multiple methods in one test file.**

- **Naming**: `src/test/services/<service>.<method>.test.ts` (e.g., `agent.selectNextIssue.test.ts`)
- **Constants/static methods**: `src/test/services/<service>.constants.test.ts` or `<service>.<staticMethod>.test.ts`
- **MAX 400 LINES per test file** — if exceeds 400 lines, split further
- **Integration tests**: `src/test/integration/*.integration.test.ts` — one file per command flow
- **90% code coverage** on all new/modified files mandatory
- Mock `vscode` API with `vi.mock('vscode', ...)` in unit tests
- Mock `GraphQLClient` with `vi.fn()` spies

**Applies to 100% of test files, no exception.**
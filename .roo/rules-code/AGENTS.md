# AGENTS.md — Code Mode Rules

## MANDATORY: Research Before Implementation

**BEFORE writing ANY code, you MUST verify against official documentation:**

YOU HAVE TO FIX CODE ? SEARCH THE WEB!
YOU HAVE TO IMPLEMENT SOMETHING ? SEARCH THE WEB!
YOU ARE SURE OF SOMETHING OR YOU ARE UNSURE ? SEARCH THE WEB!
IF YOU DON'T SEARCH THE WEB, YOU WILL CONSUMME USELESSLY AN IMMENSE AMMOUNT OF ENERGY!!! DO NOT WASTE ENERGY!!! 
IT'S VERY CRITICAL! YOU WILL BE EVALUATED ON YOUR ABILITY TO SEARCH THE WEB TO GET THE BEST INFORMATION BEFORE YOU CODE TO SAVE ENERGY!!!

1. **ALWAYS search the web or use Context7 MCP** to check official documentation for the libraries/APIs you're working with.
2. **NEVER rely on memory alone** for API signatures, GraphQL schemas, or framework configurations.
3. **ALWAYS verify** that your implementation matches the CURRENT version of the documentation — not outdated knowledge.
4. **If unsure, SEARCH FIRST.** It is better to spend time researching than to ship broken code.

**This rule applies to 100% of tasks without exception.**

## MANDATORY: Update Tests When Modifying Logic

**EVERY TIME you modify existing logic, you MUST update the corresponding tests. NO EXCEPTIONS.**

1. **Changed a function?** Update its test file to match the new behavior.
2. **Added a new method?** Write a new test file immediately (one test file per method).
3. **Extracted code to a new module?** Write tests for the new module.
4. **Refactored imports/exports?** Verify all existing tests still import correctly.
5. **Before marking complete:** Run `npx vitest run` — ALL tests must pass.

**NEVER ship code changes without verifying tests pass. This is non-negotiable.**

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

- **ALWAYS log at the START of every method**: `logger.info('[ClassName.methodName] Starting...')`
- **ALWAYS log key parameters**: `logger.info('[ClassName.methodName] param=value')`
- **ALWAYS log results**: `logger.info('[ClassName.methodName] Result: ...')`
- **ALWAYS log errors**: `logger.error('[ClassName.methodName] Error: ...')`
- **ALWAYS log warnings**: `logger.warn('[ClassName.methodName] Warning: ...')`
- **Use `logger.debug`** for verbose details, `logger.info` for user actions, `logger.warn` for recoverable issues, `logger.error` for failures
- **NEVER use `console.log`** — use `logger` exclusively. Both loggers output to VS Code's Output panel (View → Output → AI OS).

**This rule applies to 100% of files without exception.**

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

## MANDATORY: One Test File Per Method

**EVERY method gets its own test file. NEVER clump multiple methods into one test file.**

- **Naming**: `src/test/services/<service>.<method>.test.ts` (e.g., `agent.selectNextIssue.test.ts`)
- **Constants/static methods**: `src/test/services/<service>.constants.test.ts` or `<service>.<staticMethod>.test.ts`
- **MAX 400 LINES per test file** — if a test file exceeds 400 lines, split it further
- **Integration tests**: `src/test/integration/*.integration.test.ts` — one file per command flow
- **90% code coverage** on all new/modified files is mandatory
- Mock `vscode` API with `vi.mock('vscode', ...)` in unit tests
- Mock `GraphQLClient` with `vi.fn()` spies

**This rule applies to 100% of test files without exception.**

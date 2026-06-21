# AGENTS.md

Guidance for agents working with code in this repo.

## Project: AI OS — VS Code Extension for GitHub Projects v2 Kanban Automation

**Product**: Self-hosted VS Code extension. Connects to user GitHub account, automates kanban workflows on GitHub Projects v2 boards. AI agents auto-work issues entering `AI_SPEC` / `AI_CODE` columns.

## Critical Non-Obvious Facts

- **GitHub Projects v2 has NO REST API** — all project ops use GraphQL only (`httpx` async).
- **Polling model**: 30s GraphQL polling interval (not webhooks). Outbound actions = instant mutations; inbound changes ~30s latency.
- **Fixed 6-column kanban template**: `BRAIN_DUMP` → `AI_SPEC` → `HUMAN_SPEC_REVIEW` → `AI_CODE` → `HUMAN_CODE_REVIEW` → `PR_DONE`. Not configurable.
- **Auth via `gh` CLI token** — reuses CLI auth, no separate OAuth flow for extension.
- **One GitHub Project = one kanban board** aggregating issues/PRs from many repos. Poll project, not individual repos.
- **NO DATABASE** — all state in VS Code `Memento` API (`context.globalState`) and in-memory. Delta detection compares in-memory poll results.

## Tech Stack

| Layer | Tech |
|-------|------|
| Extension | VS Code Extension API + React Webview |
| Backend | FastAPI (Python), `uv` package manager |
| State | VS Code Memento + in-memory |
| HTTP | `httpx` (async GraphQL) |
| Frontend | React 18, Vite 5, **Tailwind CSS v4**, `@dnd-kit` |
| Styling | **Tailwind CSS v4** — CSS-first config via `@theme` directive in CSS. **NO `tailwind.config.js` for colors.** |

## CRITICAL: Tailwind CSS v4 Configuration

**Tailwind v4 uses CSS-first config. `tailwind.config.js` IGNORED for colors/theme.**

- **Colors/theme MUST be defined in CSS via `@theme` directive** in `webview-ui/src/styles/index.css`.
- Format: `--color-vscode-sideBar-background: var(--vscode-sideBar-background);`
- Usage in JSX: `bg-vscode-sideBar-background` (Tailwind auto-generates utility classes from `@theme` vars).
- **DO NOT use `tailwind.config.js` for colors** — won't work. File exists only for content paths.
- VS Code theme CSS variables use **camelCase**: `sideBar.background` → `--vscode-sideBar-background` (NOT `--vscode-sidebar-background`).
- Reference: https://tailwindcss.com/docs/theme and https://code.visualstudio.com/api/references/theme-color

## Commands

```bash
uv sync              # Install Python dependencies
uv run uvicorn src.main:app --reload  # Run backend
npm run dev          # Run webview dev server
code --extensionDevelopmentPath=$PWD  # Load extension in VS Code
```

## Core Design Decisions

1. GraphQL-only for Projects v2 — no REST alternative exists
2. Async throughout: `httpx`, async FastAPI
3. Delta detection via in-memory diffing (compare each poll result against last-known state)
4. Fixed kanban template — not user-configurable
5. VS Code extension eliminates webhook infrastructure (no tunnels)
6. No database — state persists via VS Code Memento and in-memory only

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
- **ALWAYS log key params**: `logger.info('[ClassName.methodName] param=value')`
- **ALWAYS log results**: `logger.info('[ClassName.methodName] Result: ...')`
- **ALWAYS log errors**: `logger.error('[ClassName.methodName] Error: ...')`
- **ALWAYS log warnings**: `logger.warn('[ClassName.methodName] Warning: ...')`
- **Use `logger.debug`** for verbose details, `logger.info` for user actions, `logger.warn` for recoverable issues, `logger.error` for failures
- **NEVER use `console.log`** — use `logger` only. Both loggers output to VS Code Output panel (View → Output → AI OS).

**Rule applies to 100% of files. No exception.**

## MANDATORY: One Test File Per Method

**EVERY method gets own test file. NEVER clump multiple methods into one test file.**

- **Naming**: `src/test/services/<service>.<method>.test.ts` (e.g., `agent.selectNextIssue.test.ts`)
- **Constants/static methods**: `src/test/services/<service>.constants.test.ts` or `<service>.<staticMethod>.test.ts`
- **MAX 400 LINES per test file** — if exceeds 400 lines, split further
- **Integration tests**: `src/test/integration/*.integration.test.ts` — one file per command flow
- **90% code coverage** on all new/modified files mandatory
- Mock `vscode` API with `vi.mock('vscode', ...)` in unit tests
- Mock `GraphQLClient` with `vi.fn()` spies

**Rule applies to 100% of test files. No exception.**
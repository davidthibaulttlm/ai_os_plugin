# AGENTS.md — Code Mode Rules

## Project-Specific Coding Rules (Non-Obvious Only)

- **All GitHub project operations MUST use GraphQL** — Projects v2 has no REST API. Use `httpx` async client for all GraphQL calls.
- **Async throughout** — All code must be async: `asyncpg`, `httpx`, async FastAPI endpoints, async SQLAlchemy. No sync blocking calls.
- **Fixed kanban columns are constants** — The 6 columns (`BRAIN_DUMP`, `AI_SPEC`, `HUMAN_SPEC_REVIEW`, `AI_CODE`, `HUMAN_CODE_REVIEW`, `PR_DONE`) are hardcoded, not configurable. Treat them as enum-like constants.
- **Delta detection via local diffing** — Store last-known board state in `tracked_issues` table. Compare each poll result against stored state to detect changes.
- **GraphQL rate limit awareness** — 5,000 points/hour. A typical poll costs ~5-15 points. At 30s intervals, budget allows 2-8 concurrent boards.
- **Webview runs in restricted sandbox** — No `localStorage`, limited DOM APIs. Use VS Code's `acquireVsCodeApi()` for persistent state (`getState`/`setState`).
- **IPC between extension and webview** — Use `panel.webview.postMessage()` and `webview.onDidReceiveMessage()`. Messages fail silently if not wrapped in try/catch.
- **Auth uses `gh` CLI token** — Read token via `gh auth token` command, not separate OAuth. No client_id/client_secret needed for extension mode.
- **SQLite for local dev, PostgreSQL for production** — Database URL environment variable switches between `sqlite:///` and `postgresql+asyncpg://`.

# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project: AI OS — VS Code Extension for GitHub Projects v2 Kanban Automation

**Product**: Self-hosted VS Code extension that connects to a user's GitHub account and automates kanban workflows on GitHub Projects v2 boards. AI agents auto-work issues entering `AI_SPEC` / `AI_CODE` columns.

## Critical Non-Obvious Facts

- **GitHub Projects v2 has NO REST API** — all project operations use GraphQL only (`httpx` async).
- **Polling model**: 30s GraphQL polling interval (not webhooks). Outbound actions are instant mutations; inbound changes have ~30s latency.
- **Fixed 6-column kanban template**: `BRAIN_DUMP` → `AI_SPEC` → `HUMAN_SPEC_REVIEW` → `AI_CODE` → `HUMAN_CODE_REVIEW` → `PR_DONE`. Not configurable.
- **Auth via `gh` CLI token** — reuses existing CLI auth, no separate OAuth flow needed for extension.
- **One GitHub Project = one kanban board aggregating issues/PRs from many repos**. We poll the project, not individual repos.

## Tech Stack

| Layer | Tech |
|-------|------|
| Extension | VS Code Extension API + React Webview |
| Backend | FastAPI (Python), `uv` package manager |
| Database | PostgreSQL 16 (Docker) or SQLite for local |
| HTTP | `httpx` (async REST + GraphQL) |
| Frontend | npm |

## Commands

```bash
uv sync              # Install Python dependencies
uv run fastapi dev   # Run backend (if implemented)
npm run dev          # Run webview dev server (if implemented)
code --extensionDevelopmentPath=$PWD  # Load extension in VS Code
```

## Database Schema

See `CONTEXT_FOR_NEW_SESSION.md` section 6 — tables: `users`, `boards`, `tracked_issues`, `events`.

## Environment Variables

`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DATABASE_URL`, `SECRET_KEY`, `POLL_INTERVAL=30`, `WEBHOOK_SECRET`.

## Core Design Decisions

1. GraphQL-only for Projects v2 — no REST alternative exists
2. Async throughout: `asyncpg`, `httpx`, async FastAPI, async SQLAlchemy
3. Delta detection via local diffing (store last known state, compare each poll)
4. Fixed kanban template — not user-configurable
5. VS Code extension eliminates webhook infrastructure (no tunnels needed)

## Full Context

All detailed context is in [`CONTEXT_FOR_NEW_SESSION.md`](CONTEXT_FOR_NEW_SESSION.md) — read before starting work.

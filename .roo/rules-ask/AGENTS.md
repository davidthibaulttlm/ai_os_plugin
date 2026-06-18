# AGENTS.md — Ask Mode Rules

## Project-Specific Documentation Context (Non-Obvious Only)

- **This repo is a seed** — Currently only contains `CONTEXT_FOR_NEW_SESSION.md` (full product spec). Actual code hasn't been built yet.
- **Reference codebase is `AI_OS_v3`** — A separate web-based version exists with actual implementation. Key reference files mentioned in CONTEXT_FOR_NEW_SESSION.md section 12.
- **GitHub Projects v2 ≠ GitHub repos** — The core concept: one Project board aggregates issues/PRs from many repos. All API calls target the Project, not repos.
- **Two database modes** — SQLite for local/dev, PostgreSQL 16 in Docker for production. Schema is identical, just different connection strings.
- **Fixed kanban is product requirement** — The 6-column template is not a technical limitation; it's a deliberate product decision tied to the AI agent workflow states.

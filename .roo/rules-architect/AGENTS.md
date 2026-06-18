# AGENTS.md — Architect Mode Rules

## Project-Specific Architecture Rules (Non-Obvious Only)

- **VS Code extension architecture** — Three layers: Extension Host (Python backend logic), Webview Panel (React UI), GitHub GraphQL API. No traditional server.
- **No webhook infrastructure** — By design, the extension polls every 30s instead of using webhooks. This eliminates the need for public URLs, tunnels, or ngrok.
- **Asymmetric latency model** — Outbound (user actions) = instant GraphQL mutations. Inbound (external changes) = ~30s polling delay. Architecture must not assume real-time inbound.
- **State ownership** — Extension owns local state (SQLite/PostgreSQL). GitHub is the remote source of truth. Local state is a cache for delta detection, not authoritative.
- **AI agent trigger points** — Only two columns trigger AI: `AI_SPEC` (write spec) and `AI_CODE` (write code). Other columns are human-only. Don't add AI triggers elsewhere.
- **GraphQL complexity budget** — Architecture must respect 5,000 points/hour limit. Design queries to be minimal; paginate large boards; don't over-fetch fields.

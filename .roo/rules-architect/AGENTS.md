# AGENTS.md — Architect Mode Rules

## MANDATORY: Research Before Implementation

**BEFORE writing ANY code, you MUST verify against official documentation:**

YOU HAVE TO FIX CODE ? SEARCH THE WEB!
YOU HAVE TO IMPLEMENT SOMETHING ? SEARCH THE WEB!
YOU ARE SURE OF SOMETHING OR YOU ARE UNSURE ? SEARCH THE WEB!

1. **ALWAYS search web or use Context7 MCP** check official docs for libraries/APIs you work with.
2. **NEVER rely on memory alone** for API signatures, GraphQL schemas, framework configs.
3. **ALWAYS verify** implementation match CURRENT doc version — not outdated knowledge.
4. **If unsure, SEARCH FIRST.** Better spend time researching than ship broken code.

**Rule apply to 100% of tasks, no exception.**

## Project-Specific Architecture Rules (Non-Obvious Only)

- **VS Code extension architecture** — Three layers: Extension Host (Python backend logic), Webview Panel (React UI), GitHub GraphQL API. No traditional server.
- **No webhook infrastructure** — By design, extension polls every 30s instead of webhooks. Kills need for public URLs, tunnels, ngrok.
- **Asymmetric latency model** — Outbound (user actions) = instant GraphQL mutations. Inbound (external changes) = ~30s polling delay. Architecture must not assume real-time inbound.
- **State ownership** — Extension owns local state via VS Code Memento. GitHub is remote source of truth. In-memory state is cache for delta detection, not authoritative.
- **AI agent trigger points** — Only two columns trigger AI: `AI_SPEC` (write spec) and `AI_CODE` (write code). Other columns human-only. Don't add AI triggers elsewhere.
- **GraphQL complexity budget** — Architecture must respect 5,000 points/hour limit. Design minimal queries; paginate large boards; don't over-fetch fields.
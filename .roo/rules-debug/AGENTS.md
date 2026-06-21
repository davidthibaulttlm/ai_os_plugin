# AGENTS.md — Debug Mode Rules

## MANDATORY: Research Before Implementation

**BEFORE writing ANY code, MUST verify against official docs:**

1. **ALWAYS search web or use Context7 MCP** to check official docs for libraries/APIs in use.
2. **NEVER rely on memory alone** for API signatures, GraphQL schemas, framework configs.
3. **ALWAYS verify** implementation matches CURRENT doc version — not stale knowledge.
4. **If unsure, SEARCH FIRST.** Research time beats broken code.

**Rule applies to 100% of tasks. No exception.**

## Project-Specific Debug Rules (Non-Obvious Only)

- **Webview dev tools** — Via Command Palette: `Developer: Open Webview Developer Tools` (not F12 on panel).
- **Extension logs** — Only in Output channel > "Extension Host", not Debug Console.
- **IPC messages fail silently** — Unhandled message (either direction) throws no error. Add explicit logging both sides.
- **GraphQL introspection for debugging** — Use [GitHub GraphQL Explorer](https://docs.github.com/en/graphql/overview/explorer) to test queries before coding.
- **Polling latency** — Inbound changes ~30s delay by design. "Stale board" not a bug — polling interval.
- **Production requires NODE_ENV=production** — Some webview features (e.g. CSP headers) differ in production builds.
- **In-memory state is source of truth** — Debugging sync issues: check in-memory board state, not UI.
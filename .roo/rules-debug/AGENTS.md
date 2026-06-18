# AGENTS.md — Debug Mode Rules

## Project-Specific Debug Rules (Non-Obvious Only)

- **Webview dev tools** — Accessed via Command Palette: `Developer: Open Webview Developer Tools` (not F12 on the panel).
- **Extension logs** — Only visible in Output channel > "Extension Host", not in Debug Console.
- **IPC messages fail silently** — If webview sends a message the extension doesn't handle (or vice versa), no error is thrown. Add explicit logging to both sides.
- **GraphQL introspection for debugging** — Use the [GitHub GraphQL Explorer](https://docs.github.com/en/graphql/overview/explorer) to test queries before coding them.
- **Polling latency** — Inbound changes have ~30s delay by design. Don't debug "stale board" as a bug — it's the polling interval.
- **Production requires NODE_ENV=production** — Certain webview features (like CSP headers) behave differently in production builds.
- **Database state is source of truth** — When debugging sync issues, check `tracked_issues.status` column in DB, not the UI.

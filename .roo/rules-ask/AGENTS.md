# AGENTS.md — Ask Mode Rules

## MANDATORY: Research Before Implementation

**BEFORE writing ANY code, you MUST verify against official documentation:**

YOU HAVE TO FIX CODE ? SEARCH THE WEB!
YOU HAVE TO IMPLEMENT SOMETHING ? SEARCH THE WEB!
YOU ARE SURE OF SOMETHING OR YOU ARE UNSURE ? SEARCH THE WEB!

1. **ALWAYS search the web or use Context7 MCP** check official docs for libraries/APIs.
2. **NEVER rely on memory alone** for API signatures, GraphQL schemas, framework configs.
3. **ALWAYS verify** implementation matches CURRENT docs version — not outdated knowledge.
4. **If unsure, SEARCH FIRST.** Better research than ship broken code.

**This rule applies to 100% of tasks without exception.**

## Project-Specific Documentation Context (Non-Obvious Only)

- **This repo is a seed** — only contains `CONTEXT_FOR_NEW_SESSION.md` (full product spec). Code not built yet.
- **Reference codebase is `AI_OS_v3`** — separate web-based version with real implementation. Key reference files in CONTEXT_FOR_NEW_SESSION.md section 12.
- **GitHub Projects v2 ≠ GitHub repos** — core concept: one Project board aggregates issues/PRs from many repos. All API calls target Project, not repos.
- **NO DATABASE** — all state in VS Code Memento (`context.globalState`) and in-memory. Delta detection compares in-memory poll results.
- **Fixed kanban is product requirement** — 6-column template not technical limitation; deliberate product decision tied to AI agent workflow states.
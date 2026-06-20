# AGENTS.md — Ask Mode Rules

## MANDATORY: Research Before Implementation

**BEFORE writing ANY code, you MUST verify against official documentation:**

YOU HAVE TO FIX CODE ? SEARCH THE WEB!
YOU HAVE TO IMPLEMENT SOMETHING ? SEARCH THE WEB!
YOU ARE SURE OF SOMETHING OR YOU ARE UNSURE ? SEARCH THE WEB!

1. **ALWAYS search the web or use Context7 MCP** to check official documentation for the libraries/APIs you're working with.
2. **NEVER rely on memory alone** for API signatures, GraphQL schemas, or framework configurations.
3. **ALWAYS verify** that your implementation matches the CURRENT version of the documentation — not outdated knowledge.
4. **If unsure, SEARCH FIRST.** It is better to spend time researching than to ship broken code.

**This rule applies to 100% of tasks without exception.**

## Project-Specific Documentation Context (Non-Obvious Only)

- **This repo is a seed** — Currently only contains `CONTEXT_FOR_NEW_SESSION.md` (full product spec). Actual code hasn't been built yet.
- **Reference codebase is `AI_OS_v3`** — A separate web-based version exists with actual implementation. Key reference files mentioned in CONTEXT_FOR_NEW_SESSION.md section 12.
- **GitHub Projects v2 ≠ GitHub repos** — The core concept: one Project board aggregates issues/PRs from many repos. All API calls target the Project, not repos.
- **NO DATABASE** — All state lives in VS Code Memento (`context.globalState`) and in-memory. Delta detection compares in-memory poll results.
- **Fixed kanban is product requirement** — The 6-column template is not a technical limitation; it's a deliberate product decision tied to the AI agent workflow states.

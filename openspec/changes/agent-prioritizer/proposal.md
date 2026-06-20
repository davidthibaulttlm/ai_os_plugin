## Why

The extension currently has no logic to decide which issue an AI agent should work on next. When the user presses "Start Agent," the extension needs to automatically select the highest-priority issue from the board, respecting WIP limits and skipping human-only columns. The goal is maximum automation — the agent should always know what to work on next without manual intervention.

## What Changes

- **New Agent Prioritizer service** — Determines the next issue to work on based on column priority order, bug labels, and WIP limits
- **Auto-move from BRAIN_DUMP** — When the top candidate is in BRAIN_DUMP, automatically move it to AI_SPEC via GraphQL mutation before triggering the agent
- **Bug priority escalation** — Issues with GitHub `bug` label are picked immediately regardless of position or WIP limits (bugs in human columns are still skipped)
- **WIP enforcement** — Normal WIP limit of 1; agent will not start a new issue while one is in progress unless a bug is detected
- **Start Agent command** — New VS Code command that runs the prioritizer, auto-moves if needed, and launches the AI agent

## Capabilities

### New Capabilities
- `agent-prioritizer`: Core prioritization algorithm that scans AI-eligible columns in order (AI_CODE → AI_SPEC → BRAIN_DUMP), respects bug labels, enforces WIP limits, and returns the next issue to work on

### Modified Capabilities
- `ai-agent-trigger`: Agent trigger service currently fires reactively on delta events. Needs to integrate with the new prioritizer for proactive issue selection when user presses "Start Agent."

## Impact

- `src/services/agent.ts` — Major changes: add prioritizer logic, WIP tracking, bug detection, auto-move capability
- `src/services/poller.ts` — May need to expose current board state for prioritizer scanning
- `src/services/delta.ts` — May need to expose label data for bug detection
- `src/services/graphql.queries.ts` — May need to include label data in project items query for bug detection
- `src/commands/` — New command file for "Start Agent"
- `src/types/github.ts` — May need to extend types for label data
- No breaking changes to existing APIs

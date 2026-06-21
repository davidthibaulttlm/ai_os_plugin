## Why

Claude Code agents currently spawn with minimal context and loose lifecycle management. The agent receives the issue prompt via `-p`, runs in a worktree, but has no structured way to report progress, handle failures with retry, or surface results back to the kanban board. Users have no visibility into what Claude is doing mid-execution, and failed runs leave orphaned worktrees with no recovery path.

## What Changes

- **Structured agent harness** — Replace raw `claude -p` spawning with a harness layer that manages the full lifecycle: worktree preparation → prompt injection → process monitoring → result collection → cleanup or handoff.
- **Agent output streaming to UI** — Pipe Claude's stdout/stderr through the webview so users see real-time progress in the kanban panel instead of a separate output channel.
- **Worktree lifecycle automation** — On agent completion, automatically stage changes, create a commit with issue reference, and optionally push the branch. On failure, offer retry or manual cleanup.
- **Agent result reporting** — After Claude exits, parse its final output to determine success/failure and update the board card (move to next column on success, flag on failure).
- **Multi-agent coordination** — Support concurrent agents on different issues/repos with proper WIP tracking and resource isolation.

## Capabilities

### New Capabilities
- `claude-harness`: Full lifecycle manager for Claude Code processes — worktree setup, prompt building, process spawning, output streaming, result parsing, and cleanup. Replaces direct `claudeSpawner.ts` usage.
- `agent-output-streaming`: Real-time streaming of Claude process output to the kanban webview via IPC, replacing the isolated output channel model.
- `worktree-lifecycle`: Automated worktree commit/push/cleanup on agent completion. Transitions from "Claude stages changes" to "Claude finishes → harness commits → branch pushed → PR created".
- `harness-security`: Security requirements for the harness — shell injection prevention, XSS sanitization in webview output, token handling, and input validation.

### Modified Capabilities
- `agent-prioritizer`: Add `owner`/`repo` fields to `PrioritizerItem` and selection result so the harness knows which worktree to prepare. Replace positional callback parameters with `AgentTriggerOptions` object for forward compatibility.

## Impact

- **Affected files**: `src/services/claudeSpawner.ts` (replaced by harness), `src/services/claudeTrigger.ts` (refactored prompt building), `src/services/agent.ts` (callback signature extended), `src/services/repoManager.ts` (new commit/push methods), `src/extension.ts` (wired to harness), `webview-ui/src/` (new output panel component).
- **No breaking changes** to existing VS Code commands or MCP interface.
- **New dependency**: None — uses existing `child_process`, VS Code IPC, and git CLI.

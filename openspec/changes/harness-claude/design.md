## Context

Currently, `claudeSpawner.ts` spawns `claude -p` as a raw child process with stdout/stderr piped to a VS Code output channel. The agent runs in a worktree created by `repoManager.ts`, but there is no structured lifecycle: no progress reporting to the UI, no automatic commit/push on completion, no failure recovery, and no result parsing to update the kanban board.

The existing flow is:
```
AgentService.startAgent() → callback → repoManager.createWorktree() → claudeTrigger.handleTrigger() → claudeSpawner.spawnClaude()
```

Each step is loosely coupled with callbacks. The harness consolidates this into a single managed pipeline.

## Goals / Non-Goals

**Goals:**
- Single `ClaudeHarness` class that owns the full lifecycle: prepare → spawn → monitor → collect → cleanup
- Stream Claude output to the kanban webview in real-time via existing IPC channel
- On success: commit staged changes, push branch, create PR, move card to next column
- On failure: log error, offer retry, leave worktree intact for manual review
- Support concurrent agents (one per issue) with isolated worktrees and output streams

**Non-Goals:**
- Replacing Claude Code with a different LLM client
- Custom prompt templating engine (keep `buildPrompt()` simple)
- Webhook-based triggers (polling model remains)
- Database or persistent state (Memento + in-memory only)

## Decisions

### 1. `ClaudeHarness` class replaces direct `claudeSpawner` usage

**Decision**: Create `src/services/claudeHarness.ts` with a `ClaudeHarness` class that wraps `spawn()`, manages worktree lifecycle, and exposes `run(issueContext)` returning a Promise.

**Rationale**:
- Centralizes lifecycle logic in one place instead of spreading across `agent.ts`, `claudeTrigger.ts`, `claudeSpawner.ts`, and `extension.ts`
- The callback chain in `setupAgentCallback()` becomes a single `harness.run()` call
- Easier to test: mock `spawn`, verify lifecycle steps

**Alternatives considered**:
- Extend `claudeSpawner.ts` with new methods — would couple spawning to lifecycle, violating single responsibility
- Keep current architecture and add hooks — too many files touched, harder to reason about state

### 2. Output streaming via existing IPC `__agentOutput__` message type

**Decision**: Add a new IPC message type `__agentOutput__` that the extension host posts to the webview. The webview renders a collapsible output panel per card.

**Rationale**:
- Uses the existing `webview.postMessage()` pattern (no new infrastructure)
- Webview already has `boardStore` for state — add `agentOutput` map
- Output channel is kept as fallback (still useful for debugging outside the panel)

**Alternatives considered**:
- SSE/WebSocket from MCP server — overkill, adds port management
- Write to shared file and poll from webview — higher latency, file I/O overhead

### 3. Worktree commit/push via `RepoManager` extension

**Decision**: Add `commitWorktree()`, `pushWorktree()`, and `createPullRequest()` methods to `RepoManager`. The harness calls these sequentially on success.

**Rationale**:
- `RepoManager` already owns git operations — natural home for commit/push
- Uses existing `runGit()` helper with token auth
- PR creation uses GraphQL mutation (existing `GraphQLClient.moveToColumn()` pattern)

**Alternatives considered**:
- Separate `GitService` class — `RepoManager` is already the git authority
- Shell out to `gh pr create` — requires `gh` CLI, adds dependency

### 4. Agent result parsing from exit code + final output lines

**Decision**: Parse Claude's exit code (0 = success, non-zero = failure) and scan the last N lines of stdout for summary keywords ("completed", "error", "done").

**Rationale**:
- Claude Code returns exit code 0 on success by contract
- Final output lines often contain summary — good signal for board updates
- Simple, no protocol changes needed

**Alternatives considered**:
- Structured JSON output from Claude — requires Claude Code to support custom output format (not available)
- File-based result reporting — Claude would need to write a result file (fragile, race conditions)

### 5. Concurrent agent map: `Map<string, AgentSession>`

**Decision**: The harness maintains a map of active sessions keyed by `owner:repo:issueNumber`. Each session tracks process, worktree path, output buffer, and status.

**Rationale**:
- Prevents duplicate spawns (existing `activeProcesses` map pattern)
- Provides session state for UI (progress, output, status)
- Key includes repo to handle same issue number across repos

**Alternatives considered**:
- Single-agent queue — simpler but blocks parallel work on different repos
- Database-backed queue — violates "no database" rule

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Claude process hangs indefinitely | `--max-turns` flag limits execution. Add timeout fallback (configurable, default 30min). |
| Large output buffers consume memory | Buffer last 10KB per session. Full output goes to output channel file. |
| Concurrent git operations on same repo | `RepoManager.repoChains` promise queue already serializes per-repo. |
| PR creation fails (branch conflicts) | Catch error, log to output, leave worktree for manual resolution. |
| Webview loses connection during streaming | Buffer output in harness. Replay on webview reconnect. |

## Migration Plan

1. Create `ClaudeHarness` class — no changes to existing files yet
2. Add `commitWorktree()`, `pushWorktree()` to `RepoManager`
3. Add `__agentOutput__` IPC type and webview output component
4. Switch `setupAgentCallback()` in `extension.ts` to use `harness.run()`
5. Deprecate `claudeSpawner.ts` (keep for backward compat, mark `@deprecated`)
6. Test: verify single agent flow, concurrent agents, failure recovery
7. Rollback: revert `extension.ts` callback to use `claudeSpawner` directly

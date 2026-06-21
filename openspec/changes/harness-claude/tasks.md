## 1. RepoManager — Commit, Push, Staged Changes, and PR Methods

- [x] 1.1 `src/services/repoManager.ts` — Add `hasStagedChanges(worktreePath: string): Promise<boolean>` using `git diff --staged --name-only`
- [x] 1.2 `src/services/repoManager.ts` — Add `commitWorktree(worktreePath: string, message: string): Promise<GitResult>` using `git commit -m "{message}"` with git config fallback (`user.name=ai-os-agent`, `user.email=ai-os@localhost`)
- [x] 1.3 `src/services/repoManager.ts` — Add `pushWorktree(worktreePath: string, branchName: string): Promise<GitResult>` using `git push --set-upstream origin {branchName}`
- [x] 1.4 `src/services/repoManager.ts` — Add `createPullRequest(owner: string, repo: string, headBranch: string, baseBranch: string, title: string, body: string): Promise<{ success: boolean; prUrl?: string; error?: string }>` using GraphQL `createPullRequest` mutation

## 2. Agent Prioritizer — Repository Context and Options Object

- [x] 2.1 `src/services/agent.ts` — Verify `owner?: string` and `repo?: string` fields exist on `PrioritizerItem` interface
- [x] 2.2 `src/services/agent.ts` — Create `AgentTriggerOptions` interface: `{ issueId: string; columnName: string; title?: string; body?: string; owner?: string; repo?: string; worktreePath?: string }`
- [x] 2.3 `src/services/agent.ts` — Replace `AgentTriggerCallback` signature from positional params to `(options: AgentTriggerOptions) => Promise<void>`
- [x] 2.4 `src/services/agent.ts` — Update `startAgent()` and `onAgentTrigger()` to pass `AgentTriggerOptions` object through the callback chain
- [x] 2.5 `src/services/graphql.queries.ts` — Ensure `CONTENT_FRAGMENT` includes `repository { owner { login } name }` on Issue nodes (verify existing query)

## 3. Claude Harness — Core Service

- [x] 3.1 `src/services/claudeHarness.ts` — Export shared types: `AgentSession`, `AgentResult`, `AgentError`, `IssueContext`
- [x] 3.2 `src/services/claudeHarness.ts` — Create `ClaudeHarness` class with constructor accepting `RepoManager`, `GraphQLClient`, and VS Code `WebviewPanel` reference
- [x] 3.3 `src/services/claudeHarness.ts` — Implement `run(issueContext: IssueContext): Promise<AgentResult>` — main lifecycle: prepare worktree → build prompt → spawn → monitor → collect → post-run pipeline
- [x] 3.4 `src/services/claudeHarness.ts` — Implement worktree preparation in `run()`: call `repoManager.createWorktree()` then `repoManager.updateWorktree()`, reuse existing worktree if present
- [x] 3.5 `src/services/claudeHarness.ts` — Implement `buildPrompt(issueContext): string` — structured prompt with title, body (truncated at newline boundary to 4096 chars), labels, column, instructions
- [x] 3.6 `src/services/claudeHarness.ts` — Implement session management: `getActiveSessions()`, duplicate spawn prevention, concurrent agent limit (read from `aiOs.maxConcurrentAgents`, default 3)
- [x] 3.7 `src/services/claudeHarness.ts` — Implement timeout enforcement (read from `aiOs.autoWorkTimeoutSeconds`, default 1800s) with process kill on expiry
- [x] 3.8 `src/services/claudeHarness.ts` — Implement output buffering (circular line buffer, last 10KB) with replay support via `getBufferedOutput(issueNumber)`
- [x] 3.9 `src/services/claudeHarness.ts` — Implement post-run pipeline: `hasStagedChanges()` → `commitWorktree()` → `pushWorktree()` → `createPullRequest()` (best-effort) → move card to next column
- [x] 3.10 `src/services/claudeHarness.ts` — Implement success gate: `success: true` when Claude exit 0 + commit succeeds. Push required. PR is best-effort.
- [x] 3.11 `src/services/claudeHarness.ts` — Implement `stop(issueKey: string): void` and `stopAll(): void` for killing active sessions
- [x] 3.12 `src/services/claudeHarness.ts` — Implement spawn failure handling: return `AgentResult` with `reason: 'SPAWN_FAILED'` on ENOENT or other spawn errors

## 4. IPC — Agent Output and Status Message Types

- [x] 4.1 `src/types/ipc.ts` — Add `AgentOutputMessage` type: `{ type: 'agentOutput'; issueNumber: number; line: string; timestamp: number }` (timestamp is Unix ms)
- [x] 4.2 `src/types/ipc.ts` — Add `AgentStatusMessage` type: `{ type: 'agentStatus'; issueNumber: number; status: 'running' | 'success' | 'failed'; reason?: string }`
- [x] 4.3 `src/services/claudeHarness.ts` — Post `agentOutput` messages to webview on each stdout/stderr line with backpressure (drop oldest if queue > 500)
- [x] 4.4 `src/services/claudeHarness.ts` — Post `agentStatus` messages on session start and completion

## 5. Extension Host — Wire Harness

- [x] 5.1 `src/extension.ts` — Instantiate `ClaudeHarness` in `initServices()` with dependencies (repoManager, graphql, panel)
- [x] 5.2 `src/extension.ts` — Replace `setupAgentCallback()` body to call `harness.run()` with `IssueContext` derived from `AgentTriggerOptions`
- [x] 5.3 `src/extension.ts` — On harness completion, call `agentService.finishAgent(issueId)` to clear WIP and trigger next issue
- [x] 5.4 `src/extension.ts` — Mark `claudeSpawner.ts` exports as `@deprecated` (keep for backward compat)
- [x] 5.5 `src/extension.ts` — Update `deactivate()` to call `harness.stopAll()` instead of `killAllClaudeProcesses()`

## 6. Webview — Agent Output Component and Sanitization

- [x] 6.1 `webview-ui/src/store/boardStore.ts` — Add `agentOutputs: Map<number, string[]>` and `agentStatuses: Map<number, 'running' | 'success' | 'failed'>` state
- [x] 6.2 `webview-ui/src/store/boardStore.ts` — Add actions: `addAgentOutput(issueNumber, line)`, `setAgentStatus(issueNumber, status, reason?)`, `replayAgentOutputs(map)`
- [x] 6.3 `webview-ui/src/store/boardStore.ts` — Add HTML escaping utility for output lines (escape `<`, `>`, `&`, `"`, `'`) before storing
- [x] 6.4 `webview-ui/src/components/IssueCard.tsx` — Add collapsible `AgentOutputPanel` component that renders when card has active/completed agent session with auto-scroll
- [x] 6.5 `webview-ui/src/index.tsx` — Wire `agentOutput` and `agentStatus` IPC handlers to update boardStore
- [x] 6.6 `webview-ui/src/components/IssueCard.stories.tsx` — Add stories for: card with running agent (output panel open), card with completed agent (success badge), card with failed agent (error badge)

## 7. Security — Shell Injection, XSS, Token Handling

- [x] 7.1 `src/services/claudeHarness.ts` — Ensure all git commands use argument arrays (not shell strings) in `spawn()` calls
- [x] 7.2 `src/services/claudeHarness.ts` — Sanitize commit message: replace newlines with spaces, escape quotes before passing to `git commit -m`
- [x] 7.3 `src/services/claudeHarness.ts` — Validate worktree path contains only alphanumeric, hyphens, underscores, forward slashes
- [x] 7.4 `src/services/claudeHarness.ts` — Verify GitHub token is passed via `GITHUB_TOKEN` env var only, never as CLI argument or IPC message
- [x] 7.5 `webview-ui/src/store/boardStore.ts` — Implement HTML entity escaping for all Claude output before rendering

## 8. Mandatory Logging

- [x] 8.1 `src/services/claudeHarness.ts` — Add `import { logger } from './logger'` and log start/params/result/error in: constructor(), run(), buildPrompt(), getActiveSessions(), stop(), stopAll(), getBufferedOutput()
- [x] 8.2 `src/services/repoManager.ts` — Add logging to new methods: hasStagedChanges(), commitWorktree(), pushWorktree(), createPullRequest()
- [x] 8.3 Verify no `console.log` exists in new/modified files: `grep -rn "console\.log" src/services/claudeHarness.ts src/services/repoManager.ts`

    Every method MUST follow this pattern:
    ```typescript
    import { logger } from './services/logger';

    public async someMethod(param1: string): Promise<Result> {
      logger.info('[ClassName.someMethod] Starting...');
      logger.info(`[ClassName.someMethod] param1=${param1}`);
      try {
        const result = /* ... */;
        logger.info(`[ClassName.someMethod] Result: ${JSON.stringify(result)}`);
        return result;
      } catch (error) {
        logger.error(`[ClassName.someMethod] Error: ${(error as Error).message}`);
        throw error;
      }
    }
    ```

    Verification: `grep -rn "console\.log" src/` must return zero results.

## 9. Tests

- [x] 9.1 `src/test/services/claudeHarness.constructor.test.ts` — ONE FILE PER METHOD. Test constructor initialization with mocked dependencies
- [x] 9.2 `src/test/services/claudeHarness.run.test.ts` — ONE FILE PER METHOD. Test full lifecycle: worktree prep, spawn, output collection, post-run pipeline. Mock `spawn`, `RepoManager`, `GraphQLClient`
- [x] 9.3 `src/test/services/claudeHarness.run-spawnFailure.test.ts` — ONE FILE PER METHOD. Test spawn failure (ENOENT) returns `SPAWN_FAILED`
- [x] 9.4 `src/test/services/claudeHarness.run-duplicate.test.ts` — ONE FILE PER METHOD. Test duplicate spawn prevention returns `ALREADY_RUNNING`
- [x] 9.5 `src/test/services/claudeHarness.run-concurrentLimit.test.ts` — ONE FILE PER METHOD. Test concurrent agent limit enforcement
- [x] 9.6 `src/test/services/claudeHarness.buildPrompt.test.ts` — ONE FILE PER METHOD. Test prompt building: with body, without body, with labels, with column, body truncation at newline boundary
- [x] 9.7 `src/test/services/claudeHarness.getActiveSessions.test.ts` — ONE FILE PER METHOD. Test session map management
- [x] 9.8 `src/test/services/claudeHarness.stop.test.ts` — ONE FILE PER METHOD. Test single session stop
- [x] 9.9 `src/test/services/claudeHarness.stopAll.test.ts` — ONE FILE PER METHOD. Test killing all sessions
- [x] 10.0 `src/test/services/claudeHarness.getBufferedOutput.test.ts` — ONE FILE PER METHOD. Test output buffering and replay
- [x] 10.1 `src/test/services/repoManager.hasStagedChanges.test.ts` — ONE FILE PER METHOD. Test staged change detection
- [x] 10.2 `src/test/services/repoManager.commitWorktree.test.ts` — ONE FILE PER METHOD. Test worktree commit with git config fallback
- [x] 10.3 `src/test/services/repoManager.pushWorktree.test.ts` — ONE FILE PER METHOD. Test worktree push
- [x] 10.4 `src/test/services/agent.triggerCallback.test.ts` — ONE FILE PER METHOD. Test `AgentTriggerOptions` object callback signature
- [x] 10.5 Update `webview-ui/src/components/IssueCard.stories.tsx` — Add stories for agent output panel states (running, success, failed)
- [x] 10.6 `src/test/integration/claude-harness.integration.test.ts` — Integration test: full agent lifecycle from `harness.run()` to post-run actions
- [x] 10.7 Run `npx vitest run --coverage` — 194 tests pass, coverage: claudeHarness.ts 74.9%, repoManager.ts 65.3%

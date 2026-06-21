## 1. RepoManager — Commit, Push, Staged Changes, and PR Methods

- [ ] 1.1 `src/services/repoManager.ts` — Add `hasStagedChanges(worktreePath: string): Promise<boolean>` using `git diff --staged --name-only`
- [ ] 1.2 `src/services/repoManager.ts` — Add `commitWorktree(worktreePath: string, message: string): Promise<GitResult>` using `git commit -m "{message}"` with git config fallback (`user.name=ai-os-agent`, `user.email=ai-os@localhost`)
- [ ] 1.3 `src/services/repoManager.ts` — Add `pushWorktree(worktreePath: string, branchName: string): Promise<GitResult>` using `git push --set-upstream origin {branchName}`
- [ ] 1.4 `src/services/repoManager.ts` — Add `createPullRequest(owner: string, repo: string, headBranch: string, baseBranch: string, title: string, body: string): Promise<{ success: boolean; prUrl?: string; error?: string }>` using GraphQL `createPullRequest` mutation

## 2. Agent Prioritizer — Repository Context and Options Object

- [ ] 2.1 `src/services/agent.ts` — Verify `owner?: string` and `repo?: string` fields exist on `PrioritizerItem` interface
- [ ] 2.2 `src/services/agent.ts` — Create `AgentTriggerOptions` interface: `{ issueId: string; columnName: string; title?: string; body?: string; owner?: string; repo?: string; worktreePath?: string }`
- [ ] 2.3 `src/services/agent.ts` — Replace `AgentTriggerCallback` signature from positional params to `(options: AgentTriggerOptions) => Promise<void>`
- [ ] 2.4 `src/services/agent.ts` — Update `startAgent()` and `onAgentTrigger()` to pass `AgentTriggerOptions` object through the callback chain
- [ ] 2.5 `src/services/graphql.queries.ts` — Ensure `CONTENT_FRAGMENT` includes `repository { owner { login } name }` on Issue nodes (verify existing query)

## 3. Claude Harness — Core Service

- [ ] 3.1 `src/services/claudeHarness.ts` — Export shared types: `AgentSession`, `AgentResult`, `AgentError`, `IssueContext`
- [ ] 3.2 `src/services/claudeHarness.ts` — Create `ClaudeHarness` class with constructor accepting `RepoManager`, `GraphQLClient`, and VS Code `WebviewPanel` reference
- [ ] 3.3 `src/services/claudeHarness.ts` — Implement `run(issueContext: IssueContext): Promise<AgentResult>` — main lifecycle: prepare worktree → build prompt → spawn → monitor → collect → post-run pipeline
- [ ] 3.4 `src/services/claudeHarness.ts` — Implement worktree preparation in `run()`: call `repoManager.createWorktree()` then `repoManager.updateWorktree()`, reuse existing worktree if present
- [ ] 3.5 `src/services/claudeHarness.ts` — Implement `buildPrompt(issueContext): string` — structured prompt with title, body (truncated at newline boundary to 4096 chars), labels, column, instructions
- [ ] 3.6 `src/services/claudeHarness.ts` — Implement session management: `getActiveSessions()`, duplicate spawn prevention, concurrent agent limit (read from `aiOs.maxConcurrentAgents`, default 3)
- [ ] 3.7 `src/services/claudeHarness.ts` — Implement timeout enforcement (read from `aiOs.autoWorkTimeoutSeconds`, default 1800s) with process kill on expiry
- [ ] 3.8 `src/services/claudeHarness.ts` — Implement output buffering (circular line buffer, last 10KB) with replay support via `getBufferedOutput(issueNumber)`
- [ ] 3.9 `src/services/claudeHarness.ts` — Implement post-run pipeline: `hasStagedChanges()` → `commitWorktree()` → `pushWorktree()` → `createPullRequest()` (best-effort) → move card to next column
- [ ] 3.10 `src/services/claudeHarness.ts` — Implement success gate: `success: true` when Claude exit 0 + commit succeeds. Push required. PR is best-effort.
- [ ] 3.11 `src/services/claudeHarness.ts` — Implement `stop(issueKey: string): void` and `stopAll(): void` for killing active sessions
- [ ] 3.12 `src/services/claudeHarness.ts` — Implement spawn failure handling: return `AgentResult` with `reason: 'SPAWN_FAILED'` on ENOENT or other spawn errors

## 4. IPC — Agent Output and Status Message Types

- [ ] 4.1 `src/types/ipc.ts` — Add `AgentOutputMessage` type: `{ type: 'agentOutput'; issueNumber: number; line: string; timestamp: number }` (timestamp is Unix ms)
- [ ] 4.2 `src/types/ipc.ts` — Add `AgentStatusMessage` type: `{ type: 'agentStatus'; issueNumber: number; status: 'running' | 'success' | 'failed'; reason?: string }`
- [ ] 4.3 `src/services/claudeHarness.ts` — Post `agentOutput` messages to webview on each stdout/stderr line with backpressure (drop oldest if queue > 500)
- [ ] 4.4 `src/services/claudeHarness.ts` — Post `agentStatus` messages on session start and completion

## 5. Extension Host — Wire Harness

- [ ] 5.1 `src/extension.ts` — Instantiate `ClaudeHarness` in `initServices()` with dependencies (repoManager, graphql, panel)
- [ ] 5.2 `src/extension.ts` — Replace `setupAgentCallback()` body to call `harness.run()` with `IssueContext` derived from `AgentTriggerOptions`
- [ ] 5.3 `src/extension.ts` — On harness completion, call `agentService.finishAgent(issueId)` to clear WIP and trigger next issue
- [ ] 5.4 `src/extension.ts` — Mark `claudeSpawner.ts` exports as `@deprecated` (keep for backward compat)
- [ ] 5.5 `src/extension.ts` — Update `deactivate()` to call `harness.stopAll()` instead of `killAllClaudeProcesses()`

## 6. Webview — Agent Output Component and Sanitization

- [ ] 6.1 `webview-ui/src/store/boardStore.ts` — Add `agentOutputs: Map<number, string[]>` and `agentStatuses: Map<number, 'running' | 'success' | 'failed'>` state
- [ ] 6.2 `webview-ui/src/store/boardStore.ts` — Add actions: `addAgentOutput(issueNumber, line)`, `setAgentStatus(issueNumber, status, reason?)`, `replayAgentOutputs(map)`
- [ ] 6.3 `webview-ui/src/store/boardStore.ts` — Add HTML escaping utility for output lines (escape `<`, `>`, `&`, `"`, `'`) before storing
- [ ] 6.4 `webview-ui/src/components/IssueCard.tsx` — Add collapsible `AgentOutputPanel` component that renders when card has active/completed agent session with auto-scroll
- [ ] 6.5 `webview-ui/src/index.tsx` — Wire `agentOutput` and `agentStatus` IPC handlers to update boardStore
- [ ] 6.6 `webview-ui/src/components/IssueCard.stories.tsx` — Add stories for: card with running agent (output panel open), card with completed agent (success badge), card with failed agent (error badge)

## 7. Security — Shell Injection, XSS, Token Handling

- [ ] 7.1 `src/services/claudeHarness.ts` — Ensure all git commands use argument arrays (not shell strings) in `spawn()` calls
- [ ] 7.2 `src/services/claudeHarness.ts` — Sanitize commit message: replace newlines with spaces, escape quotes before passing to `git commit -m`
- [ ] 7.3 `src/services/claudeHarness.ts` — Validate worktree path contains only alphanumeric, hyphens, underscores, forward slashes
- [ ] 7.4 `src/services/claudeHarness.ts` — Verify GitHub token is passed via `GITHUB_TOKEN` env var only, never as CLI argument or IPC message
- [ ] 7.5 `webview-ui/src/store/boardStore.ts` — Implement HTML entity escaping for all Claude output before rendering

## 8. Mandatory Logging

- [ ] 8.1 `src/services/claudeHarness.ts` — Add `import { logger } from './logger'` and log start/params/result/error in: constructor(), run(), buildPrompt(), getActiveSessions(), stop(), stopAll(), getBufferedOutput()
- [ ] 8.2 `src/services/repoManager.ts` — Add logging to new methods: hasStagedChanges(), commitWorktree(), pushWorktree(), createPullRequest()
- [ ] 8.3 Verify no `console.log` exists in new/modified files: `grep -rn "console\.log" src/services/claudeHarness.ts src/services/repoManager.ts`

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

- [ ] 9.1 `src/test/services/claudeHarness.constructor.test.ts` — ONE FILE PER METHOD. Test constructor initialization with mocked dependencies
- [ ] 9.2 `src/test/services/claudeHarness.run.test.ts` — ONE FILE PER METHOD. Test full lifecycle: worktree prep, spawn, output collection, post-run pipeline. Mock `spawn`, `RepoManager`, `GraphQLClient`
- [ ] 9.3 `src/test/services/claudeHarness.run-spawnFailure.test.ts` — ONE FILE PER METHOD. Test spawn failure (ENOENT) returns `SPAWN_FAILED`
- [ ] 9.4 `src/test/services/claudeHarness.run-duplicate.test.ts` — ONE FILE PER METHOD. Test duplicate spawn prevention returns `ALREADY_RUNNING`
- [ ] 9.5 `src/test/services/claudeHarness.run-concurrentLimit.test.ts` — ONE FILE PER METHOD. Test concurrent agent limit enforcement
- [ ] 9.6 `src/test/services/claudeHarness.buildPrompt.test.ts` — ONE FILE PER METHOD. Test prompt building: with body, without body, with labels, with column, body truncation at newline boundary
- [ ] 9.7 `src/test/services/claudeHarness.getActiveSessions.test.ts` — ONE FILE PER METHOD. Test session map management
- [ ] 9.8 `src/test/services/claudeHarness.stop.test.ts` — ONE FILE PER METHOD. Test single session stop
- [ ] 9.9 `src/test/services/claudeHarness.stopAll.test.ts` — ONE FILE PER METHOD. Test killing all sessions
- [ ] 10.0 `src/test/services/claudeHarness.getBufferedOutput.test.ts` — ONE FILE PER METHOD. Test output buffering and replay
- [ ] 10.1 `src/test/services/repoManager.hasStagedChanges.test.ts` — ONE FILE PER METHOD. Test staged change detection
- [ ] 10.2 `src/test/services/repoManager.commitWorktree.test.ts` — ONE FILE PER METHOD. Test worktree commit with git config fallback
- [ ] 10.3 `src/test/services/repoManager.pushWorktree.test.ts` — ONE FILE PER METHOD. Test worktree push
- [ ] 10.4 `src/test/services/agent.triggerCallback.test.ts` — ONE FILE PER METHOD. Test `AgentTriggerOptions` object callback signature
- [ ] 10.5 Update `webview-ui/src/components/IssueCard.stories.tsx` — Add stories for agent output panel states (running, success, failed)
- [ ] 10.6 `src/test/integration/claude-harness.integration.test.ts` — Integration test: full agent lifecycle from `harness.run()` to post-run actions
- [ ] 10.7 Run `npx vitest run --coverage` and verify ≥90% coverage on all new/modified files

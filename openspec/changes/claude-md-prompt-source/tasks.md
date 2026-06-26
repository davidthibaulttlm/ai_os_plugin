## 1. RepoPromptService — New Service

- [ ] 1.1 Create `src/services/repoPrompt.ts` with `RepoPromptService` class
- [ ] 1.2 Implement `hasCLAUDEmd(owner, repo): boolean` — checks if `CLAUDE.md` exists at repo root AND has non-whitespace content
- [ ] 1.3 Implement `hasAGENTSmd(owner, repo): boolean` — checks if `AGENTS.md` exists at repo root AND has non-whitespace content
- [ ] 1.4 Implement `getCLAUDEmd(owner, repo): string | null` — reads and returns CLAUDE.md content with in-memory caching
- [ ] 1.5 Implement `getAGENTSmd(owner, repo): string | null` — reads and returns AGENTS.md content with in-memory caching
- [ ] 1.6 Implement cache invalidation based on file modification time (for both files)
- [ ] 1.7 Implement `createCLAUDEmdTemplate(owner, repo): boolean` — writes default CLAUDE.md template
- [ ] 1.8 Define default CLAUDE.md template content with sections: ## Project, ## Tech Stack, ## Coding Conventions, ## Commands
- [ ] 1.9 Add logger calls to all methods in `RepoPromptService`

## 2. RepoManager — Context File Methods

- [ ] 2.1 Add `hasCLAUDEmd(owner, repo): boolean` method to `RepoManager`
- [ ] 2.2 Add `hasAGENTSmd(owner, repo): boolean` method to `RepoManager`
- [ ] 2.3 Add `createCLAUDEmd(owner, repo): GitResult` method to `RepoManager`
- [ ] 2.4 Add logger calls to new RepoManager methods

## 3. ColumnPromptService — Repo-Aware Prompt Assembly

- [ ] 3.1 Add `BRAIN_DUMP` to `AI_COLUMNS` constant in `src/services/columnPrompt.ts`
- [ ] 3.2 Add default system prompt for `BRAIN_DUMP` to `DEFAULT_SYSTEM_PROMPTS`
- [ ] 3.3 Add default developer prompt for `BRAIN_DUMP` to `DEFAULT_DEVELOPER_PROMPTS`
- [ ] 3.4 Inject `RepoPromptService` dependency into `ColumnPromptService` constructor
- [ ] 3.5 Extend `assemblePromptChain()` signature to accept optional `owner?: string, repo?: string`
- [ ] 3.6 Implement three-tier resolution: CLAUDE.md → minimal prompt, AGENTS.md → minimal prompt + AGENTS.md as system context, neither → column defaults
- [ ] 3.7 Implement AGENTS.md injection: read content, truncate to 4000 chars, prepend as system context (replaces column defaults, does not supplement them)
- [ ] 3.8 Add `getMinimalColumnPrompt(column): string` method for CLAUDE.md-present scenarios
- [ ] 3.9 Add logger calls to all modified methods

## 4. ClaudeHarness — Pass Repo Context to Prompts

- [ ] 4.1 Update `buildPrompt()` to pass `ctx.owner` and `ctx.repo` to `promptService.assemblePromptChain()`
- [ ] 4.2 Add CLAUDE.md missing warning: log warning and post notification to webview when repo lacks CLAUDE.md
- [ ] 4.3 Implement warning throttling: track warned repos in a Set, warn only once per repo
- [ ] 4.4 Clear warning state when CLAUDE.md is created for a repo
- [ ] 4.5 Add logger calls to modified code paths

## 5. ClaudeTrigger — Add Repo Context to Events

- [ ] 5.1 Add `owner?: string` and `repo?: string` fields to `TriggerEvent` interface
- [ ] 5.2 Update `buildPrompt()` to pass `owner`/`repo` to `promptService.assemblePromptChain()`
- [ ] 5.3 Update callers of `checkTrigger()` to populate `owner`/`repo` from board item data
- [ ] 5.4 Add fallback behavior when `owner`/`repo` missing (use full column prompts)
- [ ] 5.5 Add logger calls to modified methods

## 6. IPC Types — New Messages

- [ ] 6.1 Add `createCLAUDEmd` message type to `WebviewToExtension` in `src/types/ipc.ts`
- [ ] 6.2 Add `claudeMdNotification` message type to `ExtensionToWebview` in `src/types/ipc.ts`
- [ ] 6.3 Add `claudeMdCreated` message type to `ExtensionToWebview` in `src/types/ipc.ts`

## 7. KanbanPanel — Handle New IPC Messages

- [ ] 7.1 Add `createCLAUDEmd` handler in `KanbanPanel.helpers.ts`
- [ ] 7.2 Add `claudeMdNotification` handler in `KanbanPanel.helpers.ts`
- [ ] 7.3 Add `claudeMdCreated` handler in `KanbanPanel.helpers.ts`
- [ ] 7.4 Add `createCLAUDEmd` to `ALLOWED_TYPES` list

## 8. Webview — CLAUDE.md Status UI

- [ ] 8.1 Handle `claudeMdNotification` message in `App.tsx` (show notification/banner)
- [ ] 8.2 Add "Create CLAUDE.md" action button that sends `createCLAUDEmd` IPC message
- [ ] 8.3 Handle `claudeMdCreated` success/error response in `App.tsx`
- [ ] 8.4 Add logger calls to webview handlers

## 9. Extension Initialization — Wire Up RepoPromptService

- [ ] 9.1 Create `RepoPromptService` instance in `src/extension.ts` `initServices()`
- [ ] 9.2 Pass `RepoPromptService` to `ColumnPromptService` constructor
- [ ] 9.3 Pass `RepoPromptService` to `RepoManager` (or use directly for CLAUDE.md operations)

## 10. Tests

- [ ] 10.1 Create `src/test/services/repoPrompt.hasCLAUDEmd.test.ts` (include empty file scenario)
- [ ] 10.2 Create `src/test/services/repoPrompt.hasAGENTSmd.test.ts` (include empty file scenario)
- [ ] 10.3 Create `src/test/services/repoPrompt.getCLAUDEmd.test.ts`
- [ ] 10.4 Create `src/test/services/repoPrompt.getAGENTSmd.test.ts`
- [ ] 10.5 Create `src/test/services/repoPrompt.createCLAUDEmdTemplate.test.ts`
- [ ] 10.6 Create `src/test/services/repoPrompt.cache.test.ts`
- [ ] 10.7 Create `src/test/services/repoManager.hasCLAUDEmd.test.ts`
- [ ] 10.8 Create `src/test/services/repoManager.hasAGENTSmd.test.ts`
- [ ] 10.9 Create `src/test/services/repoManager.createCLAUDEmd.test.ts`
- [ ] 10.10 Create `src/test/services/columnPrompt.assemblePromptChain-withRepo.test.ts`
- [ ] 10.11 Create `src/test/services/columnPrompt.assemblePromptChain-withAGENTSmd.test.ts`
- [ ] 10.12 Create `src/test/services/columnPrompt.getMinimalColumnPrompt.test.ts`
- [ ] 10.13 Create `src/test/services/columnPrompt.BRAIN_DUMP-prompts.test.ts`
- [ ] 10.14 Create `src/test/services/claudeHarness.buildPrompt-withRepo.test.ts`
- [ ] 10.15 Create `src/test/services/claudeHarness.warning-throttle.test.ts`
- [ ] 10.16 Create `src/test/services/claudeTrigger.buildPrompt-withRepo.test.ts`
- [ ] 10.17 Update existing `columnPrompt.*.test.ts` files for new BRAIN_DUMP defaults
- [ ] 10.18 Run test suite and verify 90%+ coverage on new/modified files

## 11. Integration & Verification

- [ ] 11.1 Verify TypeScript compilation (`npx tsc --noEmit`)
- [ ] 11.2 Verify extension build (`node esbuild.js`)
- [ ] 11.3 Verify webview build (`cd webview-ui && npx vite build`)
- [ ] 11.4 Manual test: agent run on repo with CLAUDE.md uses minimal prompt
- [ ] 11.5 Manual test: agent run on repo without CLAUDE.md uses full default prompt
- [ ] 11.6 Manual test: BRAIN_DUMP column triggers agent with ideation prompt

## 1. Package.json Configuration

- [x] 1.1 Add `aiOs.cloneRepos` command to `contributes.commands` in `package.json`
- [x] 1.2 Add `aiOs.reposDir` setting to `contributes.configuration.properties` in `package.json` (type: string, default: `~/ai-os-repos`)
- [x] 1.3 Add `onCommand:aiOs.cloneRepos` to `activationEvents` in `package.json`
- [x] 1.4 Add `aiOs.cloneRepos` to `menus.view/title` for `aiOs.boardSelector` in `package.json`

## 2. RepoManager Service

- [x] 2.1 Create `src/services/repoManager.ts` with `RepoManager` class
- [x] 2.2 Implement `constructor(reposDir: string, token: string)` — resolve `~` in reposDir, store token
- [x] 2.3 Implement `checkGitAvailable(): boolean` — spawn `git --version`, return success
- [x] 2.4 Implement `getRepoPath(owner: string, repo: string): string` — returns `<reposDir>/<owner>/<repo>`
- [x] 2.5 Implement `isRepoCloned(owner: string, repo: string): boolean` — check `.git` directory exists
- [x] 2.6 Implement `extractReposFromItems(items: ProjectItemNode[]): { owner: string; repo: string }[]` — extract unique owner/repo pairs from board items
- [x] 2.7 Implement `cloneRepo(owner: string, repo: string): Promise<{ success: boolean; error?: string }>` — `git clone --single-branch https://token@github.com/owner/repo.git`
- [x] 2.8 Implement `updateRepo(owner: string, repo: string): Promise<{ success: boolean; error?: string }>` — `git pull` in existing repo
- [x] 2.9 Implement `cloneOrUpdateRepos(repos: { owner: string; repo: string }[]): Promise<{ success: boolean; error?: string }[]>` — iterate repos, clone missing, update existing
- [x] 2.10 Implement `getBranchName(repoName: string, issueNumber: number, title: string): string` — returns `ai-os/{repoName}/{issueNumber}-{title-slug}`
- [x] 2.11 Implement `getWorktreePath(owner: string, repo: string, issueNumber: number, title: string): string` — returns `<repoPath>/.worktrees/{issueNumber}-{title-slug}`
- [x] 2.12 Implement `createWorktree(owner: string, repo: string, issueNumber: number, title: string): Promise<{ success: boolean; path: string; error?: string }>` — `git worktree add -b` for new branch or `git worktree add` for existing
- [x] 2.13 Implement `updateWorktree(worktreePath: string): Promise<{ success: boolean; error?: string }>` — `git fetch origin && git pull --rebase` in worktree
- [x] 2.14 Implement `cleanupWorktree(owner: string, repo: string, issueNumber: number, title: string): Promise<{ success: boolean; error?: string }>` — `git worktree remove` + `git branch -d`
- [x] 2.15 Implement per-repo operation queue (Promise chain) to serialize git commands targeting same repo
- [x] 2.16 Implement `getReposDir(): string` — getter for reposDir

## 3. Clone Repos Command

- [x] 3.1 Create `src/commands/cloneRepos.ts`
- [x] 3.2 Implement `handleCloneRepos(repoManager: RepoManager, graphql: GraphQLClient, projectId: string)` — fetch board items, extract repos, clone/update, show notification
- [x] 3.3 Implement notification logic — success message with repo list, partial failure with error details

## 4. Extension Host Wiring

- [x] 4.1 Import `RepoManager` in `src/extension.ts`
- [x] 4.2 Create `RepoManager` instance in `initServices()` with `aiOs.reposDir` setting and GitHub token
- [x] 4.3 Register `aiOs.cloneRepos` command in `registerCommands()`
- [x] 4.4 Store `repoManager` as module-level variable (similar to `agentService`, `graphql`)
- [x] 4.5 Pass `repoManager` to `setBoardHandlerDeps()` in `boardHandlers.ts`

## 5. Board Open Repo Check

- [x] 5.1 In `handleOpenBoardFromTree()` in `boardHandlers.ts`, after poller starts, call `repoManager.extractReposFromItems()` on initial poll results
- [x] 5.2 Check which repos are missing via `repoManager.isRepoCloned()`
- [x] 5.3 If missing repos exist, show VS Code notification with quick pick: "Clone Missing Repos" action
- [x] 5.4 Wire poller to expose last poll items for repo check (add `getItems()` method to `PollerService`)

## 6. Agent Callback Integration

- [x] 6.1 Modify `AgentTriggerCallback` type in `src/services/agent.ts` to include `owner: string` and `repo: string`
- [x] 6.2 Update `PrioritizerItem` interface to include `owner?: string` and `repo?: string`
- [x] 6.3 Update `feedBoardState()` in `poller.ts` to populate owner/repo from `item.content.repository`
- [x] 6.4 Update `startAgent()` callback invocation to pass owner/repo from selected item
- [x] 6.5 Update `onAgentTrigger()` to pass owner/repo from board items
- [x] 6.6 In `initServices()` callback in `extension.ts`, call `repoManager.createWorktree()` before spawning Claude
- [x] 6.7 In `initServices()` callback, call `repoManager.updateWorktree()` to ensure branch is current
- [x] 6.8 Pass worktree path as `cwd` to `claudeTrigger.handleTrigger()` instead of `workspaceFolders[0]`
- [x] 6.9 Remove `workspaceFolders` guard — repo check replaces it

## 7. Claude Spawner Update

- [x] 7.1 Update `spawnClaude()` in `claudeSpawner.ts` to accept worktree path from caller (already accepts `cwd` in options)
- [x] 7.2 Verify `cwd` in spawn options points to worktree, not workspace

## 8. Poller PR Merge Detection

- [x] 8.1 Add `repoManager` reference to `PollerService` via `setRepoManager()`
- [x] 8.2 In `poll()`, after detecting deltas, check for PR items with state `MERGED`
- [x] 8.3 For merged PRs, call `repoManager.cleanupWorktree()` with issue details
- [x] 8.4 Wire `repoManager` to poller in `initServices()`

## 9. Delta Detection for Item Updates

- [ ] 9.1 Ensure `delta.ts` detects PR state changes (issue → PR, PR state changes)
- [ ] 9.2 Add `item_updated` delta type for content changes (body/title updates)

## 10. Mandatory Logging

- [x] 10.1 `src/services/repoManager.ts` — Add `import { logger } from './logger'` and log start/params/result/error in: constructor(), checkGitAvailable(), getRepoPath(), isRepoCloned(), extractReposFromItems(), cloneRepo(), updateRepo(), cloneOrUpdateRepos(), getBranchName(), getWorktreePath(), createWorktree(), updateWorktree(), cleanupWorktree(), getReposDir()
- [x] 10.2 `src/commands/cloneRepos.ts` — Add `import { logger } from '../services/logger'` and log start/params/result/error in: handleCloneRepos()
- [x] 10.3 `src/services/poller.ts` — Add logging for PR merge detection and cleanup calls in: poll()
- [x] 10.4 `src/services/agent.ts` — Add logging for owner/repo in callback invocation in: startAgent(), onAgentTrigger()
- [ ] 10.5 Verify no `console.log` exists: `grep -rn "console\.log" src/` must return zero results

    Every method MUST follow this pattern:
    ```typescript
    import { logger } from '../services/logger';

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

    Verification: `grep -rn "console\\.log" src/` must return zero results.

## 11. Tests

- [x] 11.1 `src/test/services/repoManager.constructor.test.ts` — ONE FILE PER METHOD. Test constructor() reposDir resolution, token storage
- [x] 11.2 `src/test/services/repoManager.checkGitAvailable.test.ts` — ONE FILE PER METHOD. Test git available/unavailable
- [x] 11.3 `src/test/services/repoManager.getRepoPath.test.ts` — ONE FILE PER METHOD. Test path construction
- [x] 11.4 `src/test/services/repoManager.isRepoCloned.test.ts` — ONE FILE PER METHOD. Test cloned/not cloned detection
- [x] 11.5 `src/test/services/repoManager.extractReposFromItems.test.ts` — ONE FILE PER METHOD. Test unique repo extraction from items
- [x] 11.6 `src/test/services/repoManager.cloneRepo.test.ts` — ONE FILE PER METHOD. Test clone success/failure
- [x] 11.7 `src/test/services/repoManager.updateRepo.test.ts` — ONE FILE PER METHOD. Test pull success/failure
- [x] 11.8 `src/test/services/repoManager.cloneOrUpdateRepos.test.ts` — ONE FILE PER METHOD. Test mixed clone/update flow
- [x] 11.9 `src/test/services/repoManager.getBranchName.test.ts` — ONE FILE PER METHOD. Test branch naming with title slugification
- [x] 11.10 `src/test/services/repoManager.getWorktreePath.test.ts` — ONE FILE PER METHOD. Test worktree path construction
- [x] 11.11 `src/test/services/repoManager.createWorktree.test.ts` — ONE FILE PER METHOD. Test new branch and existing branch worktree creation
- [x] 11.12 `src/test/services/repoManager.updateWorktree.test.ts` — ONE FILE PER METHOD. Test fetch+pull in worktree
- [x] 11.13 `src/test/services/repoManager.cleanupWorktree.test.ts` — ONE FILE PER METHOD. Test worktree removal and branch deletion
- [x] 11.14 `src/test/services/repoManager.getReposDir.test.ts` — ONE FILE PER METHOD. Test reposDir getter
- [x] 11.15 `src/test/commands/cloneRepos.handleCloneRepos.test.ts` — ONE FILE PER METHOD. Test command flow with mock repoManager and graphql
- [x] 11.16 `src/test/services/poller.prMergeDetection.test.ts` — ONE FILE PER METHOD. Test PR merge detection triggers cleanup
- [x] 11.17 `src/test/services/agent.callbackWithRepoContext.test.ts` — ONE FILE PER METHOD. Test callback receives owner/repo
- [x] 11.18 `src/test/integration/clone-repos.integration.test.ts` — Integration test: board open → repo check → clone → agent trigger → worktree
- [x] 11.19 Run `npx vitest run --coverage` and verify ≥90% coverage on all new/modified files

## Why

Agent (Claude Code) needs a local repo to work on issues, but the extension currently requires a VS Code workspace folder — blocking users who don't want to open a workspace. Additionally, each issue needs an isolated branch/worktree so the agent's work doesn't conflict with the user's own coding in the same repo.

## What Changes

- **New `RepoManager` service** — clones repos from the GitHub Project into a user-configured directory, manages git worktrees per issue, handles branch creation/update/cleanup
- **New command `aiOs.cloneRepos`** — "Clone Project Repos" menu item that clones all repos referenced in the active board
- **Board open repo check** — when a board opens, check which repos are missing; prompt user to clone before any agent can work
- **Worktree-based isolation** — each issue gets its own git worktree (`ai-os/{repo}/{ISSUE}-{title-slug}`) so agent and user can work in the same repo without conflict
- **No workspace required** — Claude spawns with `cwd` pointing to the worktree, eliminating the `workspaceFolders` dependency
- **Worktree cleanup on merge** — poller detects PR merge → deletes worktree + branch automatically
- **New setting `aiOs.reposDir`** — user-configured directory for cloned repos (default: `~/ai-os-repos`)

## Capabilities

### New Capabilities
- `repo-manager`: Service that handles repo cloning (single-branch, full history), worktree creation/deletion, branch management, and merge-based cleanup. Manages repos in `aiOs.reposDir` with structure `<owner>/<repo>/` and worktrees in `<owner>/<repo>/.worktrees/`.
- `clone-repos-command`: Menu command that extracts unique repos from current board items, clones missing repos, pulls existing repos, and reports status.

### Modified Capabilities
- `agent-prioritizer`: Agent callback now receives repo context (owner/repo) and worktree path instead of workspace folder. Agent trigger flow delegates cwd resolution to RepoManager.
- `background-poller`: Poller now detects PR merge events and triggers worktree/branch cleanup through RepoManager.

## Impact

- **New files**: `src/services/repoManager.ts`, `src/commands/cloneRepos.ts`
- **Modified files**: `src/extension.ts` (register command, wire RepoManager), `src/services/claudeSpawner.ts` (accept repo path from RepoManager), `src/services/poller.ts` (PR merge detection → cleanup), `src/services/agent.ts` (pass repo context to callback), `package.json` (new command + setting)
- **Removed dependency**: `vscode.workspace.workspaceFolders` no longer required for agent work
- **External process**: `git` CLI required (clone, worktree, fetch, pull, branch operations)

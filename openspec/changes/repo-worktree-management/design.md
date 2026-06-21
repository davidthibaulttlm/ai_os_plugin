## Context

Currently the extension requires `vscode.workspace.workspaceFolders` to spawn Claude Code. This blocks users who don't want to open a workspace. The extension polls GitHub Projects v2 boards and triggers agents on issues — but each issue lives in a specific repo that must be cloned locally for the agent to work.

Each board can contain issues from multiple repos. Each issue gets its own branch. The agent works in a git worktree (isolated working directory sharing the same `.git` objects). The user can simultaneously open the same repo in VS Code on a different branch — no conflict.

**Current state**:
```
claudeTrigger callback → workspaceFolders[0] → spawn claude -p in workspaceRoot
```

**Target state**:
```
claudeTrigger callback → repoManager.getWorktree(owner, repo, issue) → spawn claude -p in worktree
```

## Goals / Non-Goals

**Goals:**
- Eliminate workspace folder requirement for agent work
- Clone repos from board items into user-configured directory
- Create isolated git worktrees per issue (agent work doesn't touch user's working directory)
- Auto-clean worktrees when PR is merged
- User can open same repos in VS Code without conflict
- Board open triggers repo availability check

**Non-Goals:**
- Repo management UI (list repos, delete repos) — out of scope
- Submodule handling — not supported
- Monorepo workspace detection — each repo is independent
- SSH clone — HTTPS with token only

## Decisions

### 1. Clone location: `aiOs.reposDir` setting (default `~/ai-os-repos`)
User controls where repos live. Structure: `<reposDir>/<owner>/<repo>/`. Worktrees: `<reposDir>/<owner>/<repo>/.worktrees/{issue-slug}/`.

**Why**: Predictable, user-accessible, doesn't pollute extension storage. User can `cd` into repos manually.

### 2. Single-branch clone (default branch only)
`git clone --single-branch --branch <default>` — clones only the default branch with full history.

**Why**: Other branches are fetched on-demand when needed. Saves bandwidth/time. User still has full history for `git log`/`blame`.

### 3. Branch naming: `ai-os/{repo-name}/{ISSUE}-{title-slug}`
Example: `ai-os/frontend/123-fix-login-bug`

**Why**: Repo name in branch prevents collision when board has issues from multiple repos. Namespace `ai-os/` keeps agent branches grouped in `git branch` listing.

### 4. Worktree path: `<reposDir>/<owner>/<repo>/.worktrees/{ISSUE}-{title-slug}`
Example: `~/ai-os-repos/acme/frontend/.worktrees/123-fix-login-bug`

**Why**: Deterministic path. `.worktrees/` prefix keeps them visually separate. Worktree dir uses `{ISSUE}-{title-slug}` (same as branch tail after `ai-os/{repo}/` prefix) for traceability between branch name and directory name.

### 5. Auth: HTTPS with GIT_ASKPASS
Use `GIT_ASKPASS` environment variable pointing to a script that outputs the token. Token is NEVER embedded in clone URLs.

**Why**: Already have `gh auth token`. No SSH key setup needed. Same auth as GraphQL. GIT_ASKPASS prevents token from appearing in process lists (`ps aux`) or git logs.

### 6. Merge strategy: `git pull --rebase`
Use `--rebase` for all `git pull` operations (base repo update and worktree update).

**Why**: Cleaner linear history. Agent commits won't create merge commits on every pull.

### 7. Merge detection via poller
Poller already fetches board items every 30s. Extend to detect PR state = `MERGED` → trigger `repoManager.cleanupWorktree()`.

**Why**: No new polling needed. Reuses existing poll cycle. Cleanup is automatic.

### 8. `spawn` for git operations
Node.js `child_process.spawn` for all git commands (clone, worktree, fetch, pull, branch).

**Why**: Consistent with existing `claudeSpawner.ts` pattern. No new dependencies.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Git not installed | Check `git --version` on activation; show error if missing |
| Disk space exhaustion from many repos | User controls `reposDir`; no auto-delete except merged PRs |
| Worktree path conflict (same issue number, different repo) | Path includes issue slug which is unique per repo |
| Concurrent git operations on same repo | Per-repo promise chain (`Map<string, Promise>`) serializes operations |
| Stale worktrees (agent crashes, PR abandoned) | Worktrees visible in `.worktrees/`; user can manually remove |
| Clone in progress when agent triggers | Agent waits for clone promise to resolve |

## Open Questions

- **Resolved**: `git pull --rebase` chosen (Decision 6). Cleaner linear history for agent work.
- **Resolved**: Clone failure notification — yes, error message with repo name and truncated git output (see clone-repos-command spec).

## ADDED Requirements

### Requirement: Harness commits staged changes on success
When Claude exits successfully (exit code 0), the harness SHALL commit any staged changes in the worktree.

#### Scenario: Successful commit
- **WHEN** Claude exits with code 0 and there are staged changes
- **THEN** the harness SHALL run `git commit` with message `ai-os: {title} (#issueNumber)` where title is sanitized (newlines replaced with spaces, quotes escaped)

#### Scenario: No staged changes
- **WHEN** Claude exits with code 0 but there are no staged changes
- **THEN** the harness SHALL skip the commit and log a warning, then proceed to card move

#### Scenario: Commit failure
- **WHEN** `git commit` fails (e.g., no git config)
- **THEN** the harness SHALL record `success: false` with reason `commit_failed` and leave the worktree intact for manual review

#### Scenario: Git user config fallback
- **WHEN** `user.name` or `user.email` is not configured in git
- **THEN** the harness SHALL set `user.name` to `ai-os-agent` and `user.email` to `ai-os@localhost` before committing

#### Scenario: Commit message sanitization
- **WHEN** issue title contains newlines, quotes, or shell metacharacters
- **THEN** the harness SHALL replace newlines with spaces and escape double quotes before using in commit message

### Requirement: Harness pushes branch on successful commit
After a successful commit, the harness SHALL push the worktree branch to the remote repository.

#### Scenario: Successful push
- **WHEN** commit succeeds and the branch does not exist on remote
- **THEN** the harness SHALL push the branch with `--set-upstream origin {branchName}`

#### Scenario: Push failure
- **WHEN** `git push` fails (e.g., network error, auth failure)
- **THEN** the harness SHALL record `success: false` with reason `push_failed` and leave the worktree intact

### Requirement: Harness creates pull request on successful push
After a successful push, the harness SHALL create a pull request via GraphQL mutation. The PR targets the repo's default branch (detected via `repoManager.detectDefaultBranch()`).

#### Scenario: PR created
- **WHEN** push succeeds
- **THEN** the harness SHALL create a PR with title `ai-os: {title} (#issueNumber)` and body linking to the issue

#### Scenario: PR creation failure
- **WHEN** PR creation fails (e.g., duplicate PR exists)
- **THEN** the harness SHALL log the error but still mark the run as `success: true` — the commit and branch are valid, PR is best-effort

#### Scenario: PR base branch
- **WHEN** creating a PR
- **THEN** the base branch SHALL be the repo's default branch (detected via `git ls-remote --symref`)

### Requirement: Success gate definition
A run is considered successful (`AgentResult.success: true`) when Claude exits with code 0 AND commit succeeds. Push and PR are best-effort — failures in those steps do NOT change the success status.

#### Scenario: Success with commit only
- **WHEN** Claude exits 0, commit succeeds, but push fails
- **THEN** the harness SHALL return `AgentResult` with `success: false` and `reason: 'push_failed'` (push is required gate)

#### Scenario: Success with commit and push
- **WHEN** Claude exits 0, commit succeeds, push succeeds
- **THEN** the harness SHALL return `AgentResult` with `success: true` regardless of PR outcome

### Requirement: Harness moves card on successful completion
When the success gate is met (Claude exit 0 + commit + push), the harness SHALL move the issue card to the next column.

#### Scenario: Card moved from AI_SPEC to HUMAN_SPEC_REVIEW
- **WHEN** agent completes in `AI_SPEC` column and success gate is met
- **THEN** the harness SHALL move the card to `HUMAN_SPEC_REVIEW`

#### Scenario: Card moved from AI_CODE to HUMAN_CODE_REVIEW
- **WHEN** agent completes in `AI_CODE` column and success gate is met
- **THEN** the harness SHALL move the card to `HUMAN_CODE_REVIEW`

#### Scenario: Card not moved on failure
- **WHEN** agent fails (any reason)
- **THEN** the harness SHALL NOT move the card — it remains in the current column

### Requirement: Worktree cleanup policy
On failed runs, the worktree is preserved for debugging. On successful runs, the worktree is preserved until manually cleaned.

#### Scenario: Worktree preserved on failure
- **WHEN** agent run fails at any stage
- **THEN** the worktree SHALL be preserved with all changes intact for manual review

#### Scenario: Worktree preserved on success
- **WHEN** agent run succeeds
- **THEN** the worktree SHALL be preserved — cleanup is a manual operation via `repoManager.cleanupWorktree()`

### Requirement: RepoManager provides commit and push methods
`RepoManager` SHALL expose `commitWorktree()`, `pushWorktree()`, and `hasStagedChanges()` methods. All return `GitResult` type: `{ success: boolean; error?: string }`.

#### Scenario: Commit worktree
- **WHEN** `repoManager.commitWorktree(worktreePath, message)` is called
- **THEN** it SHALL execute `git commit -m "{message}"` in the worktree directory and return `GitResult`

#### Scenario: Push worktree
- **WHEN** `repoManager.pushWorktree(worktreePath, branchName)` is called
- **THEN** it SHALL execute `git push --set-upstream origin {branchName}` in the worktree directory and return `GitResult`

#### Scenario: Check staged changes
- **WHEN** `repoManager.hasStagedChanges(worktreePath)` is called
- **THEN** it SHALL execute `git diff --staged --name-only` and return `true` if output is non-empty

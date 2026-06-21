## ADDED Requirements

### Requirement: Repo directory structure
The system SHALL clone each repository into `<reposDir>/<owner>/<repo>/` where `reposDir` is the value of `aiOs.reposDir` setting (default `~/ai-os-repos`). The system SHALL expand `~` to `os.homedir()` before use.

#### Scenario: Repo cloned to correct path
- **WHEN** user triggers clone for repo `acme/frontend`
- **THEN** the repo is cloned to `<reposDir>/acme/frontend/`

#### Scenario: ReposDir setting overrides default
- **WHEN** `aiOs.reposDir` is set to `~/my-projects`
- **THEN** repos are cloned to `<home>/my-projects/<owner>/<repo>/`

#### Scenario: Tilde expanded in default
- **WHEN** `aiOs.reposDir` is not set (default `~/ai-os-repos`)
- **THEN** repos are cloned to `<home>/ai-os-repos/<owner>/<repo>/`

### Requirement: Single-branch clone with full history
The system SHALL clone repos using `--single-branch` flag, fetching only the default branch with complete history. The system SHALL detect the default branch name via `git ls-remote --symref origin HEAD` before cloning.

#### Scenario: Clone uses single-branch with detected default
- **WHEN** cloning repo `acme/frontend` whose default branch is `main`
- **THEN** git clone is executed with `--single-branch --branch main`

#### Scenario: Clone detects non-main default branch
- **WHEN** cloning repo `acme/legacy` whose default branch is `master`
- **THEN** git clone is executed with `--single-branch --branch master`

### Requirement: HTTPS clone with GIT_ASKPASS authentication
The system SHALL authenticate git clone via HTTPS using `GIT_ASKPASS` environment variable. The token SHALL NOT be embedded in clone URLs.

#### Scenario: Clone authenticates with GIT_ASKPASS
- **WHEN** cloning a private repo
- **THEN** the git clone command uses `https://github.com/<owner>/<repo>.git` with `GIT_ASKPASS` set to a script that outputs the token

#### Scenario: Token not in URL
- **WHEN** inspecting the git clone command arguments
- **THEN** the URL does not contain the GitHub token

### Requirement: Repo existence check
The system SHALL detect whether a repo is already cloned by checking for `.git` directory at `<reposDir>/<owner>/<repo>/.git`.

#### Scenario: Existing repo detected
- **WHEN** checking repo `acme/frontend` and `<reposDir>/acme/frontend/.git` exists
- **THEN** the system reports the repo as already cloned

#### Scenario: Missing repo detected
- **WHEN** checking repo `acme/frontend` and `<reposDir>/acme/frontend/.git` does not exist
- **THEN** the system reports the repo as missing

### Requirement: Repo update (git pull)
The system SHALL update an existing repo by executing `git pull --rebase` on the default branch. Dirty working trees are outside scope — the base repo is managed solely by the extension.

#### Scenario: Existing repo updated
- **WHEN** user triggers clone for already-cloned repo `acme/frontend`
- **THEN** `git pull --rebase` is executed in `<reposDir>/acme/frontend/`

### Requirement: Worktree directory creation
The system SHALL ensure `<reposDir>/<owner>/<repo>/.worktrees/` directory exists before creating worktrees.

#### Scenario: Worktree directory created
- **WHEN** creating first worktree for repo `acme/frontend`
- **THEN** `<reposDir>/acme/frontend/.worktrees/` is created if it does not exist

### Requirement: Worktree creation for new branch
The system SHALL create a git worktree for a new issue branch using `git worktree add -b`. The worktree path SHALL be `<reposDir>/<owner>/<repo>/.worktrees/{ISSUE}-{title-slug}`.

#### Scenario: Worktree created for new issue
- **WHEN** agent triggers for issue #123 titled "Fix Login Bug" in repo `acme/frontend`
- **THEN** a worktree is created at `<reposDir>/acme/frontend/.worktrees/123-fix-login-bug/` on branch `ai-os/frontend/123-fix-login-bug`

### Requirement: Worktree reuse for existing branch
The system SHALL reuse an existing branch for worktree creation when the branch already exists. If a worktree already exists for the branch, the system SHALL return the existing path without creating a duplicate.

#### Scenario: Worktree reuses existing branch
- **WHEN** agent triggers for issue #123 and branch `ai-os/frontend/123-fix-login-bug` already exists but no worktree
- **THEN** `git worktree add` is executed without `-b` flag (attach to existing branch)

#### Scenario: Existing worktree returned
- **WHEN** agent triggers for issue #123 and worktree `<reposDir>/acme/frontend/.worktrees/123-fix-login-bug/` already exists
- **THEN** the existing path is returned without creating a duplicate

### Requirement: Branch update before work
The system SHALL update the issue branch before spawning Claude by executing `git -C <worktree> pull --rebase origin <branch>` in the worktree.

#### Scenario: Branch updated before agent work
- **WHEN** worktree exists for issue #123
- **THEN** `git -C <worktree> pull --rebase origin ai-os/frontend/123-fix-login-bug` is executed before Claude spawns

### Requirement: Worktree cleanup on PR merge
The system SHALL delete the worktree and branch when the associated PR is detected as merged. If worktree removal fails, the system SHALL log the error and retry on the next poll cycle.

#### Scenario: Worktree cleaned on merge
- **WHEN** poller detects PR for issue #123 has state `MERGED`
- **THEN** worktree at `<reposDir>/acme/frontend/.worktrees/123-fix-login-bug/` is removed and branch `ai-os/frontend/123-fix-login-bug` is deleted

#### Scenario: Cleanup failure logged and retried
- **WHEN** worktree removal fails (e.g., locked file)
- **THEN** error is logged and cleanup is retried on next poll cycle

### Requirement: Branch naming convention
The system SHALL name branches as `ai-os/{repo-name}/{ISSUE}-{title-slug}` where title-slug is computed as: lowercase, replace spaces with hyphens, remove characters not matching `[a-z0-9-]`, collapse consecutive hyphens, trim leading/trailing hyphens.

#### Scenario: Branch named correctly
- **WHEN** issue #123 titled "Fix Login Bug" in repo `frontend`
- **THEN** branch name is `ai-os/frontend/123-fix-login-bug`

#### Scenario: Special characters removed from slug
- **WHEN** issue #456 titled "Fix API's #rate-limit!!" in repo `backend`
- **THEN** branch name is `ai-os/backend/456-fix-apis-rate-limit`

### Requirement: Extract repos from board items
The system SHALL extract unique repository identifiers (owner/repo pairs) from the current board's project items using `content.repository.owner.login` and `content.repository.name` from the GraphQL response.

#### Scenario: Unique repos extracted
- **WHEN** board has items from repos `acme/frontend` and `acme/backend`
- **THEN** the system returns `[{owner: 'acme', repo: 'frontend'}, {owner: 'acme', repo: 'backend'}]`

### Requirement: Get worktree path for issue
The system SHALL return the absolute path to the worktree directory for a given issue using the formula `<reposDir>/<owner>/<repo>/.worktrees/{ISSUE}-{title-slug}`.

#### Scenario: Worktree path returned
- **WHEN** requesting worktree path for issue #123 titled "Fix Login Bug" in `acme/frontend`
- **THEN** returns `<reposDir>/acme/frontend/.worktrees/123-fix-login-bug`

### Requirement: Git availability check
The system SHALL verify git is available on PATH before attempting any git operations.

#### Scenario: Git not found
- **WHEN** git is not installed or not on PATH
- **THEN** the system shows an error message "Git is required but not found on PATH"

#### Scenario: Git available
- **WHEN** git is installed and on PATH
- **THEN** git operations proceed normally

### Requirement: Concurrent git operation serialization
The system SHALL serialize git operations targeting the same repository using a per-repo promise chain (`Map<string, Promise>`). Operations for different repos execute in parallel.

#### Scenario: Concurrent operations serialized
- **WHEN** two git operations target `acme/frontend` simultaneously
- **THEN** the second operation waits for the first to complete

#### Scenario: Different repos execute in parallel
- **WHEN** git operations target `acme/frontend` and `acme/backend` simultaneously
- **THEN** both operations execute in parallel

## ADDED Requirements

### Requirement: Clone repos command
The system SHALL provide a command `aiOs.cloneRepos` that clones all repos referenced in the active board. The command is idempotent — running multiple times produces the same result without error.

#### Scenario: Command clones missing repos
- **WHEN** user invokes `aiOs.cloneRepos` and board has 3 repos (1 missing)
- **THEN** the missing repo is cloned and status is reported via VS Code notification and AI OS output channel

#### Scenario: Command updates existing repos
- **WHEN** user invokes `aiOs.cloneRepos` and all repos exist
- **THEN** each repo is updated with `git pull --rebase` and status is reported via VS Code notification and AI OS output channel

#### Scenario: Command is idempotent
- **WHEN** user invokes `aiOs.cloneRepos` twice in succession
- **THEN** the second run updates repos without error

#### Scenario: No active board
- **WHEN** user invokes `aiOs.cloneRepos` but no board is currently open
- **THEN** the system shows an error message "No board is currently open"

### Requirement: Progress feedback during clone
The system SHALL show a VS Code progress notification while clone operations are in flight.

#### Scenario: Progress shown during clone
- **WHEN** clone operations start
- **THEN** a VS Code progress notification is displayed showing current repo being processed

### Requirement: Board open repo check
The system SHALL check repo availability when a board is opened via `handleOpenBoardFromTree`. If repos are missing, the system SHALL show a notification via `vscode.window.showInformationMessage` with a "Clone Missing Repos" action button.

#### Scenario: Missing repos detected on board open
- **WHEN** board is opened and 2 of 3 repos are missing
- **THEN** the system shows a notification listing missing repos with a "Clone Missing Repos" action button

#### Scenario: All repos present on board open
- **WHEN** board is opened and all repos are cloned
- **THEN** no notification is shown

### Requirement: Clone status notification
The system SHALL show a VS Code information message after clone operations complete. For long repo lists, truncate to 5 repos with "+N more" suffix. Error messages include repo name and git error output truncated to 100 characters.

#### Scenario: Success notification
- **WHEN** all repos cloned successfully
- **THEN** shows "Cloned 3 repos: acme/frontend, acme/backend, acme/api"

#### Scenario: Long list truncated
- **WHEN** 8 repos cloned successfully
- **THEN** shows "Cloned 8 repos: acme/repo1, acme/repo2, acme/repo3, acme/repo4, acme/repo5 +3 more"

#### Scenario: Partial failure notification
- **WHEN** 1 of 3 repos fails to clone
- **THEN** shows "Cloned 2/3 repos. Failed: acme/api — <git error truncated to 100 chars>"

### Requirement: Agent blocked until repos cloned
The system SHALL prevent agent from spawning Claude when the issue's repo is not cloned. If a clone is in progress for the repo, the agent SHALL wait for completion before proceeding.

#### Scenario: Agent blocked for missing repo
- **WHEN** agent triggers for issue in repo that is not cloned
- **THEN** agent shows error "Repo not cloned. Run 'AI OS: Clone Project Repos' first"

#### Scenario: Agent waits for in-progress clone
- **WHEN** agent triggers for issue in repo that is currently being cloned
- **THEN** agent waits for clone to complete, then proceeds with worktree creation

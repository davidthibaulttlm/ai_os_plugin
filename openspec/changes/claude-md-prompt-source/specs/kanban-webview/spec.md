## ADDED Requirements

### Requirement: Webview shows context file status notification
The webview SHALL display a notification when an agent starts for a repo without `CLAUDE.md` or `AGENTS.md`. The notification SHALL be shown only once per repo (throttled).

#### Scenario: Warning notification shown on first run
- **WHEN** an agent run starts for an issue in a repo without `CLAUDE.md` or `AGENTS.md` and no warning has been sent for this repo yet
- **THEN** the webview receives a notification message indicating the repo lacks context files and suggesting the user create `CLAUDE.md`

#### Scenario: No notification when CLAUDE.md exists
- **WHEN** an agent run starts for an issue in a repo with `CLAUDE.md`
- **THEN** no warning notification is displayed

#### Scenario: No notification when AGENTS.md exists
- **WHEN** an agent run starts for an issue in a repo with `AGENTS.md` (even without `CLAUDE.md`)
- **THEN** no warning notification is displayed

#### Scenario: No duplicate notification for same repo
- **WHEN** a second agent run starts for the same repo without context files after a warning was already sent
- **THEN** no additional warning notification is displayed

### Requirement: Webview offers to create CLAUDE.md
The webview SHALL provide an action button in the notification that allows the user to create a `CLAUDE.md` template file.

#### Scenario: User clicks create CLAUDE.md
- **WHEN** the user clicks the "Create CLAUDE.md" action in the notification
- **THEN** a `createCLAUDEmd` IPC message is sent to the extension host with the repo's `owner` and `repo`

#### Scenario: CLAUDE.md created successfully
- **WHEN** the extension host receives `createCLAUDEmd` and creates the file
- **THEN** the webview receives a success confirmation message

#### Scenario: CLAUDE.md creation fails
- **WHEN** the extension host receives `createCLAUDEmd` but cannot create the file
- **THEN** the webview receives an error message with the failure reason

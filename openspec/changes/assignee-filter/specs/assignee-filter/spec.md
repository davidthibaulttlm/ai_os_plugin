## ADDED Requirements

### Requirement: Agent selects only issues assigned to current user
The `AgentService.selectNextIssue()` method SHALL filter board items to include only those where the current user's login appears in the `assignees` array. Issues without any assignees SHALL be excluded.

#### Scenario: User has one assigned issue in AI_SPEC column
- **WHEN** the user is assigned to issue #42 in AI_SPEC and calls `selectNextIssue()`
- **THEN** the method SHALL return issue #42

#### Scenario: User has no assigned issues in AI-eligible columns
- **WHEN** all issues in AI-eligible columns are assigned to other users (or unassigned)
- **THEN** `selectNextIssue()` SHALL return `null`

#### Scenario: Bug assigned to user breaks WIP limit
- **WHEN** the user has a WIP issue and a bug issue both assigned to the user
- **THEN** the bug SHALL be selected (bugs break WIP limit for the same user)

#### Scenario: Issue unassigned is never selected
- **WHEN** an issue in AI_SPEC has no assignees
- **THEN** the issue SHALL NOT be selected by `selectNextIssue()`

### Requirement: No fallback to unassigned issues
The agent SHALL NEVER fall back to selecting unassigned issues or issues assigned to other users. When no issues are assigned to the current user, the system SHALL return `null` and display a popup message — it SHALL NOT pick any issue as a fallback.

#### Scenario: Board has issues but none assigned to user
- **WHEN** the board has 10 issues in AI_SPEC but none are assigned to the current user
- **THEN** `selectNextIssue()` SHALL return `null` (not pick any of the 10 issues)

#### Scenario: Mixed assignees — user assigned to one, others assigned to teammates
- **WHEN** the board has 5 issues assigned to teammates and 1 issue assigned to the current user
- **THEN** `selectNextIssue()` SHALL return only the user's issue (never a teammate's issue)

### Requirement: Start command shows "no assigned issues" popup
When the user presses Start and no issues are assigned to them, the extension SHALL display a warning message indicating the user needs to be assigned to an issue.

#### Scenario: User presses Start with no assigned issues
- **WHEN** the user invokes `aiOs.startAgent` and no issues are assigned to the current user
- **THEN** the extension SHALL show `showWarningMessage("No issues assigned to you. Assign yourself to an issue first.")`

#### Scenario: User presses Start with assigned issues available
- **WHEN** the user invokes `aiOs.startAgent` and has issues assigned in AI-eligible columns
- **THEN** the extension SHALL start the agent and show `showInformationMessage("AI Agent started for issue #N")`

### Requirement: Agent completion shows "no more work" popup
When the agent finishes work and no assigned issues remain, the extension SHALL display a popup informing the user.

#### Scenario: Agent finishes and no assigned issues remain
- **WHEN** `finishAgent()` completes and `selectNextIssue()` returns `null` due to no assigned issues
- **THEN** the extension SHALL show `showInformationMessage("No more work available. Assign yourself to an issue to continue.")`

#### Scenario: Agent finishes and assigned issues remain
- **WHEN** `finishAgent()` completes and `selectNextIssue()` returns a new assigned issue
- **THEN** the agent SHALL auto-start on the next assigned issue (no popup)

### Requirement: GraphQL query fetches assignee data
The `CONTENT_FRAGMENT` in `GET_PROJECT_ITEMS_QUERY` SHALL include `assignees(first: 5) { nodes { login, avatarUrl } }` for both Issue and PullRequest content types.

#### Scenario: Poll returns assignee data for issues
- **WHEN** the poller fetches project items via GraphQL
- **THEN** each issue's content SHALL include `assignees.nodes` with `login` and `avatarUrl` fields

#### Scenario: Poll returns assignee data for PRs
- **WHEN** the poller fetches project items via GraphQL
- **THEN** each PR's content SHALL include `assignees.nodes` with `login` and `avatarUrl` fields

## MODIFIED Requirements

**Baseline spec**: `openspec/specs/agent-prioritizer/spec.md`

### Requirement: PrioritizerItem includes repository context
The `PrioritizerItem` interface SHALL include `owner` and `repo` fields to identify which repository the issue belongs to.

**Previous behavior**: `PrioritizerItem` contained `id`, `projectItemId`, `title`, `status`, `labels`, and optional `body`.

**Updated behavior**: `PrioritizerItem` SHALL also contain optional `owner` (GitHub repo owner/login from `issue.repository.owner.login`) and `repo` (GitHub repo name from `issue.repository.name`) fields extracted from the GraphQL poll result.

#### Scenario: Item has repository context
- **WHEN** the poller populates `PrioritizerItem` from a GitHub Issue node
- **THEN** the item SHALL include `owner` and `repo` fields from the issue's `repository.owner.login` and `repository.name` GraphQL fields

#### Scenario: Item without repository context (PR card or orphan)
- **WHEN** the board item is a PR or issue without repository context
- **THEN** `owner` and `repo` SHALL be `undefined`

### Requirement: AgentTriggerCallback accepts options object
The `AgentTriggerCallback` type SHALL accept an `AgentTriggerOptions` object instead of positional parameters for forward compatibility.

**Previous behavior**: Callback signature was `(issueId: string, columnName: string, title?: string, body?: string, owner?: string, repo?: string) => Promise<void>`.

**Updated behavior**: Callback signature SHALL be `(options: AgentTriggerOptions) => Promise<void>` where `AgentTriggerOptions` is `{ issueId: string; columnName: string; title?: string; body?: string; owner?: string; repo?: string; worktreePath?: string }`.

#### Scenario: Callback receives options object
- **WHEN** the harness invokes the agent trigger callback
- **THEN** the callback SHALL receive a single `AgentTriggerOptions` object containing all issue context and worktree path

#### Scenario: Callback without worktree path
- **WHEN** no worktree is available (repo not cloned)
- **THEN** `worktreePath` SHALL be `undefined` and the caller SHALL use the first workspace folder as fallback (`vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`)

#### Scenario: Multi-root workspace fallback
- **WHEN** no worktree is available and multiple workspace folders exist
- **THEN** the fallback SHALL use the first workspace folder (`workspaceFolders[0]`) and log a warning about ambiguity

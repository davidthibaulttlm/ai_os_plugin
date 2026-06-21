## ADDED Requirements

### Requirement: Shared type definitions
The harness SHALL define the following shared types used across all specs:

- **`AgentSession`**: `{ key: string; issueNumber: number; owner: string; repo: string; worktreePath: string; process: ChildProcess; status: 'running' | 'success' | 'failed'; outputBuffer: string[]; startTime: number; reason?: string }`
- **`AgentResult`**: `{ success: boolean; issueNumber: number; reason: string; prUrl?: string; error?: string }`
- **`AgentError`**: Enum with values `ALREADY_RUNNING`, `WORKTREE_FAILED`, `SPAWN_FAILED`, `TIMEOUT`, `MAX_TURNS_REACHED`, `COMMIT_FAILED`, `PUSH_FAILED`
- **`IssueContext`**: `{ issueNumber: number; owner: string; repo: string; title: string; body?: string; labels?: string[]; column: string }`

#### Scenario: Types exported from harness module
- **WHEN** another module imports from `src/services/claudeHarness`
- **THEN** it SHALL receive `AgentSession`, `AgentResult`, `AgentError`, and `IssueContext` as exported types

### Requirement: Harness manages full agent lifecycle
The `ClaudeHarness` SHALL manage the complete lifecycle of a Claude Code agent: worktree preparation, prompt building, process spawning, output collection, result parsing, and post-run actions.

#### Scenario: Successful agent run
- **WHEN** `harness.run(issueContext)` is called with valid `IssueContext`
- **THEN** the harness SHALL prepare the worktree, spawn Claude, collect output, parse result, and return `AgentResult` with `success: true`

#### Scenario: Duplicate spawn prevention
- **WHEN** `harness.run(issueContext)` is called for an issue that already has an active session
- **THEN** the harness SHALL return `AgentResult` with `success: false` and `reason: 'ALREADY_RUNNING'`

#### Scenario: Worktree preparation failure
- **WHEN** worktree creation fails during `harness.run()`
- **THEN** the harness SHALL return `AgentResult` with `success: false` and `reason: 'WORKTREE_FAILED'`

#### Scenario: Claude binary not found
- **WHEN** `claude` binary is not on PATH and spawn fails with `ENOENT`
- **THEN** the harness SHALL return `AgentResult` with `success: false` and `reason: 'SPAWN_FAILED'`

### Requirement: Harness tracks active sessions
The harness SHALL maintain an in-memory `Map<string, AgentSession>` of active agent sessions keyed by `owner:repo:issueNumber`. Session history is NOT persisted — it is lost on extension deactivation.

#### Scenario: Session created on spawn
- **WHEN** Claude process is successfully spawned
- **THEN** a new `AgentSession` SHALL be added to the active sessions map with status `running`, worktree path, and process reference

#### Scenario: Session removed on exit
- **WHEN** Claude process exits (success or failure)
- **THEN** the session SHALL be removed from the active sessions map

#### Scenario: Get active sessions
- **WHEN** `harness.getActiveSessions()` is called
- **THEN** it SHALL return a copy of the active sessions map for UI display

### Requirement: Harness enforces max turns and timeout
The harness SHALL pass `--max-turns` to Claude and enforce a configurable timeout as a fallback. Timeout is read from VS Code settings `aiOs.autoWorkTimeoutSeconds` (default 1800).

#### Scenario: Max turns enforced
- **WHEN** Claude reaches the max turn limit
- **THEN** the process exits with non-zero code and the harness SHALL record `success: false` with reason `max_turns_reached`

#### Scenario: Timeout enforced
- **WHEN** Claude runs longer than the configured timeout (default 1800 seconds)
- **THEN** the harness SHALL kill the process and record `success: false` with reason `timeout`

#### Scenario: Timeout configured via settings
- **WHEN** `aiOs.autoWorkTimeoutSeconds` is set to a non-default value
- **THEN** the harness SHALL use that value as the timeout threshold

### Requirement: Harness limits concurrent agents
The harness SHALL enforce a maximum number of concurrent agent sessions. The limit is read from VS Code settings `aiOs.maxConcurrentAgents` (default 3).

#### Scenario: Concurrent limit enforced
- **WHEN** `harness.run()` is called and the active session count equals `maxConcurrentAgents`
- **THEN** the harness SHALL return `AgentResult` with `success: false` and `reason: 'CONCURRENT_LIMIT_REACHED'`

#### Scenario: Within concurrent limit
- **WHEN** `harness.run()` is called and active session count is below `maxConcurrentAgents`
- **THEN** the harness SHALL proceed with spawning

### Requirement: Harness builds structured prompt
The harness SHALL build the Claude prompt from issue context including title, body, labels, column, and instructions.

#### Scenario: Prompt includes issue body
- **WHEN** issue context contains a non-empty body
- **THEN** the prompt SHALL include the body truncated to 4096 characters maximum, truncated at a newline boundary to avoid splitting lines

#### Scenario: Prompt with empty body
- **WHEN** issue context has no body or an empty body
- **THEN** the prompt SHALL omit the description section and include only title, labels, column, and instructions

#### Scenario: Prompt includes labels
- **WHEN** issue context contains labels
- **THEN** the prompt SHALL include a `Labels:` line with comma-separated label names

#### Scenario: Prompt includes column context
- **WHEN** issue context specifies a column (e.g., `AI_SPEC`, `AI_CODE`)
- **THEN** the prompt SHALL include the column name and column-specific instructions

#### Scenario: Body truncation preserves line boundaries
- **WHEN** body exceeds 4096 characters
- **THEN** the truncation point SHALL be at the last newline before position 4096, followed by `[TRUNCATED]` marker

### Requirement: Harness prepares worktree before spawning
The harness SHALL create or update a git worktree for the issue before spawning Claude. Worktree path follows format `<reposDir>/<owner>/<repo>/.worktrees/{ISSUE}-{title-slug}`.

#### Scenario: Worktree created for new issue
- **WHEN** no worktree exists for the issue
- **THEN** the harness SHALL call `repoManager.createWorktree()` and `repoManager.updateWorktree()` before spawning

#### Scenario: Existing worktree reused
- **WHEN** a worktree already exists for the issue (from a previous run)
- **THEN** the harness SHALL reuse the existing worktree path and call `repoManager.updateWorktree()` to refresh

#### Scenario: Worktree creation fails
- **WHEN** `repoManager.createWorktree()` returns `success: false`
- **THEN** the harness SHALL return `AgentResult` with `success: false` and `reason: 'WORKTREE_FAILED'` without spawning Claude

## ADDED Requirements

### Requirement: Shell injection prevention in git commands
All git commands executed by the harness and `RepoManager` SHALL use argument arrays (not shell strings) to prevent injection.

#### Scenario: Branch name sanitized
- **WHEN** worktree branch name is constructed from issue title
- **THEN** the branch name SHALL be slugified (lowercase, alphanumeric + hyphens only) before passing to `git` arguments

#### Scenario: Commit message passed as argument
- **WHEN** `git commit -m "{message}"` is executed
- **THEN** the message SHALL be passed as a separate array element in the spawn args, NOT concatenated into a shell string

#### Scenario: Worktree path validated
- **WHEN** worktree path is constructed
- **THEN** it SHALL be validated to contain only alphanumeric characters, hyphens, underscores, and forward slashes

### Requirement: GitHub token never exposed to webview
The GitHub token SHALL remain in the extension host process only. It SHALL never be sent to the webview via IPC.

#### Scenario: Token not in IPC messages
- **WHEN** the harness posts any IPC message to the webview
- **THEN** the message SHALL NOT contain the GitHub token or any derived authentication data

#### Scenario: Token passed to Claude via env only
- **WHEN** spawning Claude process
- **THEN** the token SHALL be passed via the `GITHUB_TOKEN` environment variable only, never as a CLI argument

### Requirement: XSS sanitization in webview output
All text from Claude output rendered in the webview SHALL be HTML-escaped.

#### Scenario: Script tags escaped
- **WHEN** Claude output contains `<script>alert('xss')</script>`
- **THEN** the webview SHALL render the literal text `<script>alert('xss')</script>`

#### Scenario: Sanitization uses DOMPurify or equivalent
- **WHEN** output is rendered in the webview
- **THEN** the sanitization SHALL use a proven library (DOMPurify) or manual entity escaping for `<`, `>`, `&`, `"`, `'`

### Requirement: Harness-callback integration contract
The `AgentService` callback SHALL invoke `harness.run()` with the `IssueContext` derived from the callback options.

#### Scenario: Callback invokes harness
- **WHEN** `AgentService.startAgent()` invokes the registered callback
- **THEN** the callback implementation in `extension.ts` SHALL call `harness.run(IssueContext)` with owner, repo, issueNumber, title, body, labels, and column

#### Scenario: Harness result flows back to agent service
- **WHEN** `harness.run()` completes
- **THEN** the callback SHALL call `agentService.finishAgent(issueId)` to clear WIP and trigger next issue

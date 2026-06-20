## ADDED Requirements

### Requirement: Extension spawns Claude Code CLI headlessly on trigger
When an assignment or column-move trigger fires and auto-work is enabled, the extension SHALL spawn `claude -p` as a child process with a structured prompt containing the issue details. The Claude Code CLI (`npm install -g @anthropic-ai/claude-code`) is a **required dependency** — the extension SHALL NOT function for auto-work without it.

#### Scenario: Claude spawned with correct flags
- **WHEN** a trigger fires and auto-work is enabled
- **THEN** the extension spawns `claude` with arguments: `-p "<prompt>"`, `--allowedTools "<tools>"`, `--max-turns <N>`

#### Scenario: Prompt includes issue context
- **WHEN** the extension builds the Claude prompt
- **THEN** the prompt includes issue number, title, body, labels, and column name

#### Scenario: Prompt instructs Claude to stage but not commit
- **WHEN** the extension builds the Claude prompt
- **THEN** the prompt includes instructions to stage changes but not commit them

#### Scenario: Claude runs in workspace directory
- **WHEN** the extension spawns the Claude process
- **THEN** the working directory (`cwd`) is set to the workspace root

#### Scenario: Claude receives GitHub token via env
- **WHEN** the extension spawns the Claude process
- **THEN** the `GITHUB_TOKEN` environment variable is passed to the child process

### Requirement: Extension detects issue assignment to current user
The extension SHALL detect when an issue on the tracked kanban board is assigned to the current authenticated GitHub user. Detection SHALL occur through the delta detection mechanism comparing consecutive poll results.

#### Scenario: User assigned to issue triggers detection
- **WHEN** a poll result shows an issue with `assignees` including the current user, and the previous poll result did not
- **THEN** the extension emits an assignment event for that issue

#### Scenario: User removed from assignment does not trigger
- **WHEN** a poll result shows an issue where the current user was removed from `assignees`
- **THEN** the extension does NOT emit an assignment event

#### Scenario: Re-assignment to same user does not re-trigger
- **WHEN** an issue is already assigned to the current user in the previous poll result
- **THEN** the extension does NOT emit a duplicate assignment event

### Requirement: Extension detects issue movement into AI-triggered columns
The extension SHALL detect when an issue moves into a column configured as AI-triggered (default: `AI_SPEC`, `AI_CODE`). Detection SHALL occur through the delta detection mechanism comparing consecutive poll results.

#### Scenario: Issue moves into AI_CODE column
- **WHEN** a poll result shows an issue in `AI_CODE` column and the previous poll showed it in a different column
- **THEN** the extension emits a column-move event for that issue

#### Scenario: Issue moves between non-trigger columns
- **WHEN** an issue moves from `BRAIN_DUMP` to `HUMAN_SPEC_REVIEW`
- **THEN** the extension does NOT emit a column-move event

#### Scenario: Configurable trigger columns
- **WHEN** the user configures `aiOs.autoWorkColumns` to include only `AI_CODE`
- **THEN** only movement into `AI_CODE` triggers the event, not `AI_SPEC`

### Requirement: Auto-work is disabled by default
The assignment trigger SHALL be disabled by default. The user MUST explicitly enable it through the `aiOs.autoWorkAssignments` setting or the "AI OS: Enable Auto-Work" command.

#### Scenario: Auto-work disabled by default
- **WHEN** the extension activates and `aiOs.autoWorkAssignments` is not set
- **THEN** assignment triggers do NOT spawn Claude Code

#### Scenario: User enables auto-work via settings
- **WHEN** the user sets `aiOs.autoWorkAssignments` to `true` in VS Code settings
- **THEN** assignment triggers spawn Claude Code

#### Scenario: User enables auto-work via command
- **WHEN** the user runs "AI OS: Enable Auto-Work" command
- **THEN** the extension sets `aiOs.autoWorkAssignments` to `true` and confirms with a notification

### Requirement: Extension shows confirmation before spawning Claude
When `aiOs.autoWorkConfirmFirst` is enabled (default: true), the extension SHALL show a notification asking the user to confirm before spawning Claude Code.

#### Scenario: Confirmation notification shown
- **WHEN** a trigger fires and `aiOs.autoWorkConfirmFirst` is true
- **THEN** the extension shows a notification "Starting work on #N: <title>" with "Proceed" and "Dismiss" buttons

#### Scenario: User confirms
- **WHEN** the user clicks "Proceed" on the confirmation notification
- **THEN** the extension spawns Claude Code

#### Scenario: User dismisses
- **WHEN** the user clicks "Dismiss" on the confirmation notification
- **THEN** the extension does NOT spawn Claude Code

#### Scenario: Confirm-first disabled
- **WHEN** `aiOs.autoWorkConfirmFirst` is false
- **THEN** the extension spawns Claude Code immediately without showing a notification

### Requirement: Extension uses --allowedTools not --dangerously-skip-permissions
The extension SHALL use the `--allowedTools` flag to whitelist specific tools for Claude Code. The extension SHALL NEVER use `--dangerously-skip-permissions` as it removes all safety guardrails.

#### Scenario: Allowed tools from settings
- **WHEN** the extension spawns Claude Code
- **THEN** it passes `--allowedTools` with the value from `aiOs.autoWorkAllowedTools` setting (default: `Read,Edit,Bash`)

#### Scenario: No dangerously-skip-permissions
- **WHEN** the extension spawns Claude Code
- **THEN** the `--dangerously-skip-permissions` flag is NOT included in the command

### Requirement: Extension enforces max-turns limit
The extension SHALL pass `--max-turns` to Claude Code to prevent unbounded execution. The default SHALL be 50 turns.

#### Scenario: Max turns from settings
- **WHEN** the extension spawns Claude Code
- **THEN** it passes `--max-turns` with the value from `aiOs.autoWorkMaxTurns` setting (default: 50)

### Requirement: Extension captures Claude output in VS Code output channel
The extension SHALL capture stdout and stderr from the Claude Code process and stream them to a dedicated VS Code output channel named `AI OS - Claude #<issueNumber>`.

#### Scenario: Output channel created
- **WHEN** the extension spawns Claude Code for issue #42
- **THEN** an output channel named `AI OS - Claude #42` is created

#### Scenario: Stdout streamed to output channel
- **WHEN** Claude Code writes to stdout
- **THEN** the output appears in the `AI OS - Claude #<N>` output channel

#### Scenario: Stderr streamed to output channel
- **WHEN** Claude Code writes to stderr
- **THEN** the output appears in the `AI OS - Claude #<N>` output channel

#### Scenario: Output channel disposed on completion
- **WHEN** the Claude Code process exits
- **THEN** the output channel remains available for review but is marked as completed

### Requirement: Extension notifies user on Claude completion
When the Claude Code process exits, the extension SHALL show a notification indicating success or failure.

#### Scenario: Claude exits successfully
- **WHEN** the Claude Code process exits with code 0
- **THEN** the extension shows "✅ Claude completed work on #N" with a "Review Changes" button

#### Scenario: Claude exits with error
- **WHEN** the Claude Code process exits with non-zero code
- **THEN** the extension shows "⚠️ Claude exited with code N on #N"

#### Scenario: Review Changes opens output channel
- **WHEN** the user clicks "Review Changes" on the completion notification
- **THEN** the `AI OS - Claude #<N>` output channel is shown

### Requirement: Extension prevents concurrent Claude processes per issue
The extension SHALL NOT spawn multiple Claude Code processes for the same issue number simultaneously.

#### Scenario: Duplicate trigger prevented
- **WHEN** a trigger fires for issue #42 while Claude is already working on #42
- **THEN** the extension does NOT spawn a second Claude process and logs a warning

#### Scenario: Different issues can run concurrently
- **WHEN** triggers fire for issues #42 and #47 simultaneously
- **THEN** the extension spawns two separate Claude processes

### Requirement: Extension tracks active Claude processes
The extension SHALL maintain a set of active Claude process IDs keyed by issue number for lifecycle management.

#### Scenario: Process tracked on spawn
- **WHEN** the extension spawns Claude Code for issue #42
- **THEN** the process ID is stored in the active processes map under key `42`

#### Scenario: Process removed on exit
- **WHEN** the Claude Code process for issue #42 exits
- **THEN** the process ID is removed from the active processes map

#### Scenario: Processes killed on extension deactivate
- **WHEN** the extension deactivates
- **THEN** all active Claude Code processes are terminated

### Requirement: Kanban board shows working indicator on active issues
The kanban board SHALL display a visual working indicator (spinning animation) on issue cards where Claude Code is currently active. The indicator SHALL start when Claude is spawned and stop when the process exits.

#### Scenario: Spinner appears when Claude starts
- **WHEN** the extension spawns Claude Code for issue #42
- **THEN** the issue card for #42 in the kanban board displays a spinning indicator

#### Scenario: Spinner disappears when Claude completes
- **WHEN** the Claude Code process for issue #42 exits
- **THEN** the spinning indicator is removed from the issue card

#### Scenario: Multiple issues show spinners concurrently
- **WHEN** Claude is working on issues #42 and #47 simultaneously
- **THEN** both issue cards display spinning indicators

#### Scenario: Spinner uses VS Code progress color
- **WHEN** the spinner is rendered
- **THEN** it uses `color-vscode-progressBar-background` from the Tailwind `@theme` block

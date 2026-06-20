
## ADDED Requirements

### Requirement: Extension provides a settings webview panel
The extension SHALL provide a webview panel (`SettingsPanel`) that displays all AI OS configuration options in a single UI. The panel SHALL be opened via the "AI OS: Open Settings" command from the Command Palette. The user SHALL NEVER need to open VS Code's native settings JSON or search for individual settings.

#### Scenario: User opens settings panel
- **WHEN** the user runs "AI OS: Open Settings" from the Command Palette
- **THEN** a webview panel titled "AI OS Settings" is shown in the editor area

#### Scenario: Settings panel reuses existing panel
- **WHEN** the user runs "AI OS: Open Settings" and a settings panel is already open
- **THEN** the existing panel is revealed (not a new panel created)

#### Scenario: Settings panel disposed on close
- **WHEN** the user closes the settings panel
- **THEN** the panel is disposed and cleanup is performed

### Requirement: Extension detects Claude Code installation automatically
Before showing MCP connection options, the extension SHALL automatically detect whether Claude Code is installed on the user's system. Detection SHALL check two independent sources: (1) the Claude Code VS Code extension (`anthropic.claude-code`) via `vscode.extensions.getExtension()`, and (2) the Claude Code CLI (`claude`) via spawning `which claude` (or `where claude` on Windows). The settings panel SHALL display the detection result and guide the user to install Claude Code if missing.

#### Scenario: Claude VS Code extension detected
- **WHEN** `vscode.extensions.getExtension('anthropic.claude-code')` returns a non-null extension
- **THEN** the extension marks the VS Code extension as installed

#### Scenario: Claude CLI detected
- **WHEN** spawning `which claude` (Linux/macOS) or `where claude` (Windows) exits with code 0
- **THEN** the extension marks the CLI as installed

#### Scenario: Claude not installed — settings panel shows install guide
- **WHEN** neither the VS Code extension nor the CLI is detected
- **THEN** the settings panel shows "Claude Code not found" with an "Install Claude Code" button that opens https://claude.ai/download

#### Scenario: Only VS Code extension installed
- **WHEN** the VS Code extension is detected but the CLI is not
- **THEN** the settings panel shows "Claude Code extension installed (CLI not found)" with a warning that auto-work requires the CLI

#### Scenario: Only CLI installed
- **WHEN** the CLI is detected but the VS Code extension is not
- **THEN** MCP configuration still works (Claude Code direct mode uses the CLI)

#### Scenario: User clicks Connect
- **WHEN** the user clicks the "Connect" button in the settings panel
- **THEN** the extension writes the MCP entry to `~/.claude/settings.json` and updates the status to Connected

#### Scenario: User clicks Disconnect
- **WHEN** the user clicks the "Disconnect" button in the settings panel
- **THEN** the extension removes the MCP entry from `~/.claude/settings.json` and updates the status to Disconnected

### Requirement: Settings panel shows auto-work toggle
The settings panel SHALL display a toggle switch for enabling/disabling auto-work assignments.

#### Scenario: Auto-work toggle displayed
- **WHEN** the settings panel is open
- **THEN** a toggle labeled "Auto-Work Assignments" is shown with the current value from `aiOs.autoWorkAssignments`

#### Scenario: User enables auto-work
- **WHEN** the user toggles "Auto-Work Assignments" to ON
- **THEN** the extension updates `aiOs.autoWorkAssignments` to `true` and shows a confirmation notification

#### Scenario: User disables auto-work
- **WHEN** the user toggles "Auto-Work Assignments" to OFF
- **THEN** the extension updates `aiOs.autoWorkAssignments` to `false`

### Requirement: Settings panel shows max-turns input
The settings panel SHALL display a numeric input for configuring the maximum number of turns Claude Code can execute.

#### Scenario: Max-turns input displayed
- **WHEN** the settings panel is open
- **THEN** a numeric input labeled "Max Turns" is shown with the current value from `aiOs.autoWorkMaxTurns` (default: 50)

#### Scenario: User changes max-turns
- **WHEN** the user enters a new value in the "Max Turns" input
- **THEN** the extension updates `aiOs.autoWorkMaxTurns` and saves the value

#### Scenario: Invalid max-turns rejected
- **WHEN** the user enters a value less than 1 or greater than 500
- **THEN** the input shows an error message "Value must be between 1 and 500" and the value is not saved

### Requirement: Settings panel shows allowed tools editor
The settings panel SHALL display a text input for configuring the comma-separated list of allowed tools for Claude Code.

#### Scenario: Allowed tools input displayed
- **WHEN** the settings panel is open
- **THEN** a text input labeled "Allowed Tools" is shown with the current value from `aiOs.autoWorkAllowedTools` (default: `Read,Edit,Bash`)

#### Scenario: User changes allowed tools
- **WHEN** the user enters a new comma-separated list in the "Allowed Tools" input
- **THEN** the extension updates `aiOs.autoWorkAllowedTools` and saves the value

### Requirement: Settings panel shows trigger columns checkboxes
The settings panel SHALL display checkboxes for selecting which columns trigger auto-work.

#### Scenario: Trigger columns displayed
- **WHEN** the settings panel is open
- **THEN** checkboxes for each kanban column are shown, with checked state matching `aiOs.autoWorkColumns` (default: `AI_SPEC`, `AI_CODE`)

#### Scenario: User toggles trigger column
- **WHEN** the user checks or unchecks a column checkbox
- **THEN** the extension updates `aiOs.autoWorkColumns` and saves the value

### Requirement: Settings panel shows confirm-first toggle
The settings panel SHALL display a toggle for enabling/disabling the confirmation notification before spawning Claude.

#### Scenario: Confirm-first toggle displayed
- **WHEN** the settings panel is open
- **THEN** a toggle labeled "Confirm Before Starting" is shown with the current value from `aiOs.autoWorkConfirmFirst` (default: true)

#### Scenario: User toggles confirm-first
- **WHEN** the user toggles "Confirm Before Starting"
- **THEN** the extension updates `aiOs.autoWorkConfirmFirst` and saves the value

### Requirement: Settings panel loads current values on open
When the settings panel is opened, it SHALL load all current setting values from VS Code's configuration and display them.

#### Scenario: Settings loaded on open
- **WHEN** the settings panel is opened
- **THEN** all form fields are populated with current values from `vscode.workspace.getConfiguration('aiOs')`

### Requirement: Settings panel saves changes immediately
Each setting change in the settings panel SHALL be saved immediately to VS Code's configuration without requiring a "Save" button.

#### Scenario: Toggle saved immediately
- **WHEN** the user toggles a setting
- **THEN** the value is saved to `vscode.workspace.getConfiguration('aiOs').update()` before the message reaches the webview

#### Scenario: Input saved on blur
- **WHEN** the user finishes editing a text input and clicks away
- **THEN** the value is saved to VS Code configuration

### Requirement: Settings panel uses Tailwind utility classes from existing @theme definitions
The settings panel SHALL use Tailwind CSS v4 utility classes generated from the `@theme` block in `webview-ui/src/styles/index.css`. All colors MUST use the existing `bg-vscode-*`, `text-vscode-*`, `border-vscode-*` utility classes — NOT raw `var(--vscode-*)` CSS variables or inline styles. This matches the styling approach of all existing components (KanbanBoard, Header, IssueCard, KanbanColumn).

#### Scenario: Panel background uses panel theme color
- **WHEN** the settings panel is rendered
- **THEN** the root container uses `bg-vscode-panel-background` (not `background: var(--vscode-panel-background)`)

#### Scenario: Text uses panel foreground color
- **WHEN** text is rendered in the settings panel
- **THEN** text uses `text-vscode-panel-foreground`

#### Scenario: Inputs use input theme colors
- **WHEN** input fields are rendered
- **THEN** inputs use `bg-vscode-input-background`, `text-vscode-input-foreground`, `border-vscode-input-border`

#### Scenario: Buttons use button theme colors
- **WHEN** buttons are rendered
- **THEN** buttons use `bg-vscode-button-background`, `text-vscode-button-foreground`, `hover:bg-vscode-button-hoverBackground`

#### Scenario: Section headers use section header colors
- **WHEN** section headers are rendered
- **THEN** headers use `bg-vscode-sideBarSectionHeader-background`, `text-vscode-sideBarSectionHeader-foreground`

#### Scenario: No raw CSS variables in JSX
- **WHEN** reviewing the settings panel JSX source
- **THEN** no `var(--vscode-*)` or inline `style={{}}` color declarations exist

### Requirement: Settings panel IPC message validation
All IPC messages received from the settings panel SHALL be validated for type and data structure before processing.

#### Scenario: Valid settings update message
- **WHEN** the settings panel sends `{ type: 'updateSetting', data: { key: 'autoWorkAssignments', value: true } }`
- **THEN** the extension updates the setting

#### Scenario: Invalid message rejected
- **WHEN** the settings panel sends a message with an unknown type
- **THEN** the message is logged as a warning and ignored

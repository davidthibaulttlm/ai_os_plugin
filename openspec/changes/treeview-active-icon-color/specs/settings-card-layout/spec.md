## ADDED Requirements

### Requirement: Settings pane uses card-style section grouping
The settings pane SHALL organize settings into visual card sections with section headers. Settings SHALL be grouped logically: Repositories (directory config + clone action), Claude Integration (connect/disconnect actions).

#### Scenario: Settings shows grouped sections
- **WHEN** the user switches to settings mode
- **THEN** the treeview displays section headers: "REPOSITORIES", "CLAUDE INTEGRATION"
- **AND** each section groups related settings together visually

#### Scenario: Repositories section contains directory and clone action
- **WHEN** the user views the Repositories section
- **THEN** it contains: Repos Directory input, Clone Repos action with status badge

#### Scenario: Claude Integration section contains connect/disconnect actions
- **WHEN** the user views the Claude Integration section
- **THEN** it contains: Connect to Claude Code action, Disconnect from Claude Code action

### Requirement: Clone Repos shows current clone status
The Clone Repos tree item SHALL display the current clone status in the `description` field. When repos are cloned, it SHALL show a check icon (`$(repo-cloned)`) with description `Cloned`. When repos are not cloned, it SHALL show a repo icon (`$(repo)`) with description `Not cloned`. When no board is open, it SHALL show description `No board open` and be non-clickable.

#### Scenario: Repos cloned shows check badge
- **WHEN** repos for the current board are cloned
- **THEN** the tree item displays `$(repo-cloned) Clone Repos` with description `Cloned`
- **AND** clicking the item triggers the clone/update repos command

#### Scenario: Repos not cloned shows warning badge
- **WHEN** repos for the current board are not cloned
- **THEN** the tree item displays `$(repo) Clone Repos` with description `Not cloned`
- **AND** clicking the item triggers the clone repos command

#### Scenario: No board open shows disabled state
- **WHEN** no board is currently open
- **THEN** the tree item displays `$(repo) Clone Repos` with description `No board open`
- **AND** the item is non-clickable (no command attached)

### Requirement: Input settings show current value in description
Input-type settings SHALL display their current value in the `description` field.

#### Scenario: Repos Directory shows current path
- **WHEN** Repos Directory is set to `~/ai-os-repos`
- **THEN** the tree item displays `$(folder) Repos Directory` with description `~/ai-os-repos`

### Requirement: Action items are visually distinct
Action-type settings SHALL use distinct icons. Connect SHALL use `$(cloud-upload)` and Disconnect SHALL use `$(plug)`.

#### Scenario: Connect action uses cloud icon
- **WHEN** the user views the Claude Integration section
- **THEN** "Connect to Claude Code" displays with `$(cloud-upload)` icon

#### Scenario: Disconnect action uses plug icon
- **WHEN** the user views the Claude Integration section
- **THEN** "Disconnect from Claude Code" displays with `$(plug)` icon

### Requirement: Section headers are non-interactive visual separators
Section headers SHALL be non-clickable tree items with `collapsibleState: CollapsibleState.None` and no associated command.

#### Scenario: Section header is not clickable
- **WHEN** the user clicks a section header
- **THEN** nothing happens

### Requirement: Remove redundant settings header item
The old `$(gear) AI OS Settings` header item SHALL be removed from the settings pane.

#### Scenario: No redundant header
- **WHEN** the user views the settings pane
- **THEN** there is no "AI OS Settings" header item at the top

## REMOVED Requirements

### Requirement: Auto-Work Assignments toggle
**Reason**: Work is always auto-assigned.
**Migration**: Auto-work always enabled. Config key orphaned but harmless.

### Requirement: Confirm Before Work toggle
**Reason**: Work should never require confirmation.
**Migration**: Confirmation always skipped. Config key orphaned but harmless.

### Requirement: Max Turns limit
**Reason**: Agents should never be capped by turn limits.
**Migration**: `--max-turns` removed from Claude Code CLI. Config key orphaned but harmless.

### Requirement: Allowed Tools restriction
**Reason**: Agents should use all tools freely.
**Migration**: `--allowed-tools` removed from Claude Code CLI. Config key orphaned but harmless.

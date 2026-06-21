## ADDED Requirements

### Requirement: Active mode toggle shows distinct icon and label in submenu
The actions submenu SHALL display a visually distinct entry for the settings/boards toggle depending on the current pane mode. When in `boards` mode, the entry SHALL show `$(settings-gear) Open Settings`. When in `settings` mode, the entry SHALL show `$(list-selection) Back to Boards`.

#### Scenario: Settings mode shows Back to Boards entry
- **WHEN** the treeview is in `settings` mode
- **THEN** the actions submenu displays "Back to Boards" with the `$(list-selection)` icon
- **AND** the "Open Settings" entry is hidden

#### Scenario: Boards mode shows Open Settings entry
- **WHEN** the treeview is in `boards` mode
- **THEN** the actions submenu displays "Open Settings" with the `$(settings-gear)` icon
- **AND** the "Back to Boards" entry is hidden

### Requirement: Mode context key is set on mode change
The extension SHALL maintain a VS Code context key `aiOs.treeMode` that reflects the current treeview mode (`'boards'` or `'settings'`). This context key MUST be updated whenever the mode changes so that submenu `when` clauses re-evaluate.

#### Scenario: Context key updated when switching to settings
- **WHEN** the user clicks the settings toggle and the mode changes to `settings`
- **THEN** the context key `aiOs.treeMode` is set to `'settings'`
- **AND** the submenu `when` clauses re-evaluate to show "Back to Boards"

#### Scenario: Context key updated when switching to boards
- **WHEN** the user clicks the settings toggle and the mode changes back to `boards`
- **THEN** the context key `aiOs.treeMode` is set to `'boards'`
- **AND** the submenu `when` clauses re-evaluate to show "Open Settings"

### Requirement: Only one toggle entry is visible at a time
The actions submenu SHALL show exactly one settings/boards toggle entry at any given time. The "Open Settings" and "Back to Boards" entries MUST be mutually exclusive via `when` clauses.

#### Scenario: No duplicate toggle entries visible
- **WHEN** the treeview is in any mode
- **THEN** only one settings/boards toggle entry is visible in the actions submenu

### Requirement: Refresh board button removed from view-title menu
The "Refresh Board" button (`aiOs.refreshBoard`) SHALL NOT appear in the view-title menu. The command SHALL still exist and be accessible via the command palette.

#### Scenario: Refresh button not in title bar
- **WHEN** the user views the treeview title bar
- **THEN** no refresh button is visible in the action icons

#### Scenario: Refresh command still accessible
- **WHEN** the user opens the command palette and searches for "Refresh Board"
- **THEN** the `aiOs.refreshBoard` command is available

### Requirement: Actions submenu replaces flat icon bar
The view-title menu SHALL contain a native VS Code submenu (`aiOs.actions`) with an ellipsis icon (`$(more)`) that contains secondary actions. The Start Agent button (`▶`) SHALL remain pinned in the title bar outside the submenu.

#### Scenario: Submenu appears in title bar
- **WHEN** the user views the treeview title bar
- **THEN** an ellipsis icon is visible that opens a dropdown menu
- **AND** the Start Agent button is visible as a pinned action

#### Scenario: Submenu contains expected actions
- **WHEN** the user clicks the ellipsis icon
- **THEN** the submenu shows "Fetch Boards" and the settings/boards toggle entry

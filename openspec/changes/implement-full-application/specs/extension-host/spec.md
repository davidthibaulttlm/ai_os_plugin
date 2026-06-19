## ADDED Requirements

### Requirement: Extension activates and registers commands
The extension SHALL activate on command invocation and register all AI OS commands in the command palette.

#### Scenario: Extension activates on Open Board command
- **WHEN** user runs `AI OS: Open Board` command
- **THEN** the extension activates and shows the kanban webview panel

#### Scenario: Commands appear in palette
- **WHEN** user opens command palette (Ctrl+Shift+P)
- **THEN** commands `AI OS: Open Board`, `AI OS: Assign Agent`, `AI OS: Refresh Board` are visible

### Requirement: Extension manages persistent state via Memento
The extension SHALL store and retrieve persistent state using VS Code's `Memento` API.

#### Scenario: Last board ID persists across sessions
- **WHEN** user selects a board and closes VS Code
- **THEN** the last selected board ID is restored on next activation

#### Scenario: Column field mapping persists in Memento
- **WHEN** column field mapping (field IDs to column names) is fetched from GitHub
- **THEN** the mapping is stored in Memento for reuse on next activation

### Requirement: Extension lists and selects GitHub Projects
The extension SHALL list the user's GitHub Projects and allow selection of a board to display.

#### Scenario: Project picker shows available projects
- **WHEN** user runs `AI OS: Open Board` and no board is selected
- **THEN** a quick-pick list of the user's GitHub Projects is displayed

#### Scenario: Selected project is persisted
- **WHEN** user selects a project from the picker
- **THEN** the project ID is stored in Memento and the board is loaded

#### Scenario: Personal and org projects included
- **WHEN** project list is fetched
- **THEN** projects from both the viewer's personal account and organization memberships are included

### Requirement: Extension spawns and manages Python backend process
The extension SHALL start the Python FastAPI backend as a subprocess on activation and communicate via HTTP.

#### Scenario: Backend starts on activation
- **WHEN** extension activates
- **THEN** the Python backend process is started and listening on localhost:8000

#### Scenario: Extension communicates with backend via HTTP
- **WHEN** extension needs to call a backend API
- **THEN** it sends an HTTP request to localhost:8000

#### Scenario: Backend stops on deactivation
- **WHEN** extension deactivates
- **THEN** the Python backend process is terminated AND any open webview panels are disposed

#### Scenario: Backend auto-restarts on crash
- **WHEN** the Python backend process exits unexpectedly
- **THEN** the extension host detects the crash and restarts the backend process

### Requirement: Webview panel is created with proper options
The extension SHALL create the webview panel with security and persistence options.

#### Scenario: CSP nonce included in webview HTML
- **WHEN** webview HTML is generated
- **THEN** Content-Security-Policy includes a nonce for script-src

#### Scenario: retainContextWhenHidden is enabled
- **WHEN** webview panel is created
- **THEN** `retainContextWhenHidden` is set to true

### Requirement: Webview panel communicates via postMessage IPC
The extension SHALL route messages between the webview and backend using `postMessage`.

#### Scenario: Webview requests board data
- **WHEN** webview sends `{ type: 'loadBoard', boardId: '...' }`
- **THEN** extension calls backend HTTP API and forwards response to webview

#### Scenario: Webview moves an item
- **WHEN** webview sends `{ type: 'moveItem', itemId: '...', columnId: '...' }`
- **THEN** extension calls backend mutation endpoint and confirms to webview

#### Scenario: Webview selects an issue
- **WHEN** webview sends `{ type: 'selectIssue', issueId: '...' }`
- **THEN** extension stores the selected issue ID in state

#### Scenario: Webview requests agent assignment
- **WHEN** webview sends `{ type: 'assignAgent', issueId: '...' }`
- **THEN** extension calls backend to trigger agent and confirms to webview

#### Scenario: Agent progress forwarded to webview
- **WHEN** AI agent reports progress from backend
- **THEN** extension posts `{ type: 'agentProgress', data: { issueId, status } }` to webview

#### Scenario: Errors are forwarded to webview
- **WHEN** backend returns an error
- **THEN** webview receives `{ type: 'error', data: { message: '...' } }`

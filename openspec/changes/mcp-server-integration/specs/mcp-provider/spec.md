## ADDED Requirements

### Requirement: Extension registers MCP server definition provider
The extension SHALL register an MCP server definition provider using `vscode.lm.registerMcpServerDefinitionProvider` during activation. The provider ID SHALL match the `id` declared in `package.json` under `contributes.mcpServerDefinitionProviders`.

#### Scenario: Provider registered on activation
- **WHEN** the extension activates
- **THEN** an MCP server definition provider is registered with ID `aiOsMcpProvider`

#### Scenario: Provider ID matches package.json
- **WHEN** the extension reads `contributes.mcpServerDefinitionProviders[0].id` from package.json
- **THEN** the ID matches the provider ID passed to `registerMcpServerDefinitionProvider`

### Requirement: Provider returns MCP server definition with stdio transport
The `provideMcpServerDefinitions` method SHALL return an array containing at least one `McpStdioServerDefinition` that points to the bundled MCP server entry file.

#### Scenario: Provider returns stdio server definition
- **WHEN** VS Code requests MCP server definitions from the provider
- **THEN** the provider returns an `McpStdioServerDefinition` with command `node` and args pointing to `out/mcp/server.js`

#### Scenario: Server path is resolved from extension URI
- **WHEN** the provider constructs the MCP server path
- **THEN** it uses `vscode.Uri.joinPath(context.extensionUri, 'out', 'mcp', 'server.js')` to resolve the absolute path

### Requirement: Provider injects GitHub token and state file path via environment variables
The MCP server definition SHALL include the GitHub token in the `env` property as `GITHUB_TOKEN` and the state file path as `AI_OS_STATE_FILE`. The token SHALL be retrieved from the extension's auth service. The state file path SHALL point to `board-state.json` in `context.globalStorageUri`.

#### Scenario: Token injected when authenticated
- **WHEN** the user is authenticated and a GitHub token is available
- **THEN** the MCP server definition includes `GITHUB_TOKEN` in the env object

#### Scenario: State file path injected
- **WHEN** the provider constructs the MCP server definition
- **THEN** the env object includes `AI_OS_STATE_FILE` pointing to the board state JSON file in global storage

#### Scenario: No token injected when not authenticated
- **WHEN** the user is not authenticated
- **THEN** the MCP server definition does not include `GITHUB_TOKEN` in the env object

### Requirement: Claude config writes token to all config files securely
The `aiOs.configureClaude` command SHALL write the GitHub token to ALL Claude Code configuration files where MCP servers are read. This includes `~/.claude.json` (global `mcpServers` AND project-level entries), `~/.claude/.mcp.json`, `~/.claude/settings.json`, and `.mcp.json` in the workspace root. Each file SHALL be written with restrictive permissions (0o600 — owner read/write only) where the OS supports it. The token is already stored in VS Code's Memento, and the Claude config file is a standard Claude Code convention.

#### Scenario: Config file has restrictive permissions
- **WHEN** the configure command writes any Claude config file
- **THEN** the file permissions are set to 0o600 (owner read/write only) on platforms that support chmod

#### Scenario: Token written as literal in env
- **WHEN** the configure command writes the config
- **THEN** the `env.GITHUB_TOKEN` field contains the actual token string value

#### Scenario: Project-level entry prevents empty override
- **WHEN** `~/.claude.json` has a project entry for the current workspace with empty `mcpServers: {}`
- **THEN** the configure command writes the `ai-os` entry into the project-level `mcpServers` to prevent the empty object from overriding the global config

### Requirement: Provider contributes to package.json mcpServerDefinitionProviders
The `package.json` file SHALL include a `contributes.mcpServerDefinitionProviders` array with at least one entry containing `id` and `label` properties.

#### Scenario: Package.json contains MCP provider contribution
- **WHEN** the extension package.json is parsed
- **THEN** `contributes.mcpServerDefinitionProviders` contains an entry with `id: "aiOsMcpProvider"` and a human-readable `label`

### Requirement: Provider disposal cleans up subscriptions
The MCP server definition provider registration SHALL be added to `context.subscriptions` so it is disposed when the extension deactivates.

#### Scenario: Provider disposed on extension deactivate
- **WHEN** the extension deactivates
- **THEN** the MCP server definition provider registration is disposed

### Requirement: Extension provides GUI command to configure Claude Code
The extension SHALL provide a command `aiOs.configureClaude` that programmatically writes the MCP server configuration to the Claude Code settings file (`~/.claude/settings.json`). The user SHALL NEVER need to open a terminal or manually edit any configuration file.

#### Scenario: User runs configure command from command palette
- **WHEN** the user runs "AI OS: Connect to Claude Code" from the Command Palette
- **THEN** the extension writes the MCP server entry to `~/.claude/settings.json` under `mcpServers["ai-os"]`

#### Scenario: Configure command shows success notification
- **WHEN** the configuration is written successfully
- **THEN** the extension shows an information message "AI OS tools configured for Claude Code!" with a "Restart Claude Code" action button

#### Scenario: Configure command handles missing config file
- **WHEN** `~/.claude/settings.json` does not exist
- **THEN** the extension creates the file and directory structure automatically

#### Scenario: Configure command preserves existing config
- **WHEN** `~/.claude/settings.json` already contains other MCP servers
- **THEN** the extension merges the `ai-os` entry without overwriting existing entries

#### Scenario: Configure command fails when not authenticated
- **WHEN** the user is not authenticated with GitHub
- **THEN** the extension shows an error message "Not authenticated. Sign in with GitHub first." and does not write the config

#### Scenario: Configure command warns when Claude not installed
- **WHEN** Claude Code CLI is not detected (see settings-webview spec) and user runs configure
- **THEN** the extension shows a warning "Claude Code CLI not found. Auto-work will not work. Install from https://claude.ai/download?" with "Install" and "Configure Anyway" buttons

### Requirement: Extension provides GUI command to disconnect from Claude Code
The extension SHALL provide a command `aiOs.disconnectClaude` that removes the MCP server entry from `~/.claude/settings.json`.

#### Scenario: User runs disconnect command
- **WHEN** the user runs "AI OS: Disconnect from Claude Code"
- **THEN** the extension removes the `ai-os` entry from `mcpServers` in `~/.claude/settings.json`

#### Scenario: Disconnect when not configured
- **WHEN** the `ai-os` entry does not exist in Claude config
- **THEN** the extension shows an information message "AI OS was not configured in Claude Code."

### Requirement: Extension shows onboarding notification after installation
The extension SHALL show a notification offering to connect to Claude Code when the extension is first activated or when the Claude Code config is not yet present.

#### Scenario: Onboarding notification shown
- **WHEN** the extension activates and no `ai-os` entry exists in Claude config
- **THEN** the extension shows a notification "AI OS installed! Connect to Claude Code?" with "Connect Now", "Later", and "Don't ask again" action buttons

#### Scenario: User clicks Connect Now
- **WHEN** the user clicks "Connect Now" on the onboarding notification
- **THEN** the extension executes the configure Claude command programmatically

#### Scenario: User dismisses onboarding
- **WHEN** the user clicks "Don't ask again"
- **THEN** the extension stores this preference and does not show the notification again

### Requirement: Configure command is idempotent
Running the configure command multiple times SHALL be safe and produce the same result. The command SHALL overwrite the `ai-os` entry with current paths and token on each run.

#### Scenario: Configure run twice
- **WHEN** the user runs "AI OS: Connect to Claude Code" twice in a row
- **THEN** the second run overwrites the `ai-os` entry with updated paths without creating duplicates

### Requirement: Configure command uses correct MCP server structure
The MCP server entry SHALL follow the Claude Code MCP configuration format with `command`, `args`, and `env` properties. The `command` SHALL be `node` (resolved from the VS Code Server environment where Claude Code runs).

#### Scenario: Config entry has correct structure
- **WHEN** the configure command writes the config
- **THEN** the `mcpServers["ai-os"]` entry contains `command: "node"`, `args: [serverPath]`, and `env` with `GITHUB_TOKEN` and `AI_OS_STATE_FILE`

### Requirement: Extension detects platform and uses correct node command
The extension SHALL detect the platform where Claude Code runs using `os.platform()`. The Claude Code VS Code extension runs inside the VS Code Server environment, so on WSL it reports `linux` and uses the native Linux `node` command. The extension SHALL NOT use `wsl` as the command when running inside WSL, because `wsl` does not exist inside the WSL environment.

#### Scenario: WSL platform detected
- **WHEN** the extension runs on WSL (VS Code Server on Linux)
- **THEN** `os.platform()` returns `linux` and the MCP entry uses `command: "node"`

#### Scenario: macOS platform detected
- **WHEN** the extension runs on macOS
- **THEN** `os.platform()` returns `darwin` and the MCP entry uses `command: "node"`

#### Scenario: Windows native platform detected
- **WHEN** the extension runs on Windows (not WSL)
- **THEN** `os.platform()` returns `win32` and the MCP entry uses `command: "node"`

### Requirement: Extension provides reinstall MCP command
The extension SHALL provide a command `aiOs.configureClaude` that can be re-run at any time to reinstall or repair the MCP configuration. Running the command multiple times SHALL be safe and idempotent, overwriting the existing `ai-os` entry with current paths and token.

#### Scenario: User reinstalls MCP from command palette
- **WHEN** the user runs "AI OS: Connect to Claude Code" after it was already configured
- **THEN** the extension overwrites the `ai-os` entry in all config files with current paths and token

#### Scenario: Reinstall after config corruption
- **WHEN** the Claude config files are corrupted or the `ai-os` entry is missing
- **THEN** running "AI OS: Connect to Claude Code" repairs the configuration

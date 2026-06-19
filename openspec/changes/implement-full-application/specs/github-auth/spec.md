## ADDED Requirements

### Requirement: Extension authenticates via gh CLI token
The extension SHALL extract the GitHub authentication token from the `gh` CLI.

#### Scenario: Token extracted from gh CLI
- **WHEN** `gh auth token` succeeds
- **THEN** the token is used for all GitHub API requests

#### Scenario: Fallback to GITHUB_TOKEN environment variable
- **WHEN** `gh auth token` fails and `GITHUB_TOKEN` is set
- **THEN** the environment variable token is used

#### Scenario: Warning shown when no auth available
- **WHEN** neither gh CLI nor GITHUB_TOKEN provides a token
- **THEN** a warning message is shown with a link to gh CLI authentication docs

#### Scenario: Token scope validation
- **WHEN** the token lacks required scopes (`repo`, `project`, `read:org`)
- **THEN** a warning is shown listing the missing scopes and the command to re-authenticate

### Requirement: Token is never exposed to webview
The authentication token SHALL only exist in the extension host and Python backend processes.

#### Scenario: Token not sent to webview
- **WHEN** webview requests board data
- **THEN** the token is not included in any IPC message to the webview

#### Scenario: Token passed securely to backend
- **WHEN** Python backend is started
- **THEN** the token is passed via environment variable, not command-line arguments

## ADDED Requirements

### Requirement: GraphQL client queries GitHub Projects v2
The backend SHALL provide an async GraphQL client that queries GitHub Projects v2 API.

#### Scenario: List user's projects
- **WHEN** `list_projects()` is called
- **THEN** it returns a list of project objects with id, title, url, and number, including projects from both the viewer's personal account and organization memberships

#### Scenario: Get project items with status
- **WHEN** `get_project_items(project_id)` is called
- **THEN** it returns items with type, field values (including Status), and content (Issue/PullRequest)

#### Scenario: Update item field value
- **WHEN** `update_item_field(project_id, item_id, field_id, value)` is called
- **THEN** the mutation executes and returns success status

### Requirement: GraphQL client fetches project field definitions
The GraphQL client SHALL fetch project field definitions and map single-select option IDs to kanban column names.

#### Scenario: Project fields fetched
- **WHEN** `get_project_fields(project_id)` is called
- **THEN** it returns field definitions including single-select fields with their option IDs and names

#### Scenario: Column mapping built from field options
- **WHEN** the Status field is found with single-select options
- **THEN** a mapping of option ID to column name (e.g., "AI_SPEC", "AI_CODE") is returned

### Requirement: Client handles pagination
The GraphQL client SHALL handle paginated responses for project items.

#### Scenario: All pages fetched
- **WHEN** a project has more than 50 items
- **THEN** all pages are fetched and combined into a single result list

### Requirement: Client respects rate limits
The GraphQL client SHALL monitor rate limit headers and back off when approaching limits.

#### Scenario: Rate limit header monitored
- **WHEN** a response includes `X-RateLimit-Remaining`
- **THEN** the remaining points are logged at DEBUG level with format `Rate limit remaining: {n}`

#### Scenario: Back off on rate limit error
- **WHEN** a 403 response indicates rate limit exceeded
- **THEN** the client waits before retrying

#### Scenario: Exponential backoff on network errors
- **WHEN** a transient network error occurs (connection reset, timeout)
- **THEN** the client retries with exponential backoff (1s, 2s, 4s, max 30s)

### Requirement: Backend exposes HTTP API endpoints
The backend SHALL expose HTTP endpoints for the extension host to call.

#### Scenario: Health check endpoint
- **WHEN** GET `/health` is called
- **THEN** the endpoint returns HTTP 200 with `{"status": "ok"}`

#### Scenario: List projects endpoint
- **WHEN** GET `/api/projects` is called
- **THEN** the endpoint returns a JSON array of project objects with id, title, url, and number

#### Scenario: Get board endpoint
- **WHEN** GET `/api/board/{project_id}` is called
- **THEN** the endpoint returns board data with columns and items

#### Scenario: Move item endpoint
- **WHEN** POST `/api/move-item` is called with `{ projectId, itemId, columnId }`
- **THEN** the endpoint executes the GraphQL mutation and returns `{ success: true }` or `{ success: false, error: '...' }`

#### Scenario: Refresh board endpoint
- **WHEN** POST `/api/refresh` is called with `{ projectId }`
- **THEN** the endpoint performs a fresh poll and returns updated board data

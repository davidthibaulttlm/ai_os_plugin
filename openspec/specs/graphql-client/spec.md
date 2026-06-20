## MODIFIED Requirements

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

#### Scenario: Reorder item position
- **WHEN** `reorder_item(project_id, item_id, after_id)` is called
- **THEN** the `updateProjectV2ItemPosition` mutation executes with `afterId` and returns success

## ADDED Requirements

### Requirement: GraphQL client supports item reordering
The GraphQL client SHALL provide a `reorderItem` method that calls `updateProjectV2ItemPosition` to change an item's position within a project.

#### Scenario: Item positioned after another item
- **WHEN** `reorderItem(projectId, itemId, afterId)` is called with a valid `afterId`
- **THEN** the mutation executes with `afterId` set and returns true on success

#### Scenario: Item moved to top
- **WHEN** `reorderItem(projectId, itemId, null)` is called with null `afterId`
- **THEN** the mutation executes with `afterId` as null, moving the item to the top of the project

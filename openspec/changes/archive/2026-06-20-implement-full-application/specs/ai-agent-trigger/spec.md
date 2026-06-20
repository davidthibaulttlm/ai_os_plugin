## ADDED Requirements

### Requirement: Agent triggers when issues enter AI_SPEC column
When an issue's Status changes to `AI_SPEC`, the agent trigger service SHALL detect and log the event.

#### Scenario: AI_SPEC trigger detected
- **WHEN** delta detection shows an item moved to AI_SPEC
- **THEN** the agent trigger logs the event at INFO level with issue ID and title, and calls the `on_agent_trigger(issue_id, column_name)` hook method

### Requirement: Agent triggers when issues enter AI_CODE column
When an issue's Status changes to `AI_CODE`, the agent trigger service SHALL detect and log the event.

#### Scenario: AI_CODE trigger detected
- **WHEN** delta detection shows an item moved to AI_CODE
- **THEN** the agent trigger logs the event at INFO level with issue ID and title, and calls the `on_agent_trigger(issue_id, column_name)` hook method

### Requirement: Agent trigger notifies user via VS Code notification
The agent trigger SHALL show a VS Code toast notification when an AI agent is triggered.

#### Scenario: Notification shown on trigger
- **WHEN** an issue enters AI_SPEC or AI_CODE
- **THEN** a toast notification appears: "AI agent triggered for [issue title]"

### Requirement: Agent trigger provides extensible hook interface
The agent trigger service SHALL provide an async hook method that subclasses may override for AI integration.

#### Scenario: Hook method defined with specific signature
- **WHEN** the trigger fires
- **THEN** it calls `async def on_agent_trigger(issue_id: str, column_name: str) -> None` which subclasses may override

### Requirement: Event handlers process detected deltas
The event handler SHALL process each delta event type and route to appropriate handlers.

#### Scenario: item_added event processed
- **WHEN** an `item_added` event is received
- **THEN** the handler logs the new item and checks if it entered an AI column

#### Scenario: item_moved event processed
- **WHEN** an `item_moved` event is received
- **THEN** the handler checks if the destination column is AI_SPEC or AI_CODE and triggers agent if so

#### Scenario: item_removed event processed
- **WHEN** an `item_removed` event is received
- **THEN** the handler logs the removal and cancels any in-progress agent work for that item

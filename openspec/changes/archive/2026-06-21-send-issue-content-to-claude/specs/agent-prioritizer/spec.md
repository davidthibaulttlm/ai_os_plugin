## MODIFIED Requirements

### Requirement: PrioritizerItem structure
The `PrioritizerItem` interface SHALL include an optional `body` field of type `string`. The interface MUST support items with and without body content.

#### Scenario: Item with body
- **WHEN** a `PrioritizerItem` is created from a GraphQL issue that has a body
- **THEN** the item includes `body` with the issue description text

#### Scenario: Item without body
- **WHEN** a `PrioritizerItem` is created from a GraphQL item with no body
- **THEN** the `body` field is `undefined` and the item is valid

### Requirement: Agent trigger callback signature
The `AgentTriggerCallback` type SHALL accept three parameters: `issueId: string`, `columnName: string`, and `body?: string`. Implementations MUST pass the body from board state when invoking the callback.

#### Scenario: Callback invoked with body
- **WHEN** `startAgent()` invokes the callback for an issue with a body
- **THEN** the callback receives `(issueId, columnName, body)` with all three values

#### Scenario: Callback invoked without body
- **WHEN** `startAgent()` invokes the callback for an issue without a body
- **THEN** the callback receives `(issueId, columnName, undefined)`

### Requirement: startAgent passes body to callback
The `startAgent()` method SHALL extract the body from the selected `PrioritizerItem` and pass it as the third argument to the callback.

#### Scenario: startAgent passes body
- **WHEN** `startAgent()` selects an issue that has a body in board state
- **THEN** the callback is invoked with the body text

### Requirement: onAgentTrigger passes body to callback
The `onAgentTrigger()` method SHALL look up the body from board state and pass it as the third argument to the callback.

#### Scenario: onAgentTrigger passes body
- **WHEN** `onAgentTrigger()` is called for an issue that exists in board state with a body
- **THEN** the callback is invoked with the body text

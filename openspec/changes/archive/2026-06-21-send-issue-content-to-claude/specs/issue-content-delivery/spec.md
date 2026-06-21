## ADDED Requirements

### Requirement: Issue body fetched in board poll
The GraphQL `CONTENT_FRAGMENT` SHALL include the `body` field so that issue descriptions are fetched during every board poll.

#### Scenario: Poll returns issue body
- **WHEN** the poller fetches board items via GraphQL
- **THEN** each issue's `body` field is included in the response

#### Scenario: PR items without body
- **WHEN** a board item is a PullRequest with no body text
- **THEN** the `body` field is `null` or `undefined` and the system handles it gracefully

### Requirement: PrioritizerItem carries issue body
The `PrioritizerItem` interface SHALL include an optional `body` field. The poller SHALL map `item.content?.body` into the `PrioritizerItem` when feeding board state to the agent service.

#### Scenario: Board state includes body
- **WHEN** the poller feeds board state to the agent service
- **THEN** each `PrioritizerItem` includes the issue body from the GraphQL response

#### Scenario: Item without body
- **WHEN** an issue has no body text
- **THEN** the `body` field is `undefined` and the item is still processed

### Requirement: Agent callback receives issue body
The `AgentTriggerCallback` type SHALL accept a third parameter `body?: string`. When `startAgent()` or `onAgentTrigger()` invokes the callback, it SHALL pass the issue body from the board state.

#### Scenario: Callback receives body
- **WHEN** the agent triggers for an issue that has a body
- **THEN** the callback is called with `(issueId, columnName, body)`

#### Scenario: Callback receives undefined body
- **WHEN** the agent triggers for an issue with no body
- **THEN** the callback is called with `(issueId, columnName, undefined)`

### Requirement: Claude prompt includes issue body
The `buildPrompt()` method in `ClaudeTrigger` SHALL include the issue body in the prompt when `event.body` is present.

#### Scenario: Prompt includes body
- **WHEN** a trigger event has a non-empty body
- **THEN** the built prompt contains a `Description:` section with the body text

#### Scenario: Prompt omits empty body
- **WHEN** a trigger event has no body or empty body
- **THEN** the built prompt does not contain a `Description:` section

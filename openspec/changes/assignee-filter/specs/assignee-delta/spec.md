## ADDED Requirements

### Requirement: Delta detection tracks assignee changes
The `detectDeltas()` function SHALL detect when the assignee list of an issue changes between polls and emit an `item_assigned` delta event.

#### Scenario: Issue gets new assignee
- **WHEN** an issue had assignees `["alice"]` in the last poll and `["alice", "bob"]` in the current poll
- **THEN** `detectDeltas()` SHALL emit an `item_assigned` event with the updated assignee list

#### Scenario: Issue loses assignee
- **WHEN** an issue had assignees `["alice", "bob"]` in the last poll and `["alice"]` in the current poll
- **THEN** `detectDeltas()` SHALL emit an `item_assigned` event with the updated assignee list

#### Scenario: No assignee change
- **WHEN** an issue has the same assignees in both polls
- **THEN** `detectDeltas()` SHALL NOT emit an `item_assigned` event for that issue

### Requirement: BoardItemState includes assignees
The `BoardItemState` interface SHALL include an `assignees` field (array of `{ login: string }`) for delta comparison.

#### Scenario: State includes assignees after poll
- **WHEN** the poller updates state via `updateState()`
- **THEN** each `BoardItemState` entry SHALL include the `assignees` array from the GraphQL response

### Requirement: DeltaEvent type includes item_assigned
The `DeltaEventType` union SHALL include `item_assigned` as a valid type.

#### Scenario: item_assigned event structure
- **WHEN** an `item_assigned` event is emitted
- **THEN** the event SHALL have `type: 'item_assigned'` and `data` containing `assignees: { login: string }[]`

## MODIFIED Requirements

### Requirement: Poller detects deltas between polls using in-memory state
The poller SHALL compare each poll result against the last-known state stored in-memory and detect changes.

#### Scenario: New item detected
- **WHEN** an item appears that wasn't in the last poll
- **THEN** an `item_added` event is dispatched

#### Scenario: Item status changed
- **WHEN** an item's Status field changes
- **THEN** an `item_moved` event is dispatched with old and new status

#### Scenario: Item removed detected
- **WHEN** an item exists in the last poll but not in the current poll
- **THEN** an `item_removed` event is dispatched

#### Scenario: Item title changed
- **WHEN** an item's title differs from the last-known state (and status is unchanged)
- **THEN** an `item_updated` event is dispatched with the old and new title

#### Scenario: Item labels changed
- **WHEN** an item's labels differ from the last-known state (order-insensitive comparison)
- **THEN** an `item_updated` event is dispatched with the updated labels

#### Scenario: No changes detected
- **WHEN** the board state is identical to last poll
- **THEN** no events are dispatched

#### Scenario: Status change takes priority over title change
- **WHEN** an item's status and title both change in the same poll cycle
- **THEN** only an `item_moved` event is dispatched (not `item_updated`)

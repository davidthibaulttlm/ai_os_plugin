## Why

When an issue is renamed on GitHub, the delta detection layer does not emit any event because it only tracks new items, status changes, and removed items. The poller's callback (which refreshes the webview) only fires when deltas are detected, so the webview never refreshes and the old title persists until manual refresh.

## What Changes

- Add `item_updated` as a new `DeltaEventType` alongside `item_added`, `item_moved`, and `item_removed`
- `detectDeltas()` now compares `title` and `labels` arrays between poll cycles and emits `item_updated` when they differ
- Label comparison is order-insensitive (sorted before comparison) to avoid false positives from label reorder

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `background-poller`: The poller's delta detection now includes title/label change detection via the new `item_updated` event type. Previously only structural changes (add/move/remove) were detected.

## Impact

- `src/services/delta.ts` — New `item_updated` event type and detection logic in `detectDeltas()`
- `src/test/services/delta.test.ts` — Existing tests continue to pass
- `src/test/services/delta.detectDeltas.item_updated.test.ts` — New test file for title/label change scenarios
- No breaking changes to existing delta event consumers (they already handle arbitrary event types via the `DeltaEvent` interface)

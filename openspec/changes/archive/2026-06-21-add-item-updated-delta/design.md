## Context

`detectDeltas()` in `src/services/delta.ts` compares current board items against in-memory state. It currently only detects structural changes: new items, status changes, and removed items. Title and label changes are invisible to the delta detector, so the webview is never refreshed when an issue is renamed externally on GitHub.

## Goals / Non-Goals

**Goals:**
- Detect title changes on existing issues and emit `item_updated` delta event
- Detect label changes (addition/removal) on existing issues
- Trigger webview refresh for title/label changes (same as other deltas)

**Non-Goals:**
- Detect body/content changes (out of scope — would require fetching full issue body on every poll)
- Detect assignee or milestone changes
- Add new delta event types beyond `item_updated`

## Decisions

- **Single `item_updated` event for both title and label changes**: Simpler than separate `title_changed` and `labels_changed` events. The data payload includes both fields so consumers can check what changed.
- **Label comparison is order-insensitive**: Labels are sorted before comparison to avoid false positives when GitHub returns labels in different order.
- **Status change takes priority over title change**: If both status and title change in the same poll cycle, only `item_moved` is emitted. This preserves existing behavior and keeps the event count minimal.

## Risks / Trade-offs

- **Event noise**: Title changes on every edit could increase delta events. Mitigation: The poller already handles multiple events per cycle, and the callback simply refreshes the board (idempotent).

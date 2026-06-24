## Why

When multiple team members share a GitHub Project board, the extension picks issues assigned to anyone — not just the current user. This breaks multi-user workflows: pressing Start could spawn an agent on a teammate's issue. The extension needs to respect assignee ownership and only work issues assigned to the logged-in user.

## What Changes

- **Assignee-only issue selection**: `selectNextIssue()` filters to issues where the current user is an assignee. No fallback to unassigned issues.
- **Popup messages for empty state**: When no issues are assigned to the user, show "No issues assigned to you. Assign yourself to an issue first." instead of generic "No issues available."
- **Agent completion popup**: When an agent finishes and no assigned issues remain, show "No more work available. Assign yourself to an issue to continue."
- **Assignee delta detection**: New `item_assigned` delta event type when assignee list changes between polls.
- **Assignee avatars on kanban cards**: Display assignee avatar circles on each card in the webview.

## Capabilities

### New Capabilities
- `assignee-filter`: Agent selects only issues assigned to current user. No fallback. Popup messages for empty states.
- `assignee-delta`: Detect assignee changes between polls and emit `item_assigned` events.
- `assignee-avatars`: Display assignee avatar circles on kanban cards in the webview.

### Modified Capabilities
- `agent-prioritizer`: The prioritizer now requires assignee data and filters by current user. This is a requirement change (not just implementation).

## Impact

- **GraphQL queries**: `CONTENT_FRAGMENT` in [`src/services/graphql.queries.ts`](src/services/graphql.queries.ts:4) adds `assignees(first: 5) { nodes { login, avatarUrl } }` to Issue and PR content.
- **Data pipeline**: [`src/services/delta.ts`](src/services/delta.ts), [`src/services/poller.ts`](src/services/poller.ts), [`src/services/agent.ts`](src/services/agent.ts) — assignees threaded through `BoardItemState`, `PrioritizerItem`, and delta detection.
- **Agent service**: [`src/services/agent.ts`](src/services/agent.ts) — new `setCurrentUser()` method, assignee filter in `selectNextIssue()`, popup message in `finishAgent()`.
- **Command handler**: [`src/extension.ts`](src/extension.ts:129) — distinct popup messages for "no assigned issues" vs "busy" vs "empty board".
- **Webview UI**: [`webview-ui/src/components/IssueCard.tsx`](webview-ui/src/components/IssueCard.tsx) — assignee avatar circles on each card.
- **Tests**: All existing agent tests updated for assignee data; new test files for assignee filtering, delta detection, and avatar rendering.

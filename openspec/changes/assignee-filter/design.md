## Context

The extension currently polls a GitHub Projects v2 board via GraphQL, detects deltas, and uses `AgentService.selectNextIssue()` to pick the next issue for the AI agent. The `PrioritizerItem` interface carries `id`, `projectItemId`, `title`, `status`, `labels`, `body`, `owner`, and `repo` — but no assignee data. The `CONTENT_FRAGMENT` in the GraphQL query does not request assignees.

When multiple team members share a board, pressing Start could spawn an agent on any issue in an AI-eligible column, regardless of who is assigned. This change threads assignee data through the entire pipeline and filters selection to the current user only.

## Goals / Non-Goals

**Goals:**
- Agent selects only issues assigned to the current user (strict filter, no fallback)
- Clear popup messages when no issues are assigned
- Detect assignee changes between polls (`item_assigned` delta event)
- Display assignee avatar circles on kanban cards

**Non-Goals:**
- Queue system for assigned issues
- Fallback to unassigned issues when nothing is assigned
- Configurable assignee filter (always strict)
- Webhook-based real-time assignee detection (polling only)

## Decisions

### 1. Fetch assignees via `Issue.assignees` in CONTENT_FRAGMENT
**Why**: The GitHub GraphQL schema provides `assignees(first: N): UserConnection!` on both `Issue` and `PullRequest` types, returning `nodes { login, avatarUrl }`. This is the standard way to get assignee data. Adding it to `CONTENT_FRAGMENT` ensures both issues and PRs carry assignee info.

**Alternative considered**: Fetch assignees separately per issue — rejected because it would require N+1 queries per poll cycle.

### 2. Store current user login in AgentService via `setCurrentUser()`
**Why**: The `LIST_PROJECTS_QUERY` already returns `viewer.login`. The extension calls this during init. Storing the login in `AgentService` keeps the filter logic co-located with the prioritizer.

**Alternative considered**: Pass login as param to `selectNextIssue()` — rejected because the user doesn't change during a session; storing it is simpler and avoids threading through callers.

### 3. Filter in `selectNextIssue()` before bug/WIP logic
**Why**: The assignee filter is the first gate. Only issues assigned to the current user enter the prioritizer pipeline. Bug priority and WIP checks run after.

```
All items → Filter: AI columns → Filter: assigned to me → Bug check → WIP check → Select
```

### 4. New `item_assigned` delta event type
**Why**: Assignee changes are meaningful events. When someone assigns an issue to you, the system should detect it. This enables future auto-trigger on assignment (out of scope now).

**Alternative considered**: Include assignee changes in `item_updated` — rejected because assignee changes are semantically different from title/label changes and deserve their own event type.

### 5. Avatar circles via GitHub's `avatarUrl`
**Why**: GitHub provides `avatarUrl` directly on the User type. No additional API call needed. The webview renders these as small circles (24x24px) on each card.

**Alternative considered**: Use GitHub's avatar API endpoint (`https://avatars.githubusercontent.com/u/{id}`) — unnecessary since `avatarUrl` is already in the GraphQL response.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Issue has no assignees — user can't work anything | Clear popup message: "No issues assigned to you" |
| GraphQL query size increases with assignee data | Limited to `first: 5` assignees; avatarUrl is a string URL, not inline image |
| Existing tests break due to new `assignees` field | All tests updated to include empty assignee arrays where needed |
| PR assignees vs Issue assignees type mismatch | Both use same `UserConnection` type in GraphQL; handled uniformly |

## Migration Plan

No migration needed. This is a feature addition with no breaking changes to existing APIs. The `assignees` field is optional in all interfaces (defaults to empty array).

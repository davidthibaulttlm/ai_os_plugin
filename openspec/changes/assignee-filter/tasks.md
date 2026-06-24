## 1. GraphQL Query — Add Assignee Data

- [ ] 1.1 Add `assignees(first: 5) { nodes { login, avatarUrl } }` to `CONTENT_FRAGMENT` in `src/services/graphql.queries.ts` for both Issue and PullRequest content types
- [ ] 1.2 Update `IssueContent` interface in `src/services/graphql.queries.ts` to include `assignees: { nodes: { login: string; avatarUrl: string }[] }`
- [ ] 1.3 Update `IssueContent` interface in `src/types/github.ts` to include assignees field

## 2. Delta Detection — Track Assignee Changes

- [ ] 2.1 Add `assignees: { login: string }[]` field to `BoardItemState` interface in `src/services/delta.ts`
- [ ] 2.2 Add `item_assigned` to `DeltaEventType` union in `src/services/delta.ts`
- [ ] 2.3 Implement assignee change detection in `detectDeltas()` — compare assignee lists and emit `item_assigned` events
- [ ] 2.4 Extract assignees from `ProjectItemNode` in `detectDeltas()` (same logic as `extractLabels`)
- [ ] 2.5 Create test file `src/test/services/delta.detectDeltas.item_assigned.test.ts`

## 3. Poller — Thread Assignees Through Pipeline

- [ ] 3.1 Update `updateState()` in `src/services/poller.ts` to include assignees in `BoardItemState`
- [ ] 3.2 Update `feedBoardState()` in `src/services/poller.ts` to include assignees in `PrioritizerItem`
- [ ] 3.3 Create test file `src/test/services/poller.feedBoardState.assignees.test.ts`

## 4. Agent Service — Assignee Filter & Current User

- [ ] 4.1 Add `assignees: { login: string; avatarUrl: string }[]` field to `PrioritizerItem` interface in `src/services/agent.ts`
- [ ] 4.2 Add `currentUser` private field and `setCurrentUser(login: string)` method to `AgentService`
- [ ] 4.3 Add assignee filter at start of `selectNextIssue()` — filter to items where `assignees` includes `currentUser`
- [ ] 4.4 Update `finishAgent()` to detect "no assigned issues" state and return reason for popup
- [ ] 4.5 Create test file `src/test/services/agent.setCurrentUser.test.ts`
- [ ] 4.6 Create test file `src/test/services/agent.selectNextIssue.assigneeFilter.test.ts`
- [ ] 4.7 Update existing test file `src/test/services/agent.selectNextIssue.test.ts` to include assignee data
- [ ] 4.8 Update existing test file `src/test/services/agent.startAgent.test.ts` to include assignee data

## 5. Extension — Command Handler & Popup Messages

- [ ] 5.1 Call `agentService.setCurrentUser(viewerLogin)` in `initServices()` in `src/extension.ts` after fetching projects
- [ ] 5.2 Update `registerStartAgentCommand()` to show "No issues assigned to you" warning when reason is `empty` and user has no assigned issues
- [ ] 5.3 Add new reason `no_assigned_issues` to `startAgent()` return type for distinct popup messaging
- [ ] 5.4 Show "No more work available" popup in `finishAgent()` auto-trigger flow when no assigned issues remain
- [ ] 5.5 Update existing test file `src/test/commands/startAgent.test.ts` for new popup messages

## 6. Webview — Assignee Avatar Circles

- [ ] 6.1 Add `assignees: { login: string; avatarUrl: string }[]` prop to `IssueCard` component in `webview-ui/src/components/IssueCard.tsx`
- [ ] 6.2 Render avatar circles (24x24px, rounded-full) for each assignee in `IssueCard`
- [ ] 6.3 Pass assignees from board data to `IssueCard` via `KanbanColumn` and `KanbanBoard` components
- [ ] 6.4 Update `IssueCard.stories.tsx` with assignee examples
- [ ] 6.5 Add CSS for avatar circle overflow (flex row, gap-1, -ml-1 overlap effect)

## 7. Integration Tests

- [ ] 7.1 Update `src/test/integration/startAgent.integration.test.ts` to test assignee-filtered flow
- [ ] 7.2 Run full test suite (`npx vitest run`) and verify 90%+ coverage on changed files
- [ ] 7.3 Run TypeScript check (`npx tsc --noEmit`) and verify no errors

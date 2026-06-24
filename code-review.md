# Code Review — openspec/changes/assignee-filter implementation

**Verdict:** 🔴 Block

**Scope:** files · focus: full review against assignee-filter, assignee-delta, and assignee-avatars specs · 2026-06-24T20:57:00Z

The assignee-filter change threads assignee data through the full pipeline (GraphQL query, delta detection, poller, agent service, webview) and implements the core assignee-only selection filter. The GraphQL query, data types, and avatar rendering are solid. However, there are two correctness gaps that block merging: (1) the critical assignee filter in selectNextIssue() has no dedicated unit tests — existing tests bypass the filter entirely by omitting currentUser, and (2) finishAgent() does not trigger the required 'no more work available' popup when no assigned issues remain. Additionally, the command test simulation is missing the no_assigned_issues handler, and the delta detection drops concurrent non-assignee events.

## Summary

| Severity | Count |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 2 |
| 🟡 Medium | 4 |
| 🔵 Low | 3 |
| ⚪ Info | 1 |

| Dimension | Status | Findings |
|---|---|---|
| Correctness & Logic | reviewed | 6 |
| Architecture & Design | reviewed | 3 |
| Performance & Scalability | reviewed | 1 |
| Security (OWASP Top 10:2025) | reviewed | 0 |
| Dependency CVEs | not-reviewed | 0 |

**Dependency CVE scan:** `none` — partial / best-effort · 0 packages checked

> No new third-party dependencies introduced by this change. Existing lockfile (package-lock.json) unchanged. No scanner available in current environment.

## Findings

### Correctness & Logic

#### [CR-001] Assignee filter in selectNextIssue() has no dedicated unit tests
`🟠 High` · confidence: high · **blocker**

**Location:** `src/services/agent.ts:144–152`

The core feature — filtering board items to only those assigned to the current user — is exercised by zero test cases. All existing tests in agent.selectNextIssue.test.ts and agent.startAgent.test.ts pass items with assignees: [] and never call setCurrentUser(). Because the filter at agent.ts:144-152 is guarded by `if (this.currentUser)`, the filter body is never entered during tests. This means the primary requirement of the assignee-filter spec is completely untested. If the filter logic regresses (e.g., wrong comparison, off-by-one), no test will catch it.

```
    if (this.currentUser) {
      const before = eligible.length;
      eligible = eligible.filter(
        (item) => item.assignees?.some((a) => a.login === this.currentUser)
      );
      logger.info(`[AgentService.selectNextIssue] Filtered ${before} -> ${eligible.length} items assigned to ${this.currentUser}`);
    } else {
      logger.warn('[AgentService.selectNextIssue] No currentUser set — skipping assignee filter');
    }
```

**Fix:** Create src/test/services/agent.selectNextIssue.assigneeFilter.test.ts with cases: (a) user assigned to one issue — returns that issue, (b) user assigned to none — returns null, (c) mixed assignees — returns only user's issues, (d) unassigned issue never selected. Each test must call agent.setCurrentUser('alice') before setBoardState().

**References:** openspec/changes/assignee-filter/specs/assignee-filter/spec.md, openspec/changes/assignee-filter/tasks.md task 4.6

#### [CR-002] finishAgent() does not show 'no more work available' popup per spec
`🟠 High` · confidence: high · **blocker**

**Location:** `src/services/agent.ts:316–318`

Spec requirement (assignee-filter/spec.md, lines 44-53): 'When the agent finishes work and no assigned issues remain, the extension SHALL display a popup informing the user.' The current finishAgent() at agent.ts:290-319 logs 'No next issue available' but does not return a reason or trigger any popup. The popup logic lives in the command handler (extension.ts:129-156), but finishAgent() calls startAgent() internally — there is no path back to the command handler to display the message. The spec explicitly requires this popup for the auto-trigger flow after agent completion.

```
    } else {
      logger.info('[AgentService.finishAgent] No next issue available');
    }
```

**Fix:** Have finishAgent() return a result indicating whether no assigned issues remain, and have the caller (claudeSpawner or claudeTrigger callback chain) display the popup. Alternatively, add a vscode.window.showInformationMessage call directly in finishAgent() when next is null and currentUser is set. Update tasks.md task 5.4 accordingly.

**References:** openspec/changes/assignee-filter/specs/assignee-filter/spec.md lines 44-53, openspec/changes/assignee-filter/tasks.md task 5.4

#### [CR-003] Test simulation in startAgent.test.ts missing no_assigned_issues handler
`🟡 Medium` · confidence: high · **should-fix**

**Location:** `src/test/commands/startAgent.test.ts:35–63`

The simulateHandleStartAgent() function in src/test/commands/startAgent.test.ts:35-63 handles reasons: busy, empty, auto_move_failed — but not no_assigned_issues. The actual command handler in extension.ts:142-143 handles it with showWarningMessage. This means the test simulation diverges from production behavior. If someone refactors the popup messages, the test won't catch the regression for this specific reason.

```
    } else if (result.reason === 'empty') {
      vscode.window.showInformationMessage('No issues available for AI agent');
    } else if (result.reason === 'auto_move_failed') {
```

**Fix:** Add an else-if branch for result.reason === 'no_assigned_issues' in simulateHandleStartAgent() that calls vscode.window.showWarningMessage with the expected message. Add a test case that sets currentUser, provides no assigned issues, and verifies the warning message.

**References:** src/extension.ts:142-143

#### [CR-004] Delta detection masks concurrent non-assignee events
`🟡 Medium` · confidence: high · **should-fix**

**Location:** `src/services/delta.ts:48–80`

In detectDeltas() at delta.ts:48-80, the if-else chain means only ONE event type is emitted per item per poll. If an item's status AND assignees change simultaneously, only the status change (item_moved) is emitted — the assignee change is silently dropped. Similarly, if assignees AND labels change, only item_assigned fires and the label change is lost. This is a design trade-off but means the system under-reports changes during complex edits.

```
    } else if (last.status !== status) {
      // Status changed (item moved)
      ...
    } else if (JSON.stringify(last.assignees.map((a) => a.login).sort()) !== JSON.stringify(assignees.map((a) => a.login).sort())) {
      // Assignees changed
      ...
    } else if (last.title !== title || JSON.stringify(last.labels.sort()) !== JSON.stringify(labels.sort())) {
```

**Fix:** Either (a) emit multiple events per item by replacing the if-else chain with independent if checks, or (b) document this as intentional in the delta.ts header and accept it as a known limitation. Option (a) is preferred for completeness.

**References:** openspec/changes/assignee-filter/specs/assignee-delta/spec.md

#### [CR-005] IssueCard stories missing assignee avatar example
`🟡 Medium` · confidence: high · **should-fix**

**Location:** `webview-ui/src/components/IssueCard.stories.tsx:37–47`

Task 6.4 in tasks.md requires updating IssueCard.stories.tsx with assignee examples. The current file (171 lines) has no story that includes assignees data. The baseItem at line 37-47 has no assignees field. Without a Storybook story showing the avatar circles, there is no visual regression test for the avatar rendering.

**Fix:** Add a story (e.g., export const WithAssignees) that includes assignees: [{ login: 'alice', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4' }, { login: 'bob', avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4' }] to verify the avatar circle rendering in Storybook.

**References:** openspec/changes/assignee-filter/tasks.md task 6.4

#### [LOW-001] Integration test registerStartAgentCommand missing no_assigned_issues handler
`🔵 Low` · confidence: high · **nit**

**Location:** `src/test/integration/startAgent.integration.test.ts:58–88`

src/test/integration/startAgent.integration.test.ts:58-88 duplicates the command handler but also lacks the no_assigned_issues branch. Same issue as CR-003 but in the integration test file.

**Fix:** Add the no_assigned_issues handler to the integration test's registerStartAgentCommand, mirroring extension.ts:142-143.

**References:** src/extension.ts:142-143

### Architecture & Design

#### [ARCH-001] finishAgent() void return prevents caller from reacting to empty state
`🟡 Medium` · confidence: high · **should-fix**

**Location:** `src/services/agent.ts:290`

finishAgent() returns Promise<void>, but the caller (claudeSpawner triggerCallback) needs to know whether there are no more assigned issues to display the popup. Currently the popup logic only exists in the command handler (extension.ts), but finishAgent() is called from the agent completion callback chain — a different code path that never reaches the command handler. This architectural gap means the 'no more work' popup can never actually fire.

```
  public async finishAgent(issueId: string): Promise<void> {
```

**Fix:** Change finishAgent() to return Promise<{ reason?: 'no_assigned_issues' | 'none' }> so the caller can branch on the result. Or add an onIdle callback to AgentService that fires when no work remains.

**References:** src/services/agent.ts:290-319, openspec/changes/assignee-filter/tasks.md task 5.4

#### [LOW-002] Avatar URL not validated before rendering in IssueCard
`🔵 Low` · confidence: high · **nit**

**Location:** `webview-ui/src/components/IssueCard.tsx:96–102`

IssueCard.tsx:98 renders src={assignee.avatarUrl} directly. GitHub's GraphQL API returns trusted avatar URLs (avatars.githubusercontent.com), so this is not a security risk in practice. However, if the data source ever changes or test data includes malformed URLs, the img tag will fail silently.

```
            <img
              key={assignee.login}
              src={assignee.avatarUrl}
              alt={assignee.login}
              title={assignee.login}
              className="w-6 h-6 rounded-full border border-vscode-editor-background"
            />
```

**Fix:** Add a fallback: onError={() => imgRef.current.src = '/default-avatar.png'} or validate the URL starts with https://avatars.githubusercontent.com. Low priority given the data source is GitHub's own API.

#### [PRAISE-001] Clean thread of assignee data through entire pipeline
`⚪ Info` · confidence: high · **praise**

**Location:** `src/services/graphql.queries.ts:19–21`

The assignee data flows cleanly from CONTENT_FRAGMENT through IssueContent/PullRequestContent types, extractAssignees(), BoardItemState, PrioritizerItem, and into the webview IssueCard. Each layer has proper TypeScript typing. The GraphQL fragment approach (Decision 1 in design.md) correctly avoids N+1 queries. The avatarUrl passthrough (Decision 5) eliminates a separate API call. Well-architected data flow.

**Fix:** None — this is a positive pattern.

**References:** openspec/changes/assignee-filter/design.md

### Performance & Scalability

#### [PERF-001] JSON.stringify for assignee comparison is O(n log n) per item per poll
`🔵 Low` · confidence: medium · **consider**

**Location:** `src/services/delta.ts:64`

delta.ts:64 uses JSON.stringify(last.assignees.map(a => a.login).sort()) for comparison. For boards with many items, this allocates sorted arrays and serializes them on every poll. With first:5 assignees and typical board sizes (50-200 items), this is negligible — but the pattern is fragile if assignee limits increase.

```
    } else if (JSON.stringify(last.assignees.map((a) => a.login).sort()) !== JSON.stringify(assignees.map((a) => a.login).sort())) {
```

**Fix:** Consider a Set-based comparison: new Set(last.assignees.map(a => a.login)).size === new Set(assignees.map(a => a.login)).size && every member matches. Or pre-sort during state extraction. Not urgent given current scale.

### Security (OWASP Top 10:2025)

_Clean — Clean — avatarUrl from GitHub CDN is safe; no innerHTML; IPC validation intact._

### Dependency CVEs

_Not reviewed — No CVE scanner available in environment; no new dependencies introduced by this change._

## Action list

- **[blocker]** [CR-001] Assignee filter in selectNextIssue() has no dedicated unit tests (`src/services/agent.ts:144–152`)
- **[blocker]** [CR-002] finishAgent() does not show 'no more work available' popup per spec (`src/services/agent.ts:316–318`)
- **[should-fix]** [ARCH-001] finishAgent() void return prevents caller from reacting to empty state (`src/services/agent.ts:290`)
- **[should-fix]** [CR-003] Test simulation in startAgent.test.ts missing no_assigned_issues handler (`src/test/commands/startAgent.test.ts:35–63`)
- **[should-fix]** [CR-004] Delta detection masks concurrent non-assignee events (`src/services/delta.ts:48–80`)
- **[should-fix]** [CR-005] IssueCard stories missing assignee avatar example (`webview-ui/src/components/IssueCard.stories.tsx:37–47`)
- **[consider]** [PERF-001] JSON.stringify for assignee comparison is O(n log n) per item per poll (`src/services/delta.ts:64`)

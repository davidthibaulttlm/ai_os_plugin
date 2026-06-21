## 1. Ensure Label Data Available in Poll Results

- [x] 1.1 Verify GraphQL query includes label data in project item responses (check `CONTENT_FRAGMENT` in `src/services/graphql.queries.ts`)
- [x] 1.2 Extend `ProjectItemNode` type in `src/services/graphql.ts` to include labels field if missing
- [x] 1.3 Update `BoardItemState` in `src/services/delta.ts` to include labels array
- [x] 1.4 Extract labels from `item.content.labels.nodes` in `detectDeltas()` and pass through to `BoardItemState`
- [x] 1.5 Update `BoardState` type in `src/services/stateBridge.ts` to include labels per issue

## 1.5 Update AI-Eligible Columns Constant

- [x] 1.5.1 Rename `AI_TRIGGER_COLUMNS` to `AI_ELIGIBLE_COLUMNS` in `src/services/agent.ts`
- [x] 1.5.2 Add `BRAIN_DUMP` to the set: `['AI_SPEC', 'AI_CODE', 'BRAIN_DUMP']`
- [x] 1.5.3 Update all references to the renamed constant across codebase

## 2. Implement Core Prioritizer Logic

- [x] 2.1 Add column priority order constant to `src/services/agent.ts`: `['AI_CODE', 'AI_SPEC', 'BRAIN_DUMP']`
- [x] 2.2 Add human-only column filter constant: columns containing "HUMAN" or "PR_DONE" are excluded
- [x] 2.3 Implement `selectNextIssue(boardItems)` method that scans columns in priority order and returns top card from first non-empty column
- [x] 2.4 Implement `previewNextIssue(boardItems)` method that returns candidate without side effects

## 3. Implement Bug Detection

- [x] 3.1 Implement `isBug(issue)` helper that checks if any label contains "bug" (case-insensitive)
- [x] 3.2 Implement `findBugInColumns(boardItems, columns)` that scans specified columns for bug-labeled issues
- [x] 3.3 Integrate bug scan into `selectNextIssue()` — scan all AI-eligible columns for bugs before normal priority scan

## 4. Implement WIP Tracking

- [x] 4.1 Add `currentWip` property to `AgentService` tracking the issue ID currently being worked on
- [x] 4.2 Add `isBusy()` method that returns whether an agent is currently active
- [x] 4.3 Add `setWip(issueId)` and `clearWip()` methods for lifecycle management
- [x] 4.4 Integrate WIP check into `selectNextIssue()` — refuse non-bug selection when busy

## 5. Implement Auto-Move from BRAIN_DUMP

- [x] 5.1 Add `moveToColumn(issueId, fromColumn, toColumn)` method in `AgentService` that calls `UPDATE_ITEM_FIELD_MUTATION` (UpdateProjectV2ItemFieldValueInput) to update the Status field
- [x] 5.2 Resolve target option ID for AI_SPEC status by reverse-lookup from column mapping stored in Memento (same mapping poller uses for GitHub option ID → column name)
- [x] 5.3 Integrate auto-move into `selectNextIssue()` — when selected issue is in BRAIN_DUMP, move to AI_SPEC before returning
- [x] 5.4 Handle move failure: log error, notify user, return null candidate

## 6. Implement Start Agent Command

- [x] 6.1 Create `src/commands/startAgent.ts` with VS Code command registration
- [x] 6.2 Wire command to call `AgentService.selectNextIssue()` and launch agent for selected issue
- [x] 6.3 Add success notification showing selected issue number and title
- [x] 6.4 Add busy notification when WIP limit reached with no bugs
- [x] 6.5 Add empty notification when no AI-eligible issues exist
- [x] 6.6 Register command in `src/extension.ts`

## 7. Integrate with Existing Agent Trigger

- [x] 7.1 Update `onAgentTrigger()` to use prioritizer instead of direct trigger
- [x] 7.2 Ensure `cancelAgent()` calls `clearWip()` to release WIP slot
- [x] 7.3 Ensure agent completion calls `clearWip()` to release WIP slot

## 8. Update Poller and State Bridge

- [x] 8.1 Ensure poller passes label data through to board state
- [x] 8.2 Update `BoardState` type in `src/services/stateBridge.ts` to include labels per issue

## 9. Mandatory Logging (Per AGENTS.md Rules)

> **EVERY method in EVERY file MUST log with `logger` from `src/services/logger.ts`.**
> Log at START, log PARAMETERS, log RESULTS, log ERRORS. NEVER use `console.log`.

- [x] 9.1 `src/services/agent.ts` — Add `import { logger }` and log start/params/result/error in: `selectNextIssue()`, `previewNextIssue()`, `isBug()`, `findBugInColumns()`, `isBusy()`, `setWip()`, `clearWip()`, `moveToColumn()`
- [x] 9.2 `src/commands/startAgent.ts` — Add `import { logger }` and log start/params/result/error in command handler
- [x] 9.3 `src/services/delta.ts` — Add logging to `extractStatus()` and any new label extraction methods
- [x] 9.4 `src/services/stateBridge.ts` — Add logging to any modified methods that handle label data
- [x] 9.5 Verify NO `console.log` exists in any new or modified file (use `logger` exclusively)

## 10. Setup Vitest for Extension Host Unit Tests

- [x] 10.1 Add Vitest devDependencies: `vitest`, `@vitest/coverage-v8`, `@types/node`
- [x] 10.2 Create `vitest.config.ts` with coverage thresholds (`global: 90`) and exclude patterns (`node_modules`, `dist`, `webview-ui`)
- [x] 10.3 Add test script to root `package.json`: `"test": "vitest run --coverage"`
- [x] 10.4 Create `src/test/mocks/vscode.ts` — mock module for `vscode` API (window, commands, workspace, Memento)

## 11. Write Unit Tests for Agent Service

- [x] 11.1 `src/test/services/agent.test.ts` — Test `selectNextIssue()` with all column priority order combinations
- [x] 11.2 `src/test/services/agent.test.ts` — Test `isBug()` with label variations: "bug", "Bug", "BUG", "type/bug", no bug
- [x] 11.3 `src/test/services/agent.test.ts` — Test `findBugInColumns()` scanning multiple columns
- [x] 11.4 `src/test/services/agent.test.ts` — Test WIP tracking: `isBusy()`, `setWip()`, `clearWip()`
- [x] 11.5 `src/test/services/agent.test.ts` — Test WIP enforcement: refuse non-bug when busy, allow bug when busy
- [x] 11.6 `src/test/services/agent.test.ts` — Test `previewNextIssue()` returns candidate without side effects
- [x] 11.7 `src/test/services/agent.test.ts` — Test `moveToColumn()` calls GraphQL mutation with correct input
- [x] 11.8 `src/test/services/agent.test.ts` — Test auto-move failure handling (mutation throws → error logged, null returned)
- [x] 11.9 `src/test/services/agent.test.ts` — Test human column exclusion (HUMAN_SPEC_REVIEW, HUMAN_CODE_REVIEW, PR_DONE never selected)

## 12. Write Unit Tests for Delta Detection

- [x] 12.1 `src/test/services/delta.test.ts` — Test label extraction from `item.content.labels.nodes`
- [x] 12.2 `src/test/services/delta.test.ts` — Test `detectDeltas()` includes labels in `BoardItemState`
- [x] 12.3 `src/test/services/delta.test.ts` — Test delta detection with items that have/have not labels

## 13. Write Unit Tests for Start Agent Command

- [x] 13.1 `src/test/commands/startAgent.test.ts` — Test command calls `selectNextIssue()` and launches agent
- [x] 13.2 `src/test/commands/startAgent.test.ts` — Test success notification with issue number and title
- [x] 13.3 `src/test/commands/startAgent.test.ts` — Test busy notification when WIP limit reached
- [x] 13.4 `src/test/commands/startAgent.test.ts` — Test empty notification when no AI-eligible issues

## 14. Storybook Isolated Component Tests (Webview)

- [x] 14.1 Update `IssueCard.stories.tsx` — Add story with bug label badge visible
- [x] 14.2 Update `IssueCard.stories.tsx` — Add story with priority indicator (top card in column)
- [x] 14.3 Update `KanbanColumn.stories.tsx` — Add story showing items in correct priority order
- [x] 14.4 Update `Header.stories.tsx` — Add story with "Agent Busy" indicator when WIP active
- [x] 14.5 Add interaction test in `IssueCard.stories.tsx` — click "Assign Agent" dispatches correct IPC message
- [x] 14.6 Run `cd webview-ui && npx storybook test` and verify all stories pass

## 15. Integration Tests (VS Code Test Electron)

- [x] 15.1 Create `src/test/integration/startAgent.integration.test.ts` — Test full command flow in VS Code Electron
- [x] 15.2 Verify command registration: `vscode.commands.executeCommand('aiOs.startAgent')` executes without error
- [x] 15.3 Verify notification appears in VS Code window after command execution

## 16. Coverage Verification

- [x] 16.1 Run `npx vitest run --coverage` and verify ≥90% coverage on all new/modified files
- [ ] 16.2 Add coverage report to CI pipeline (if applicable)
- [x] 16.3 Verify no uncovered branches in prioritizer logic, bug detection, WIP tracking, auto-move

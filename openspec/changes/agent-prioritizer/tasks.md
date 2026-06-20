## 1. Ensure Label Data Available in Poll Results

- [ ] 1.1 Verify GraphQL query includes label data in project item responses (check `CONTENT_FRAGMENT` in `src/services/graphql.queries.ts`)
- [ ] 1.2 Extend `ProjectItemNode` type in `src/services/graphql.ts` to include labels field if missing
- [ ] 1.3 Update `BoardItemState` in `src/services/delta.ts` to include labels array

## 2. Implement Core Prioritizer Logic

- [ ] 2.1 Add column priority order constant to `src/services/agent.ts`: `['AI_CODE', 'AI_SPEC', 'BRAIN_DUMP']`
- [ ] 2.2 Add human-only column filter constant: columns containing "HUMAN" or "PR_DONE" are excluded
- [ ] 2.3 Implement `selectNextIssue(boardItems)` method that scans columns in priority order and returns top card from first non-empty column
- [ ] 2.4 Implement `previewNextIssue(boardItems)` method that returns candidate without side effects

## 3. Implement Bug Detection

- [ ] 3.1 Implement `isBug(issue)` helper that checks if any label contains "bug" (case-insensitive)
- [ ] 3.2 Implement `findBugInColumns(boardItems, columns)` that scans specified columns for bug-labeled issues
- [ ] 3.3 Integrate bug scan into `selectNextIssue()` — scan all AI-eligible columns for bugs before normal priority scan

## 4. Implement WIP Tracking

- [ ] 4.1 Add `currentWip` property to `AgentService` tracking the issue ID currently being worked on
- [ ] 4.2 Add `isBusy()` method that returns whether an agent is currently active
- [ ] 4.3 Add `setWip(issueId)` and `clearWip()` methods for lifecycle management
- [ ] 4.4 Integrate WIP check into `selectNextIssue()` — refuse non-bug selection when busy

## 5. Implement Auto-Move from BRAIN_DUMP

- [ ] 5.1 Add `moveToColumn(issueId, fromColumn, toColumn)` method in `AgentService` that calls GraphQL mutation
- [ ] 5.2 Integrate auto-move into `selectNextIssue()` — when selected issue is in BRAIN_DUMP, move to AI_SPEC before returning
- [ ] 5.3 Handle move failure: log error, notify user, return null candidate

## 6. Implement Start Agent Command

- [ ] 6.1 Create `src/commands/startAgent.ts` with VS Code command registration
- [ ] 6.2 Wire command to call `AgentService.selectNextIssue()` and launch agent for selected issue
- [ ] 6.3 Add success notification showing selected issue number and title
- [ ] 6.4 Add busy notification when WIP limit reached with no bugs
- [ ] 6.5 Add empty notification when no AI-eligible issues exist
- [ ] 6.6 Register command in `src/extension.ts`

## 7. Integrate with Existing Agent Trigger

- [ ] 7.1 Update `onAgentTrigger()` to use prioritizer instead of direct trigger
- [ ] 7.2 Ensure `cancelAgent()` calls `clearWip()` to release WIP slot
- [ ] 7.3 Ensure agent completion calls `clearWip()` to release WIP slot

## 8. Update Poller and State Bridge

- [ ] 8.1 Ensure poller passes label data through to board state
- [ ] 8.2 Update `BoardState` type in `src/services/stateBridge.ts` to include labels per issue

## 9. Mandatory Logging (Per AGENTS.md Rules)

> **EVERY method in EVERY file MUST log with `logger` from `src/services/logger.ts`.**
> Log at START, log PARAMETERS, log RESULTS, log ERRORS. NEVER use `console.log`.

- [ ] 9.1 `src/services/agent.ts` — Add `import { logger }` and log start/params/result/error in: `selectNextIssue()`, `previewNextIssue()`, `isBug()`, `findBugInColumns()`, `isBusy()`, `setWip()`, `clearWip()`, `moveToColumn()`
- [ ] 9.2 `src/commands/startAgent.ts` — Add `import { logger }` and log start/params/result/error in command handler
- [ ] 9.3 `src/services/delta.ts` — Add logging to `extractStatus()` and any new label extraction methods
- [ ] 9.4 `src/services/stateBridge.ts` — Add logging to any modified methods that handle label data
- [ ] 9.5 Verify NO `console.log` exists in any new or modified file (use `logger` exclusively)

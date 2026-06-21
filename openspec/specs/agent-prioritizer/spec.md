## ADDED Requirements

### Dependency: Label data in board state
The prioritizer requires label data on each board item for bug detection. `BoardItemState` MUST include a `labels` field (array of label name strings). The GraphQL query already fetches labels via `CONTENT_FRAGMENT` — the delta detection layer (`src/services/delta.ts`) and state bridge (`src/services/stateBridge.ts`) MUST propagate this data through to the in-memory board state.

### Dependency: AI-eligible columns constant
The `AI_TRIGGER_COLUMNS` constant in `src/services/agent.ts` currently only includes `['AI_SPEC', 'AI_CODE']`. It MUST be updated to include `BRAIN_DUMP` as an AI-eligible column (since the prioritizer scans it and auto-moves to AI_SPEC). Rename to `AI_ELIGIBLE_COLUMNS` to reflect broader scope.

### Implementation Note: Auto-move GraphQL mutation
The auto-move from BRAIN_DUMP to AI_SPEC uses the existing `UPDATE_ITEM_FIELD_MUTATION` (`UpdateProjectV2ItemFieldValueInput`) to update the Status field on the project item. The target option ID for "AI_SPEC" status is resolved from the column mapping stored in VS Code Memento (same mapping used by the poller to resolve GitHub option IDs → column names). Reverse lookup: find the option ID whose mapped name is `AI_SPEC`.

### Requirement: Prioritizer scans columns in correct priority order
The agent prioritizer SHALL scan AI-eligible columns in the following order: AI_CODE first, then AI_SPEC, then BRAIN_DUMP. The first non-empty column determines the candidate pool.

#### Scenario: AI_CODE has issues
- **WHEN** AI_CODE column contains one or more issues and AI_SPEC is empty
- **THEN** the prioritizer selects the top issue from AI_CODE

#### Scenario: AI_CODE empty, AI_SPEC has issues
- **WHEN** AI_CODE column is empty and AI_SPEC contains one or more issues
- **THEN** the prioritizer selects the top issue from AI_SPEC

#### Scenario: AI_CODE and AI_SPEC empty, BRAIN_DUMP has issues
- **WHEN** AI_CODE and AI_SPEC columns are empty and BRAIN_DUMP contains one or more issues
- **THEN** the prioritizer selects the top issue from BRAIN_DUMP

### Requirement: Prioritizer picks top card within column
The agent prioritizer SHALL select the first (topmost) issue in the selected column. Card position within a column represents user-defined priority.

#### Scenario: Multiple issues in target column
- **WHEN** AI_SPEC contains 3 issues positioned as [#30, #3, #15] from top to bottom
- **THEN** the prioritizer selects issue #30

### Requirement: Prioritizer skips human-only columns
The agent prioritizer SHALL NEVER select an issue from columns containing "HUMAN" in the name (HUMAN_SPEC_REVIEW, HUMAN_CODE_REVIEW) or PR_DONE.

#### Scenario: Only human columns have issues
- **WHEN** AI_CODE, AI_SPEC, and BRAIN_DUMP are all empty but HUMAN_SPEC_REVIEW contains issues
- **THEN** the prioritizer returns no candidate and notifies the user that no work is available

#### Scenario: Bug in human column is ignored
- **WHEN** an issue with a bug label exists only in HUMAN_SPEC_REVIEW
- **THEN** the prioritizer does not select it

### Requirement: Bug label issues break column priority order
The agent prioritizer SHALL scan ALL AI-eligible columns for issues with a GitHub `bug` label. If a bug is found, it SHALL be selected regardless of column position or normal priority order.

#### Scenario: Bug at bottom of BRAIN_DUMP
- **WHEN** BRAIN_DUMP contains 9 issues and the last one has a `bug` label, and AI_SPEC has 2 non-bug issues
- **THEN** the prioritizer selects the bug issue from BRAIN_DUMP

#### Scenario: Bug in AI_CODE overrides AI_SPEC
- **WHEN** AI_SPEC has 3 issues and AI_CODE has 1 issue with a `bug` label
- **THEN** the prioritizer selects the bug issue from AI_CODE

#### Scenario: Multiple bugs in different columns
- **WHEN** a bug exists in both AI_SPEC and BRAIN_DUMP
- **THEN** the prioritizer selects the bug from the higher-priority column (AI_SPEC over BRAIN_DUMP per column priority order)

### Requirement: Bug detection uses GitHub labels
The agent prioritizer SHALL detect bug issues by checking if any GitHub label on the issue contains the text "bug" (case-insensitive).

#### Scenario: Label named "bug"
- **WHEN** an issue has a label named "bug"
- **THEN** the issue is detected as a bug

#### Scenario: Label named "Bug" or "BUG"
- **WHEN** an issue has a label named "Bug" or "BUG"
- **THEN** the issue is detected as a bug (case-insensitive match)

#### Scenario: Label named "type/bug"
- **WHEN** an issue has a label named "type/bug"
- **THEN** the issue is detected as a bug (contains "bug")

### Requirement: WIP limit prevents concurrent agents
The agent prioritizer SHALL enforce a WIP limit of 1. If an agent is already working on an issue, the prioritizer SHALL refuse to start another unless a bug is detected.

#### Scenario: Agent already working, no bugs
- **WHEN** an agent is actively working on issue #30 and the user triggers the prioritizer
- **THEN** the prioritizer returns a busy state and does not start a new agent

#### Scenario: Agent working but bug detected
- **WHEN** an agent is actively working on issue #30 and a new bug issue enters an AI-eligible column
- **THEN** the prioritizer selects the bug issue and allows concurrent execution (WIP limit bypassed for bugs)

### Requirement: Auto-move from BRAIN_DUMP to AI_SPEC
When the prioritizer selects an issue from BRAIN_DUMP, it SHALL automatically move the issue to AI_SPEC via GraphQL mutation before triggering the agent.

#### Scenario: Selected issue is in BRAIN_DUMP
- **WHEN** the prioritizer selects the top issue from BRAIN_DUMP
- **THEN** the issue is moved to AI_SPEC via GraphQL mutation, and the agent is triggered for that issue in AI_SPEC

#### Scenario: Auto-move fails
- **WHEN** the GraphQL mutation to move the issue fails
- **THEN** the prioritizer logs the error, notifies the user, and does not trigger the agent

#### Scenario: Selected issue already in AI_SPEC or AI_CODE
- **WHEN** the prioritizer selects an issue already in AI_SPEC or AI_CODE
- **THEN** no move is performed and the agent is triggered directly

### Requirement: Prioritizer provides next issue preview
The agent prioritizer SHALL expose a method to preview which issue would be selected next without triggering the agent.

#### Scenario: Preview when issues available
- **WHEN** the user requests a preview and AI-eligible columns contain issues
- **THEN** the prioritizer returns the issue number, title, and column without triggering the agent

#### Scenario: Preview when no issues available
- **WHEN** the user requests a preview and all AI-eligible columns are empty
- **THEN** the prioritizer returns a message indicating no work is available

### Requirement: Start Agent command triggers prioritizer
The extension SHALL provide a VS Code command "AI OS: Start Agent" that runs the prioritizer and launches the AI agent for the selected issue.

#### Scenario: Command succeeds
- **WHEN** the user runs "AI OS: Start Agent" and a valid issue is selected
- **THEN** the extension shows a notification with the selected issue and launches the agent

#### Scenario: Command when no work available
- **WHEN** the user runs "AI OS: Start Agent" and no AI-eligible issues exist
- **THEN** the extension shows a notification: "No issues available for AI agent"

#### Scenario: Command when agent busy
- **WHEN** the user runs "AI OS: Start Agent" and an agent is already working with no bugs pending
- **THEN** the extension shows a notification: "Agent is busy working on #[issue]"

---

## Testing Strategy

### Target: 90% code coverage across all new and modified files

### Layer 1: Unit Tests — Vitest (Extension Host Services)

**Framework**: Vitest with `@vitest/coverage-v8`

**Why Vitest over Jest:**
- Vite ecosystem alignment (webview already uses Vite 5)
- Native TypeScript support — no `ts-jest` config needed
- `vi.mock()` provides precise module-level mocking for `vscode` API
- Faster execution (native ESM, no Babel transform)
- Microsoft's official guidance recommends Jest manual mocks or abstraction wrappers — Vitest's `vi.mock` is the modern equivalent

**Mocking the `vscode` API:**
- Use `vi.mock('vscode', () => ({ window: { showInformationMessage: vi.fn() }, ... }))` per test file
- Mock `Memento` (`context.globalState`) as a plain `Map`-backed object
- Mock `GraphQLClient` with `vi.fn()` spies for mutation/query verification

**Test files:**
- `src/test/services/agent.test.ts` — prioritizer logic, WIP tracking, bug detection, auto-move
- `src/test/services/delta.test.ts` — label extraction, delta detection with labels
- `src/test/commands/startAgent.test.ts` — command handler with mocked vscode notifications

**Coverage target**: 90% branches + lines on all new/modified service files

### Layer 2: Storybook Isolated Component Testing (Webview)

**Framework**: Storybook 10 + `@storybook/test` (already installed in `webview-ui/package.json`)

**What to test in isolation:**
- `IssueCard` — render with bug label badge, render with priority indicator
- `KanbanColumn` — render with items in correct order, drag-and-drop within column
- `Header` — display "Agent Busy" indicator when WIP active

**Interaction tests with `@storybook/test`:**
- Use `userEvent` from `@storybook/test` to simulate clicks on "Start Agent" button
- Verify IPC message dispatch via mocked `vscodeApi.postMessage`

**Coverage**: All new component props and visual states covered by stories

### Layer 3: Integration Tests — VS Code Test Electron

**Framework**: `@vscode/test-electron` (official VS Code extension testing)

**Scope:**
- End-to-end flow: command registered → prioritizer runs → agent triggered
- Verify `vscode.commands.executeCommand('aiOs.startAgent')` fires correct notification

**Run via**: `npx vscode-test` or existing `src/test/runTest.ts` pattern with `--coverage` flag

### Test Execution Commands

```bash
# Extension host unit tests (Vitest)
npx vitest run --coverage

# Webview Storybook tests
cd webview-ui && npx storybook test

# Integration tests (VS Code Electron)
npx vscode-test
```

### Coverage Enforcement

- Add `coverage.thresholds.global = 90` to Vitest config
- CI gate: `npx vitest run --coverage --coverage.reporter=text-summary` must pass

## MODIFIED Requirements (from send-issue-content-to-claude)

### Requirement: PrioritizerItem structure
The `PrioritizerItem` interface SHALL include an optional `body` field of type `string`. The interface MUST support items with and without body content.

#### Scenario: Item with body
- **WHEN** a `PrioritizerItem` is created from a GraphQL issue that has a body
- **THEN** the item includes `body` with the issue description text

#### Scenario: Item without body
- **WHEN** a `PrioritizerItem` is created from a GraphQL item with no body
- **THEN** the `body` field is `undefined` and the item is valid

### Requirement: Agent trigger callback signature
The `AgentTriggerCallback` type SHALL accept parameters: `issueId: string`, `columnName: string`, `title?: string`, `body?: string`. Implementations MUST pass the title and body from board state when invoking the callback.

#### Scenario: Callback invoked with body and title
- **WHEN** `startAgent()` invokes the callback for an issue with a body and title
- **THEN** the callback receives `(issueId, columnName, title, body)` with all values

#### Scenario: Callback invoked without body
- **WHEN** `startAgent()` invokes the callback for an issue without a body
- **THEN** the callback receives `(issueId, columnName, title, undefined)`

### Requirement: startAgent passes title and body to callback
The `startAgent()` method SHALL extract the title and body from the selected `PrioritizerItem` and pass them to the callback.

#### Scenario: startAgent passes title and body
- **WHEN** `startAgent()` selects an issue that has a body and title in board state
- **THEN** the callback is invoked with the title and body text

### Requirement: onAgentTrigger passes title and body to callback
The `onAgentTrigger()` method SHALL look up the title and body from board state and pass them to the callback.

#### Scenario: onAgentTrigger passes title and body
- **WHEN** `onAgentTrigger()` is called for an issue that exists in board state with a body
- **THEN** the callback is invoked with the title and body text

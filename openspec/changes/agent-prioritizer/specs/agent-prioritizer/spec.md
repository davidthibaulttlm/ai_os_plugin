## ADDED Requirements

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

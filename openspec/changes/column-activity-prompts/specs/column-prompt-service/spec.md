## ADDED Requirements

### Requirement: ColumnPromptService provides system prompts for AI columns
The `ColumnPromptService` SHALL provide a system prompt for each AI-eligible column (`AI_SPEC`, `AI_CODE`). The system prompt defines the AI agent's role, expertise, and behavioral constraints for the column's activity.

#### Scenario: Get system prompt for AI_SPEC
- **WHEN** `getSystemPrompt('AI_SPEC')` is called with no user override
- **THEN** the default system prompt for specification writing is returned

#### Scenario: Get system prompt for AI_CODE
- **WHEN** `getSystemPrompt('AI_CODE')` is called with no user override
- **THEN** the default system prompt for code implementation is returned

#### Scenario: Get system prompt for human column
- **WHEN** `getSystemPrompt('HUMAN_SPEC_REVIEW')` is called
- **THEN** an empty string is returned

### Requirement: ColumnPromptService provides developer prompts for AI columns
The `ColumnPromptService` SHALL provide a developer prompt for each AI-eligible column. The developer prompt provides additional context, project conventions, and output format requirements.

#### Scenario: Get developer prompt for AI_SPEC
- **WHEN** `getDeveloperPrompt('AI_SPEC')` is called with no user override
- **THEN** the default developer prompt with spec template sections is returned

#### Scenario: Get developer prompt for AI_CODE
- **WHEN** `getDeveloperPrompt('AI_CODE')` is called with no user override
- **THEN** the default developer prompt with implementation rules is returned

#### Scenario: Get developer prompt for human column
- **WHEN** `getDeveloperPrompt('HUMAN_CODE_REVIEW')` is called
- **THEN** an empty string is returned

### Requirement: User overrides default prompts via Memento
The `ColumnPromptService` SHALL check VS Code `context.globalState` (Memento) for user-defined prompt overrides under keys `columnPrompts.<columnName>.system` and `columnPrompts.<columnName>.developer`. When a Memento key is configured, it SHALL replace the default prompt.

#### Scenario: User overrides AI_SPEC system prompt
- **WHEN** Memento key `columnPrompts.AI_SPEC.system` is set to a custom string
- **THEN** `getSystemPrompt('AI_SPEC')` returns the custom string instead of the default

#### Scenario: User overrides AI_CODE developer prompt
- **WHEN** Memento key `columnPrompts.AI_CODE.developer` is set to a custom string
- **THEN** `getDeveloperPrompt('AI_CODE')` returns the custom string instead of the default

#### Scenario: Memento key not configured falls back to default
- **WHEN** Memento key `columnPrompts.AI_SPEC.system` is not set
- **THEN** `getSystemPrompt('AI_SPEC')` returns the default system prompt

### Requirement: Save prompt persists to Memento
The `ColumnPromptService` SHALL provide `savePrompt(column: string, type: 'system' | 'developer', value: string): void` to persist a prompt override to Memento. Empty string SHALL clear the override (restore default on next read).

#### Scenario: Save system prompt override
- **WHEN** `savePrompt('AI_SPEC', 'system', 'Custom prompt text')` is called
- **THEN** Memento key `columnPrompts.AI_SPEC.system` is set to 'Custom prompt text'

#### Scenario: Save empty string clears override
- **WHEN** `savePrompt('AI_SPEC', 'system', '')` is called
- **THEN** Memento key `columnPrompts.AI_SPEC.system` is deleted and next `getSystemPrompt('AI_SPEC')` returns default

#### Scenario: Save validates column name
- **WHEN** `savePrompt('UNKNOWN_COLUMN', 'system', 'text')` is called
- **THEN** a warning is logged and no Memento write occurs

### Requirement: Reset prompt clears Memento override
The `ColumnPromptService` SHALL provide `resetPrompt(column: string, type: 'system' | 'developer'): void` to clear the Memento override, restoring the default prompt on next read.

#### Scenario: Reset system prompt
- **WHEN** `resetPrompt('AI_SPEC', 'system')` is called
- **THEN** Memento key `columnPrompts.AI_SPEC.system` is deleted and next `getSystemPrompt('AI_SPEC')` returns default

### Requirement: No truncation of issue body content
The `ColumnPromptService` SHALL NEVER truncate issue body content. The complete issue body SHALL be sent to the agent regardless of length. Claude models support large context windows — truncation loses critical information and produces incomplete work.

#### Scenario: Large issue body preserved
- **WHEN** `assemblePromptChain('AI_SPEC', '<50000 char issue body>')` is called
- **THEN** the full 50000-character body is included in the prompt chain without truncation

#### Scenario: Empty issue body handled
- **WHEN** `assemblePromptChain('AI_SPEC', '')` is called
- **THEN** the prompt chain includes system and developer prompts with empty user content section

### Requirement: Prompt chain assembly
The `ColumnPromptService` SHALL provide a method to assemble the full prompt chain for a given column: system prompt, developer prompt, and user content, separated by double newlines.

#### Scenario: Assemble prompt chain for AI_SPEC
- **WHEN** `assemblePromptChain('AI_SPEC', 'Issue body content...')` is called
- **THEN** the result is `[system_prompt]\n\n[developer_prompt]\n\n[issue_body_content]`

#### Scenario: Assemble prompt chain for human column
- **WHEN** `assemblePromptChain('HUMAN_SPEC_REVIEW', 'Issue body content...')` is called
- **THEN** the result is just the issue body content (no system or developer prompts prepended)

### Requirement: Known columns validation
The `ColumnPromptService` SHALL validate that the requested column name is one of the known kanban columns. Unknown columns SHALL return empty prompts and log a warning.

#### Scenario: Unknown column name
- **WHEN** `getSystemPrompt('UNKNOWN_COLUMN')` is called
- **THEN** an empty string is returned and a warning is logged

#### Scenario: Valid column names accepted
- **WHEN** `getSystemPrompt('AI_SPEC')` or `getSystemPrompt('AI_CODE')` is called
- **THEN** the appropriate prompt is returned without warning

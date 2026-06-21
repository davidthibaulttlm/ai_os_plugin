## MODIFIED Requirements

### Requirement: ClaudeHarness builds prompt using ColumnPromptService
The `ClaudeHarness.buildPrompt()` method SHALL use `ColumnPromptService` to obtain the system prompt and developer prompt for the issue's column, then assemble the full prompt chain with the issue content as the user message. The method SHALL replace the current hardcoded inline instructions.

#### Scenario: Build prompt for AI_SPEC issue
- **WHEN** `buildPrompt()` is called with an issue in the `AI_SPEC` column
- **THEN** the prompt includes the AI_SPEC system prompt, AI_SPEC developer prompt, and issue content assembled in order

#### Scenario: Build prompt for AI_CODE issue
- **WHEN** `buildPrompt()` is called with an issue in the `AI_CODE` column
- **THEN** the prompt includes the AI_CODE system prompt, AI_CODE developer prompt, and issue content assembled in order

#### Scenario: Build prompt preserves issue metadata
- **WHEN** `buildPrompt()` is called with issue title, body, labels, and repository
- **THEN** all metadata is included in the user content section of the prompt chain

### Requirement: ClaudeTrigger builds prompt using ColumnPromptService
The `ClaudeTrigger.buildPrompt()` method SHALL use `ColumnPromptService` to obtain the system prompt and developer prompt for the trigger event's column, then assemble the full prompt chain. The method SHALL replace the current hardcoded inline instructions.

#### Scenario: Build prompt for trigger event in AI_SPEC
- **WHEN** `buildPrompt()` is called with a trigger event in `AI_SPEC` column
- **THEN** the prompt includes the AI_SPEC system prompt, AI_SPEC developer prompt, and issue content

#### Scenario: Build prompt for trigger event in AI_CODE
- **WHEN** `buildPrompt()` is called with a trigger event in `AI_CODE` column
- **THEN** the prompt includes the AI_CODE system prompt, AI_CODE developer prompt, and issue content

## ADDED Requirements

### Requirement: Prompt service injected into harness and trigger via constructor
The `ClaudeHarness` and `ClaudeTrigger` classes SHALL accept a `ColumnPromptService` instance via their constructor. The prompt service SHALL be used for all prompt building operations.

#### Scenario: Harness receives prompt service via constructor
- **WHEN** `ClaudeHarness` is constructed with a `ColumnPromptService` instance
- **THEN** it stores the instance and uses it in `buildPrompt()`

#### Scenario: Trigger receives prompt service via constructor
- **WHEN** `ClaudeTrigger` is constructed with a `ColumnPromptService` instance
- **THEN** it stores the instance and uses it in `buildPrompt()`

### Requirement: Issue body never truncated
The `ClaudeHarness.buildPrompt()` and `ClaudeTrigger.buildPrompt()` SHALL include the complete issue body without truncation. Claude models support 200K+ token context windows — truncation loses critical information.

#### Scenario: Large issue body preserved in harness
- **WHEN** `buildPrompt()` is called with a 50000-character issue body
- **THEN** the full body is included in the prompt chain without truncation

#### Scenario: Large issue body preserved in trigger
- **WHEN** `buildPrompt()` is called with a 50000-character issue body
- **THEN** the full body is included in the prompt chain without truncation

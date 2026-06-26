## MODIFIED Requirements

### Requirement: AI-eligible columns include BRAIN_DUMP with prompt support
The `AI_ELIGIBLE_COLUMNS` constant in `src/services/agent.ts` SHALL include `BRAIN_DUMP` as an AI-eligible column. When an agent is triggered for a `BRAIN_DUMP` issue, the prompt assembly SHALL include a default ideation-focused system prompt and developer prompt.

#### Scenario: BRAIN_DUMP issue triggers agent with ideation prompt
- **WHEN** the prioritizer selects an issue from BRAIN_DUMP and triggers the agent
- **THEN** the assembled prompt includes a system prompt describing an ideation role and a developer prompt with structured output instructions

#### Scenario: BRAIN_DUMP prompt uses CLAUDE.md when available
- **WHEN** the prioritizer triggers an agent for a BRAIN_DUMP issue in a repo with `CLAUDE.md`
- **THEN** the prompt uses a minimal column role instruction (not the full default prompts), relying on CLAUDE.md for project context

#### Scenario: BRAIN_DUMP prompt falls back to defaults when no context file
- **WHEN** the prioritizer triggers an agent for a BRAIN_DUMP issue in a repo without `CLAUDE.md` or `AGENTS.md`
- **THEN** the prompt uses the full default system + developer prompts for BRAIN_DUMP

## ADDED Requirements

### Requirement: BRAIN_DUMP column has default prompts
The system SHALL provide default system and developer prompts for the `BRAIN_DUMP` column in `ColumnPromptService`.

#### Scenario: BRAIN_DUMP system prompt returned
- **WHEN** `getSystemPrompt('BRAIN_DUMP')` is called
- **THEN** the method returns a non-empty ideation-focused system prompt

#### Scenario: BRAIN_DUMP developer prompt returned
- **WHEN** `getDeveloperPrompt('BRAIN_DUMP')` is called
- **THEN** the method returns a non-empty developer prompt with structured output instructions

#### Scenario: BRAIN_DUMP included in AI_COLUMNS
- **WHEN** `AI_COLUMNS` constant is checked in `ColumnPromptService`
- **THEN** `BRAIN_DUMP` is included in the list of AI-eligible columns

### Requirement: Prompt assembly uses three-tier resolution
The system SHALL resolve prompts using a three-tier chain: CLAUDE.md (minimal prompt), AGENTS.md (minimal prompt with AGENTS.md as system context), or column defaults. AGENTS.md REPLACES column defaults — it does not supplement them.

#### Scenario: Repo has CLAUDE.md — minimal prompt
- **WHEN** `assemblePromptChain(column, userContent, owner, repo)` is called and the repo has `CLAUDE.md`
- **THEN** the returned prompt contains only the column role instruction and user content (no system/developer defaults)

#### Scenario: Repo has AGENTS.md but no CLAUDE.md — minimal prompt with AGENTS.md as system context
- **WHEN** `assemblePromptChain(column, userContent, owner, repo)` is called and the repo has `AGENTS.md` but not `CLAUDE.md`
- **THEN** the returned prompt contains AGENTS.md content (as system context) + column role instruction + user content (NO column default system/developer prompts)

#### Scenario: Repo has neither file — full prompt fallback
- **WHEN** `assemblePromptChain(column, userContent, owner, repo)` is called and the repo has neither `CLAUDE.md` nor `AGENTS.md`
- **THEN** the returned prompt contains the full system + developer + user content chain (existing behavior)

#### Scenario: No repo context provided — full prompt fallback
- **WHEN** `assemblePromptChain(column, userContent)` is called without `owner`/`repo` parameters
- **THEN** the returned prompt contains the full system + developer + user content chain (existing behavior)

#### Scenario: Empty CLAUDE.md falls through to AGENTS.md
- **WHEN** `assemblePromptChain(column, userContent, owner, repo)` is called and `CLAUDE.md` exists but is empty, and `AGENTS.md` exists with content
- **THEN** the returned prompt uses the AGENTS.md path (AGENTS.md as system context + minimal column prompt)

### Requirement: AGENTS.md content is truncated when too long
The system SHALL truncate AGENTS.md content to a maximum of 4000 characters when injecting into the prompt, appending a "[truncated]" notice.

#### Scenario: AGENTS.md within limit
- **WHEN** AGENTS.md content is under 4000 characters
- **THEN** the full content is injected without truncation

#### Scenario: AGENTS.md exceeds limit
- **WHEN** AGENTS.md content exceeds 4000 characters
- **THEN** the content is truncated to 4000 characters with "[truncated]" appended

### Requirement: ClaudeTrigger passes repo context to prompt assembly
The `TriggerEvent` interface SHALL include `owner` and `repo` fields. When `ClaudeTrigger.buildPrompt()` assembles a prompt, it SHALL pass these fields to `promptService.assemblePromptChain()`.

#### Scenario: TriggerEvent includes repo context
- **WHEN** `checkTrigger()` is called with a board item that has `owner` and `repo`
- **THEN** the `TriggerEvent` includes `owner` and `repo` fields

#### Scenario: ClaudeTrigger passes repo to prompt service
- **WHEN** `ClaudeTrigger.buildPrompt()` calls `assemblePromptChain()`
- **THEN** it passes `event.owner` and `event.repo` as parameters

#### Scenario: ClaudeTrigger works without repo context
- **WHEN** `ClaudeTrigger.buildPrompt()` is called with a `TriggerEvent` missing `owner`/`repo`
- **THEN** it falls back to full column prompts (existing behavior)

### Requirement: ClaudeHarness passes repo context to prompt assembly
The `ClaudeHarness.buildPrompt()` method SHALL pass `ctx.owner` and `ctx.repo` to `promptService.assemblePromptChain()`.

#### Scenario: Harness passes repo context
- **WHEN** `ClaudeHarness.buildPrompt(ctx)` is called with an `IssueContext` containing `owner` and `repo`
- **THEN** it passes `ctx.owner` and `ctx.repo` to `assemblePromptChain()`

### Requirement: Context file missing warning is throttled per repo
The system SHALL warn the user only once per repo about missing context files (both CLAUDE.md and AGENTS.md), not on every agent run.

#### Scenario: First agent run warns
- **WHEN** an agent starts for a repo without `CLAUDE.md` or `AGENTS.md` and no warning has been sent yet
- **THEN** a warning notification is sent to the webview

#### Scenario: Subsequent runs do not warn
- **WHEN** an agent starts for the same repo without context files after a warning was already sent
- **THEN** no additional warning notification is sent

#### Scenario: Warning reset when context file is created
- **WHEN** the user creates `CLAUDE.md` for a repo that previously triggered a warning
- **THEN** the warning state is cleared for that repo

## Why

Each kanban column represents a distinct activity (AI spec writing, AI coding, human review, etc.), but the agent currently uses hardcoded inline instructions that are the same for all columns. There's no way to configure per-column system prompts or developer prompts that define the AI agent's role, behavior, and constraints for each activity. This makes it impossible to tailor agent behavior to the specific work each column requires, and violates Claude API best practices which recommend separating system prompts (role/persona) from user content (task details).

## What Changes

- **New `ColumnPromptService`** — manages per-column system prompts and developer prompts. Stores default prompts for `AI_SPEC` and `AI_CODE` columns, and allows users to override them via VS Code settings or the column settings modal UI.
- **System prompt** — defines the AI agent's role, expertise, and behavioral constraints for the column's activity (e.g., "You are a senior software architect writing technical specifications").
- **Developer prompt** — provides additional context, project conventions, and output format requirements (e.g., "Follow our spec template with sections for Architecture, API Contracts, and Implementation Plan").
- **Human columns have NO prompts** — `BRAIN_DUMP`, `HUMAN_SPEC_REVIEW`, `HUMAN_CODE_REVIEW`, `PR_DONE` are human-only activities and explicitly have no system/developer prompts configured.
- **Prompt assembly in `ClaudeHarness.buildPrompt()`** — refactored to construct the full message chain: system prompt → developer prompt → user message (issue content). Follows Anthropic Messages API best practices.
- **Column settings modal** — click the cog icon (⚙️) at the top-right of each kanban column to open a modal with two textarea fields for editing the system prompt and developer prompt for that column. Human columns show a disabled state with "Human review column — no AI prompts" message.
- **Column header layout update** — item count moved from top-right corner to inline with the column title in parentheses (e.g., "AI SPEC (3)"). Cog icon replaces the count at the top-right position.
- **Settings persistence** — prompt overrides stored in VS Code `Memento` (`context.globalState`) under `columnPrompts.<columnName>.system` and `columnPrompts.<columnName>.developer`. Also available as VS Code settings (`aiOs.columnPrompts.*`).
- **Default prompts** — well-crafted default system and developer prompts for `AI_SPEC` (specification writing) and `AI_CODE` (code implementation) based on Anthropic prompt engineering best practices.

## Capabilities

### New Capabilities
- `column-prompt-service`: Service for managing per-column system and developer prompts. Handles loading defaults, reading user overrides from VS Code Memento/settings, and assembling prompt chains for the Claude API. Each AI column (`AI_SPEC`, `AI_CODE`) has its own system prompt and developer prompt. Human columns explicitly return empty prompts.
- `column-settings-modal`: Webview modal component for editing column prompts. Triggered by cog icon in column header. Two textarea fields (system prompt, developer prompt) with save/reset actions. Human columns show disabled state.

### Modified Capabilities
- `agent-prioritizer`: The `ClaudeHarness.buildPrompt()` method and `ClaudeTrigger.buildPrompt()` must be updated to consume prompts from `ColumnPromptService` instead of hardcoded strings. Prompt assembly must follow Anthropic's message structure: system → developer → user content.
- `kanban-webview`: `KanbanColumn` header layout updated — item count moved inline with title, cog icon added for settings. `KanbanBoard` manages modal state. New IPC messages for prompt CRUD.

## Impact

- **New files**:
  - `src/services/columnPrompt.ts` — ColumnPromptService class with default prompts and Memento persistence.
  - `webview-ui/src/components/ColumnSettingsModal.tsx` — Modal component for editing column prompts.
  - `webview-ui/src/components/ColumnSettingsModal.stories.tsx` — Storybook stories.
- **Modified files**:
  - `src/services/claudeHarness.ts` — `buildPrompt()` refactored to use ColumnPromptService for system/dev prompts.
  - `src/services/claudeTrigger.ts` — `buildPrompt()` refactored to use ColumnPromptService.
  - `webview-ui/src/components/KanbanColumn.tsx` — Header layout: count inline with title, cog icon triggers modal.
  - `webview-ui/src/components/KanbanBoard.tsx` — Modal state management and IPC bridge for saving prompts.
  - `webview-ui/src/store/boardStore.ts` — New action for column prompt data.
  - `src/types/ipc.ts` — New IPC message types for column prompt CRUD.
  - `src/providers/KanbanPanel.ts` — IPC handler for column prompt save/load.
  - `package.json` — new VS Code settings for column prompts.
- **Dependencies**: No new external dependencies.
- **Settings**: 4 new settings — `aiOs.columnPrompts.aiSpec.system`, `aiOs.columnPrompts.aiSpec.developer`, `aiOs.columnPrompts.aiCode.system`, `aiOs.columnPrompts.aiCode.developer`.

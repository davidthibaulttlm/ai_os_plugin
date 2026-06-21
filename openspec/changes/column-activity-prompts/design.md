## Context

Currently, `ClaudeHarness.buildPrompt()` and `ClaudeTrigger.buildPrompt()` hardcode inline instructions for each column. The prompt is a single flat string passed to `claude -p`. This has several problems:

1. **No separation of concerns** — role definition, behavioral constraints, and task content are all mixed in one string.
2. **Not configurable** — users cannot customize how the agent behaves for each column activity.
3. **Doesn't follow Anthropic best practices** — Anthropic's Messages API recommends using a `system` parameter for role/persona and structured messages for task content. While we use `claude -p` (CLI prompt mode), the same principles apply: system-level instructions should be separated from task-specific content.
4. **One-size-fits-all** — the same generic instructions are used regardless of whether the column is `AI_SPEC` (write a spec) or `AI_CODE` (implement code).

The fixed 6-column kanban template is: `BRAIN_DUMP` → `AI_SPEC` → `HUMAN_SPEC_REVIEW` → `AI_CODE` → `HUMAN_CODE_REVIEW` → `PR_DONE`. Only `AI_SPEC` and `AI_CODE` are AI-eligible columns that trigger agent work.

## Goals / Non-Goals

**Goals:**
- Provide per-column system prompts and developer prompts for AI-eligible columns (`AI_SPEC`, `AI_CODE`)
- Allow users to override default prompts via VS Code settings
- Follow Anthropic prompt engineering best practices (role setting in system prompt, structured context in developer prompt, task content in user message)
- Human columns explicitly return empty prompts — no accidental agent triggering
- Backward compatible — existing `claude -p` flow continues to work with assembled prompt chain

**Non-Goals:**
- Not supporting dynamic prompt generation via AI
- Not changing the column template (still fixed 6 columns)
- Not migrating from `claude -p` to Anthropic Messages API (that's a separate architectural change)

## Decisions

### D1: ColumnPromptService as a standalone service
**Decision**: Create `src/services/columnPrompt.ts` with a `ColumnPromptService` class.
**Rationale**: Centralizes prompt management logic. Easy to test in isolation. Single source of truth for default prompts and settings keys. Both `ClaudeHarness` and `ClaudeTrigger` depend on it.
**Alternatives considered**: Inline prompt strings in each consumer (rejected — duplicates logic), prompt factory function (rejected — doesn't encapsulate settings loading).

### D2: Memento is source of truth for prompt overrides
**Decision**: Store user overrides in VS Code `context.globalState` (Memento) under keys `columnPrompts.<columnName>.system` and `columnPrompts.<columnName>.developer`. Memento is the single source of truth — the `ColumnPromptService` reads from Memento only.
**Rationale**: Memento persists across VS Code sessions, is fast (in-memory access), and doesn't require the Configuration API overhead. VS Code settings (`aiOs.columnPrompts.*`) are registered in `package.json` as a secondary sync target for users who prefer editing via settings.json, but the service does NOT read from them — they are documentation-only for now.
**Memento keys**:
- `columnPrompts.AI_SPEC.system` — system prompt override for AI_SPEC column
- `columnPrompts.AI_SPEC.developer` — developer prompt override for AI_SPEC column
- `columnPrompts.AI_CODE.system` — system prompt override for AI_CODE column
- `columnPrompts.AI_CODE.developer` — developer prompt override for AI_CODE column

### D3: Prompt assembly order — system → developer → user content
**Decision**: Assemble the final prompt as: `[SYSTEM_PROMPT]\n\n[DEVELOPER_PROMPT]\n\n[USER_CONTENT]`.
**Rationale**: Follows Anthropic's recommended message structure. System prompt sets role/persona first, developer prompt adds project context, user content is the specific task. When passed to `claude -p`, this ordering ensures Claude processes instructions in the correct priority.
**Anthropic best practice reference**: "Setting a role in the system prompt focuses Claude's behavior and tone for your use case. Even a single sentence makes a difference."

### D4: Default prompts crafted for each column activity
**Decision**: Ship with well-crafted default prompts based on Anthropic prompt engineering best practices.

**AI_SPEC system prompt default**:
```
You are an expert software architect and technical writer. Your task is to write detailed technical specifications for software issues. You produce clear, actionable specs that a developer can implement from.
```

**AI_SPEC developer prompt default**:
```
Write a technical specification with these sections:
1. Overview — brief summary of the feature/fix
2. Architecture — high-level design decisions and approach
3. API Contracts — interfaces, endpoints, data models (if applicable)
4. Implementation Plan — step-by-step implementation order
5. Testing Strategy — how to verify the implementation

Follow the existing codebase conventions. Reference existing files and patterns. Keep the spec focused and actionable.
```

**AI_CODE system prompt default**:
```
You are a senior software engineer implementing code changes. You write clean, tested, production-ready code that follows the project's existing patterns and conventions.
```

**AI_CODE developer prompt default**:
```
Implement the code for this issue. Follow these rules:
1. Read the specification if one exists in the issue body
2. Follow existing code patterns, naming conventions, and architecture
3. Write tests for new functionality
4. Stage your changes with 'git add' when done
5. Do NOT commit — the harness will commit after you finish
6. Do NOT push — the harness will push after you finish
7. Keep changes minimal and scoped to the issue
8. Log all method entries with the project logger
```

### D5: Human columns return empty prompts
**Decision**: `getSystemPrompt('HUMAN_SPEC_REVIEW')` returns `''`. No prompts for human-only columns.
**Rationale**: Human columns are review gates — no AI agent should be triggered. Returning empty strings makes this explicit and prevents accidental agent invocation.

### D6: Column header layout — count inline, cog icon for settings
**Decision**: Move the item count from the top-right corner to inline with the column title in parentheses. Add a cog icon (⚙️) at the top-right position that opens the column settings modal.
**Before**: `<h3>AI SPEC</h3> <span>3</span>`
**After**: `<h3>AI SPEC (3)</h3> <button>⚙️</button>`
**Rationale**: The count is more naturally read next to the column name. The cog icon is a universal settings affordance. This frees up the top-right corner for the settings trigger.

### D7: Column settings modal — inline webview component
**Decision**: Create `ColumnSettingsModal.tsx` as an overlay modal within the webview. Two resizable textarea fields (system prompt, developer prompt), each with a rollback-to-defaults icon button. For human columns, show a disabled message instead of textareas.
**Rationale**: Keeps prompt editing contextual — users edit prompts from the column they relate to. No need to navigate to a separate settings panel. Modal is simpler than a full panel and matches the existing webview architecture.
**Textarea behavior**: Native HTML `<textarea>` elements with `resize: vertical` CSS, `min-height: 120px`, auto-grow as user types. Monospace font for prompt editing.
**Rollback icon**: Each textarea has a small ↩ (undo/rollback) icon button in the top-right corner of the textarea wrapper. Clicking it restores that specific prompt to its default value immediately (no save needed). This is a per-prompt rollback, not a global reset.
**Layout** (insta-save — no save button):
```
┌─────────────────────────────────────────────┐
│  Column Settings: AI SPEC              [X]  │
├─────────────────────────────────────────────┤
│  System Prompt (?)           [↩ default]    │
│  ┌─────────────────────────────────────────┐ │
│  │ You are an expert software architect... │ ↕│
│  │                                         │ │
│  └─────────────────────────────────────────┘ │
│  (auto-saved ✓)                              │
│                                               │
│  Developer Prompt (?)          [↩ default]   │
│  ┌─────────────────────────────────────────┐ │
│  │ Write a technical specification with... │ ↕│
│  │ 1. Overview — brief summary...          │ │
│  └─────────────────────────────────────────┘ │
│  (auto-saved ✓)                              │
│                                               │
│                              [Close]          │
└─────────────────────────────────────────────┘
```

**Hover tooltip for `?` icons:**
- **System Prompt (?)**: "Defines the AI agent's role and expertise for this column's activity. Example: 'You are a senior software architect writing technical specifications.'"
- **Developer Prompt (?)**: "Provides project conventions, output format requirements, and implementation rules. Example: 'Follow our spec template with sections for Architecture, API Contracts, and Implementation Plan.'"

### D8: Prompt persistence via Memento + IPC
**Decision**: Prompts stored in VS Code `context.globalState` (Memento). Webview sends `saveColumnPrompt` IPC message → extension host saves to Memento → ColumnPromptService reads from Memento on next prompt build.
**Rationale**: Memento is the standard VS Code persistence mechanism for extension state. Survives VS Code restarts. No file I/O needed. The ColumnPromptService reads from Memento (not VS Code settings) for faster access — settings are a secondary sync target.

## Risks / Trade-offs

### R1: Prompt injection via issue content
[Risk] Malicious issue body content could attempt to override system/developer prompts.
→ **Mitigation**: System and developer prompts are prepended BEFORE user content, so Claude processes them first. Anthropic's models are trained to respect system-level instructions. Issue body is NEVER truncated — complete content is sent.

### R2: Token budget for large prompts
[Risk] System + developer + user content may exceed Claude's context window for very large issues.
→ **Mitigation**: Claude models support 200K+ token context windows. System and developer prompts are ~200-400 tokens each. Issue body is NEVER truncated — even a 50K character body is well within Claude's context limits. No truncation anywhere in the prompt chain.

### R3: XSS in webview textareas
[Risk] User-entered prompt text could contain HTML/JS if rendered unsafely.
→ **Mitigation**: Textarea content is always rendered as `textContent` (React default for `<textarea value=...>`). Never using `dangerouslySetInnerHTML`.

### R3: Users write bad prompts
[Risk] Users may override default prompts with ineffective or harmful instructions.
→ **Mitigation**: Defaults are well-crafted. Users can always revert to defaults by clearing the setting. No validation on custom prompts — trust the user.

## Migration Plan

No migration needed. This is a new capability with backward-compatible defaults. Existing behavior is preserved when no settings overrides are configured — the default prompts produce similar output to the current hardcoded instructions.

## Open Questions

- Should we add a "reset to defaults" button in the settings panel? (Deferred to settings panel UI work)
- Should prompt templates support variables (e.g., `{{repoName}}`, `{{issueNumber}}`)? (Not needed for v1 — issue content already includes this context)

## Why

AI OS currently stores system and developer prompts per-column in VS Code Memento, meaning all repos in a project share the same AI instructions regardless of their tech stack. A frontend repo (React/TypeScript) and backend repo (Python/FastAPI) get identical prompts, which doesn't account for repo-specific conventions, rules, and skills. Additionally, the `BRAIN_DUMP` column has no prompt support despite being AI-eligible.

The solution is to use each repo's `CLAUDE.md` or `AGENTS.md` as the source of truth for project context. Claude Code reads `CLAUDE.md` automatically when spawned. For repos with `AGENTS.md` (VS Code agent projects), AI OS reads and injects the content into the prompt. AI OS sends a minimal task prompt (column role + issue details), letting the repo's context file provide the heavy lifting of project-specific rules.

## What Changes

- **New**: `RepoPromptService` — reads `CLAUDE.md` or `AGENTS.md` from each cloned repo's root, caches content in-memory, and provides it to prompt assembly
- **New**: `CLAUDE.md` / `AGENTS.md` existence check in `RepoManager` — reports which context file a repo has
- **New**: `CLAUDE.md` template creation — when a repo lacks both CLAUDE.md and AGENTS.md, AI OS offers to generate a CLAUDE.md template
- **Modified**: `ColumnPromptService.assemblePromptChain()` — accepts optional `owner`/`repo` parameters; if repo has CLAUDE.md, uses minimal column prompt; if repo has AGENTS.md, uses AGENTS.md as system context (replacing column defaults); otherwise falls back to existing Memento defaults
- **Modified**: `ClaudeHarness.buildPrompt()` — passes `owner/repo` to prompt service so it can resolve repo-specific context
- **Modified**: `ClaudeTrigger` — adds `owner`/`repo` fields to `TriggerEvent` for repo-aware prompt resolution
- **Modified**: `BRAIN_DUMP` added to `AI_COLUMNS` in `ColumnPromptService` with a default ideation prompt
- **Modified**: Webview `ColumnSettingsModal` — shows context file status per repo and offers to create missing files
- **Deprecation notice**: Per-column Memento prompts remain as fallback but are no longer the primary source of truth

## Capabilities

### New Capabilities
- `repo-prompt-service`: Service that reads CLAUDE.md from cloned repos, caches content, and provides repo-specific prompt context to the prompt assembly pipeline
- `claude-md-bootstrap`: Detects missing CLAUDE.md in cloned repos and offers to create a template file with project-appropriate defaults

### Modified Capabilities
- `agent-prioritizer`: BRAIN_DUMP column now has prompt support (default ideation prompt). Prompt assembly now considers repo context via CLAUDE.md
- `kanban-webview`: Column settings modal updated to show CLAUDE.md status per repo and provide create-file action

## Impact

- **Files affected**: `src/services/columnPrompt.ts`, `src/services/claudeHarness.ts`, `src/services/claudeTrigger.ts`, `src/services/repoManager.ts`, `src/types/ipc.ts`, `src/providers/KanbanPanel.helpers.ts`, `webview-ui/src/components/ColumnSettingsModal.tsx`
- **New files**: `src/services/repoPrompt.ts` (new service), template file for CLAUDE.md generation
- **No breaking changes**: Existing Memento prompt overrides continue to work as fallback when CLAUDE.md is absent
- **Backwards compatible**: Repos without CLAUDE.md behave exactly as before (use column-level defaults)

## 1. ColumnPromptService — New Service

- [x] 1.1 Create `src/services/columnPrompt.ts` with `ColumnPromptService` class
- [x] 1.2 Define `KNOWN_COLUMNS` constant: `['BRAIN_DUMP', 'AI_SPEC', 'HUMAN_SPEC_REVIEW', 'AI_CODE', 'HUMAN_CODE_REVIEW', 'PR_DONE']`
- [x] 1.3 Define `AI_COLUMNS` constant: `['AI_SPEC', 'AI_CODE']`
- [x] 1.4 Implement default system prompts for `AI_SPEC` and `AI_CODE` (see design.md D4)
- [x] 1.5 Implement default developer prompts for `AI_SPEC` and `AI_CODE` (see design.md D4)
- [x] 1.6 Implement `getSystemPrompt(column: string): string` — returns default or Memento override, empty for human columns
- [x] 1.7 Implement `getDeveloperPrompt(column: string): string` — returns default or Memento override, empty for human columns
- [x] 1.8 Implement `assemblePromptChain(column: string, userContent: string): string` — assembles `[system]\n\n[developer]\n\n[userContent]`
- [x] 1.9 Implement column validation — warn and return empty for unknown columns
- [x] 1.10 Constructor accepts `vscode.Memento` (from `context.globalState`) for prompt persistence
- [x] 1.11 Implement `savePrompt(column: string, type: 'system' | 'developer', value: string): void` — persists to Memento, empty string clears override
- [x] 1.12 Implement `resetPrompt(column: string, type: 'system' | 'developer'): void` — clears Memento override to restore default
- [x] 1.13 Read overrides from Memento keys: `columnPrompts.<columnName>.system`, `columnPrompts.<columnName>.developer`
- [x] 1.14 Implement `getDefaultSystemPrompt(column: string): string` and `getDefaultDeveloperPrompt(column: string): string` — returns hardcoded defaults (used by IPC to send defaults to webview)

## 2. IPC Messages — Prompt CRUD

- [x] 2.1 Add `saveColumnPrompt` to `WebviewToExtension` type in `src/types/ipc.ts`
- [x] 2.2 Add `resetColumnPrompt` to `WebviewToExtension` type in `src/types/ipc.ts`
- [x] 2.3 Add `requestColumnPrompts` to `WebviewToExtension` type in `src/types/ipc.ts`
- [x] 2.4 Add `columnPrompts` to `ExtensionToWebview` type in `src/types/ipc.ts`
- [x] 2.5 Add IPC handler in `src/providers/KanbanPanel.ts` for `saveColumnPrompt`
- [x] 2.6 Add IPC handler in `src/providers/KanbanPanel.ts` for `resetColumnPrompt`
- [x] 2.7 Add IPC handler in `src/providers/KanbanPanel.ts` for `requestColumnPrompts`

## 3. KanbanColumn — Header Layout Update

- [x] 3.1 Update `webview-ui/src/components/KanbanColumn.tsx` header: move item count inline with title in parentheses
- [x] 3.2 Add cog icon button (⚙️) at top-right of column header
- [x] 3.3 Add `onOpenSettings(columnName: string)` callback prop to `KanbanColumnProps`
- [x] 3.4 Wire cog icon click to call `onOpenSettings(column.name)`
- [x] 3.5 Style cog button: subtle hover effect, matches VS Code theme colors

## 4. ColumnSettingsModal — New Webview Component (Insta-Save)

- [x] 4.1 Create `webview-ui/src/components/ColumnSettingsModal.tsx`
- [x] 4.2 Modal overlay with dark semi-transparent background
- [x] 4.3 Modal header with column name display and close button (X)
- [x] 4.4 For AI columns: two resizable textarea fields (System Prompt, Developer Prompt) with labels
- [x] 4.5 Textarea styling: `resize: vertical`, `min-height: 120px`, monospace font, VS Code theme colors
- [x] 4.6 `?` help icon next to each prompt label — hover shows tooltip
- [x] 4.7 Per-prompt rollback icon (↩) button at top-right of each textarea wrapper
- [x] 4.8 Insta-save: each textarea dispatches `saveColumnPrompt` IPC on every change with 300ms debounce
- [x] 4.9 "Auto-saved ✓" indicator below each textarea
- [x] 4.10 For human columns: disabled message "Human review column — no AI prompts configured"
- [x] 4.11 Single "Close" button (no save — changes auto-persist)
- [x] 4.12 Close and overlay click close modal

## 5. KanbanBoard — Modal State Management

- [x] 5.1 Add `modalColumn` state to `KanbanBoard` component (`string | null`)
- [x] 5.2 Wire `onOpenSettings` callback from `KanbanBoard` to each `KanbanColumn`
- [x] 5.3 Render `ColumnSettingsModal` when `modalColumn` is not null
- [x] 5.4 Fetch current prompts for the selected column when modal opens
- [x] 5.5 Close modal after successful save

## 6. ClaudeHarness Integration

- [x] 6.1 Add `ColumnPromptService` dependency to `ClaudeHarness` constructor
- [x] 6.2 Refactor `buildPrompt(ctx: IssueContext): string` to use `ColumnPromptService.assemblePromptChain()`
- [x] 6.3 Preserve issue metadata formatting in user content section
- [x] 6.4 Remove hardcoded `columnInstructions` string from `buildPrompt()`
- [x] 6.5 Update `src/extension.ts` to pass `ColumnPromptService` instance to `ClaudeHarness` constructor

## 7. ClaudeTrigger Integration

- [x] 7.1 Add `ColumnPromptService` dependency to `ClaudeTrigger` constructor
- [x] 7.2 Refactor `buildPrompt(event: TriggerEvent): string` to use `ColumnPromptService.assemblePromptChain()`
- [x] 7.3 Preserve issue metadata formatting in user content section
- [x] 7.4 Remove hardcoded inline instructions from `buildPrompt()`
- [x] 7.5 Update `src/extension.ts` to pass `ColumnPromptService` instance to `ClaudeTrigger` constructor

## 8. VS Code Settings Registration

- [x] 8.1 Add `aiOs.columnPrompts.aiSpec.system` setting to `package.json`
- [x] 8.2 Add `aiOs.columnPrompts.aiSpec.developer` setting to `package.json`
- [x] 8.3 Add `aiOs.columnPrompts.aiCode.system` setting to `package.json`
- [x] 8.4 Add `aiOs.columnPrompts.aiCode.developer` setting to `package.json`
- [x] 8.5 Each setting type: `string`, multiline-friendly, with description explaining purpose

## 9. Mandatory Logging

- [x] 9.1 `src/services/columnPrompt.ts` — Logger in all methods
- [x] 9.2 `src/services/claudeHarness.ts` — Logging in `buildPrompt()`
- [x] 9.3 `src/services/claudeTrigger.ts` — Logging in `buildPrompt()`
- [x] 9.4 `src/providers/KanbanPanel.ts` — Log IPC handlers
- [x] 9.5 `webview-ui/src/components/ColumnSettingsModal.tsx` — Logger for open/save/reset/close
- [x] 9.6 `webview-ui/src/components/KanbanColumn.tsx` — Log cog icon click event

## 10. Tests

- [x] 10.1 `src/test/services/columnPrompt.getSystemPrompt.test.ts`
- [x] 10.2 `src/test/services/columnPrompt.getDeveloperPrompt.test.ts`
- [x] 10.3 `src/test/services/columnPrompt.assemblePromptChain.test.ts`
- [x] 10.4 `src/test/services/columnPrompt.savePrompt.test.ts`
- [x] 10.5 `src/test/services/columnPrompt.resetPrompt.test.ts`
- [x] 10.6 `src/test/services/columnPrompt.validateColumn.test.ts`
- [x] 10.7 `src/test/services/claudeHarness.buildPrompt-withPromptService.test.ts`
- [x] 10.8 `src/test/services/claudeTrigger.buildPrompt-withPromptService.test.ts`
- [x] 10.9 `webview-ui/src/components/ColumnSettingsModal.stories.tsx`
- [x] 10.10 `webview-ui/src/components/KanbanColumn.stories.tsx` — Updated stories
- [ ] 10.11 Integration test: full flow (deferred)
- [ ] 10.12 Run `npx vitest run --coverage` and verify ≥90% coverage (deferred)

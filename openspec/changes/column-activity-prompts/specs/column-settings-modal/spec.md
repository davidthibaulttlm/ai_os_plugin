## ADDED Requirements

### Requirement: Column header displays item count inline with title
The `KanbanColumn` component SHALL display the item count inline with the column title in parentheses, replacing the previous top-right count badge.

#### Scenario: Column with items
- **WHEN** a column named "AI_SPEC" has 3 items
- **THEN** the header displays "AI SPEC (3)"

#### Scenario: Column with no items
- **WHEN** a column named "BRAIN_DUMP" has 0 items
- **THEN** the header displays "BRAIN DUMP (0)"

### Requirement: Column header displays cog icon for settings
The `KanbanColumn` component SHALL display a cog icon (⚙️) at the top-right of the column header. Clicking the cog icon SHALL open the column settings modal.

#### Scenario: Cog icon visible
- **WHEN** the kanban board renders columns
- **THEN** each column header has a cog icon button at the top-right

#### Scenario: Click cog opens modal
- **WHEN** the user clicks the cog icon on a column
- **THEN** the column settings modal opens for that column

### Requirement: Column settings modal displays resizable textareas with help tooltips
The `ColumnSettingsModal` component SHALL display two resizable textarea fields: one for the system prompt and one for the developer prompt. Each label SHALL have a `?` help icon next to it. Hovering the `?` icon SHALL show a tooltip explaining what that prompt type is and how it's used. Each textarea SHALL be resizable vertically (CSS `resize: vertical`), have a minimum height of 120px, and use a monospace font. Each textarea SHALL be pre-populated with the current prompt value for the selected column. Prompt content SHALL be rendered as textContent only — never using `dangerouslySetInnerHTML` — to prevent XSS.

**System Prompt tooltip**: "Defines the AI agent's role and expertise for this column's activity. Example: 'You are a senior software architect writing technical specifications.'"

**Developer Prompt tooltip**: "Provides project conventions, output format requirements, and implementation rules. Example: 'Follow our spec template with sections for Architecture, API Contracts, and Implementation Plan.'"

#### Scenario: System prompt tooltip on hover
- **WHEN** the user hovers the `?` icon next to "System Prompt"
- **THEN** a tooltip appears explaining what the system prompt is and how it's used

#### Scenario: Developer prompt tooltip on hover
- **WHEN** the user hovers the `?` icon next to "Developer Prompt"
- **THEN** a tooltip appears explaining what the developer prompt is and how it's used

#### Scenario: Prompt content rendered safely
- **WHEN** a prompt contains HTML-like characters (`<script>alert('xss')</script>`)
- **THEN** the textarea displays the literal text, not rendered HTML

#### Scenario: AI_SPEC modal shows resizable textareas
- **WHEN** the user opens settings for the AI_SPEC column
- **THEN** the modal shows two resizable textareas with the current system prompt and developer prompt

#### Scenario: Textarea grows as user types
- **WHEN** the user types a long prompt in a textarea
- **THEN** the textarea expands vertically to accommodate the content

#### Scenario: Textarea uses monospace font
- **WHEN** the modal renders textareas
- **THEN** text is displayed in a monospace font for prompt editing

### Requirement: Per-prompt rollback to default icon
Each textarea SHALL have a rollback icon (↩) button positioned at the top-right corner of the textarea wrapper. Clicking the rollback icon SHALL immediately restore that specific prompt to its default value without requiring a save.

#### Scenario: Rollback system prompt to default
- **WHEN** the user clicks the ↩ icon next to the system prompt textarea
- **THEN** the system prompt textarea is immediately populated with the default system prompt for that column

#### Scenario: Rollback developer prompt to default
- **WHEN** the user clicks the ↩ icon next to the developer prompt textarea
- **THEN** the developer prompt textarea is immediately populated with the default developer prompt for that column

#### Scenario: Rollback does not affect the other prompt
- **WHEN** the user rolls back the system prompt
- **THEN** the developer prompt textarea content is unchanged

### Requirement: Human columns show disabled state in modal
The `ColumnSettingsModal` component SHALL display a disabled state for human-only columns (`BRAIN_DUMP`, `HUMAN_SPEC_REVIEW`, `HUMAN_CODE_REVIEW`, `PR_DONE`) with a message indicating no AI prompts are configured.

#### Scenario: HUMAN_SPEC_REVIEW modal disabled
- **WHEN** the user opens settings for the HUMAN_SPEC_REVIEW column
- **THEN** the modal displays "Human review column — no AI prompts configured" and no editable textareas

#### Scenario: PR_DONE modal disabled
- **WHEN** the user opens settings for the PR_DONE column
- **THEN** the modal displays "Human review column — no AI prompts configured" and no editable textareas

### Requirement: Insta-save — prompts auto-persist on every change
The `ColumnSettingsModal` SHALL use insta-save mode. Every keystroke in a textarea SHALL trigger an auto-save via IPC after a short debounce (300ms). There is NO save button — changes are persisted immediately. The `saveColumnPrompt` IPC message has shape `{ type: 'saveColumnPrompt'; data: { column: string; promptType: 'system' | 'developer'; value: string } }`. The extension host SHALL persist values to VS Code `context.globalState` (Memento).

#### Scenario: Typing auto-saves after debounce
- **WHEN** the user types in the system prompt textarea and stops for 300ms
- **THEN** a `saveColumnPrompt` IPC message is sent and the value is persisted to Memento

#### Scenario: No save button exists
- **WHEN** the modal renders
- **THEN** there is no "Save Changes" button — only Cancel and ↩ rollback icons

#### Scenario: Clearing textarea clears override
- **WHEN** the user clears a textarea (empty string) and the debounce fires
- **THEN** the Memento override is cleared (key deleted) and the default prompt is used on next load

#### Scenario: Rapid typing debounced
- **WHEN** the user types rapidly for 2 seconds
- **THEN** only one `saveColumnPrompt` IPC message is sent after the last keystroke + 300ms

### Requirement: Modal receives default prompts for rollback
When the modal opens, the webview SHALL receive both the current prompt values AND the default prompt values via the `columnPrompts` IPC message from the extension host. The message shape is `{ type: 'columnPrompts'; data: { column: string; system: string; developer: string; systemDefault: string; developerDefault: string } }`. Default values are used by the ↩ rollback icon.

#### Scenario: Modal receives defaults for AI_SPEC
- **WHEN** the user opens settings for AI_SPEC
- **THEN** the `columnPrompts` message includes `systemDefault` and `developerDefault` with the hardcoded default prompt strings

#### Scenario: Rollback uses default from message
- **WHEN** the user clicks ↩ on the system prompt textarea
- **THEN** the textarea is populated with the `systemDefault` value from the IPC message

### Requirement: Modal closes on cancel or overlay click
The `ColumnSettingsModal` SHALL close when the user clicks Cancel or clicks outside the modal overlay. Unsaved changes SHALL be discarded.

#### Scenario: Cancel discards changes
- **WHEN** the user edits prompts and clicks Cancel
- **THEN** the modal closes and no IPC message is sent

#### Scenario: Overlay click closes modal
- **WHEN** the user clicks the dark overlay behind the modal
- **THEN** the modal closes and unsaved changes are discarded

## 1. Remove All Useless Options — Config, Commands, Logic

- [ ] 1.1 Remove `autoWorkAssignments`, `autoWorkConfirmFirst`, `autoWorkMaxTurns`, `autoWorkAllowedTools` config properties from `package.json` `contributes.configuration.properties`
- [ ] 1.2 Remove commands `aiOs.toggleAutoWork`, `aiOs.toggleConfirmFirst`, `aiOs.enableAutoWork`, `aiOs.setMaxTurns`, `aiOs.setAllowedTools` from `package.json` `contributes.commands`
- [ ] 1.3 Remove all 5 command registrations from `src/extension.ts`
- [ ] 1.4 Update `src/services/claudeTrigger.ts` — remove `autoWorkEnabled` check, `confirmFirst` dialog, `maxTurns` read, `allowedTools` read. Always trigger with no restrictions.
- [ ] 1.5 Update `src/services/claudeHarness.ts` — remove `maxTurns`/`allowedTools` config reads. Remove `--max-turns` and `--allowed-tools` from CLI args array.
- [ ] 1.6 Update `src/services/claudeSpawner.ts` — remove `maxTurns` and `allowedTools` from options type. Remove `--max-turns` and `--allowedTools` from CLI args. Remove related logging.
- [ ] 1.7 Remove all 4 items (auto-work toggle, confirm-first toggle, max-turns input, allowed-tools input) from `_buildSettingsItems()` in `src/providers/BoardTreeProvider.ts`
- [ ] 1.8 Remove auto-work toggle, confirm-first checkbox, max-turns input, allowed-tools input from `src/providers/SettingsPanel.ts` webview HTML and JS handlers

## 2. Context Key Setup

- [ ] 2.1 Add `vscode.commands.executeCommand('setContext', 'aiOs.treeMode', 'boards')` in `src/extension.ts` during activation
- [ ] 2.2 Modify `BoardTreeProvider.setMode()` to call `vscode.commands.executeCommand('setContext', 'aiOs.treeMode', mode)` on mode change

## 3. Package.json Menu Redesign

- [ ] 3.1 Remove `aiOs.refreshBoard` from `menus.view/title` entries
- [ ] 3.2 Add `contributes.submenus` entry with `id: "aiOs.actions"`, `label: "AI OS Actions"`, `icon: "$(more)"`
- [ ] 3.3 Replace existing `view/title` menu entries with: pinned `aiOs.startAgent` + submenu reference `aiOs.actions`
- [ ] 3.4 Add `aiOs.actions` submenu items: `aiOs.fetchBoards`, `aiOs.openSettings` (with `when: "aiOs.treeMode == 'boards'"`), `aiOs.openSettings` (with `when: "aiOs.treeMode == 'settings'"`)
- [ ] 3.5 Register `aiOs.backToBoards` command with title `"Back to Boards"` and icon `$(list-selection)`

## 4. Settings Card Layout + Clone Repos Status

- [ ] 4.1 Refactor `_buildSettingsItems()` to return card-style sections: REPOSITORIES, CLAUDE INTEGRATION
- [ ] 4.2 Add section header items with `collapsibleState: CollapsibleState.None`, no command, `contextValue: 'sectionHeader'`
- [ ] 4.3 Add Clone Repos tree item with dynamic status badge: check `stateManager.getLastBoardId()` for board open state, check `repoManager` for clone status. Show `$(repo-cloned) Clone Repos` + `Cloned` when cloned, `$(repo) Clone Repos` + `Not cloned` when not cloned, `$(repo) Clone Repos` + `No board open` (no command) when no board
- [ ] 4.4 Wire Clone Repos item to `aiOs.cloneRepos` command when repos exist
- [ ] 4.5 Update action items: `$(cloud-upload) Connect to Claude Code`, `$(plug) Disconnect from Claude Code`
- [ ] 4.6 Remove the old `$(gear) AI OS Settings` redundant header item
- [ ] 4.7 Add spacer items between sections for visual separation

## 5. Extension Command Updates

- [ ] 5.1 Ensure `aiOs.openSettings` toggles mode correctly and triggers `setContext`
- [ ] 5.2 Register `aiOs.backToBoards` command in `src/extension.ts` (same toggle logic as `aiOs.openSettings`)

## 6. Verification

- [ ] 6.1 Test that the title bar shows only `▶` and `⋯` icons
- [ ] 6.2 Test that clicking `⋯` opens the submenu with Fetch Boards and the toggle entry
- [ ] 6.3 Test that switching between boards and settings modes changes the toggle entry label/icon
- [ ] 6.4 Test that settings pane shows 2 card sections (REPOSITORIES, CLAUDE INTEGRATION)
- [ ] 6.5 Test that Clone Repos shows "Cloned" badge when repos are cloned
- [ ] 6.6 Test that Clone Repos shows "Not cloned" badge when repos are not cloned
- [ ] 6.7 Test that Clone Repos shows "No board open" and is non-clickable when no board is open
- [ ] 6.8 Test that auto-work, confirm-first, max-turns, allowed-tools are all gone from settings
- [ ] 6.9 Test that Claude trigger fires without confirmation, no turn cap, no tool restrictions
- [ ] 6.10 Verify Claude Code CLI is spawned without `--max-turns` and `--allowed-tools` flags
- [ ] 6.11 Verify initial state (boards mode) shows "Open Settings" on extension load

## 7. Mandatory Logging

- [ ] 7.1 `src/providers/BoardTreeProvider.ts` — Add `import { logger } from '../services/logger';` and log start/params/result in `setMode()`, `refresh()`, `setLoading()`, `setBoards()`, `getChildren()`, `_buildSettingsItems()`
- [ ] 7.2 `src/services/claudeTrigger.ts` — Verify logging covers simplified trigger flow. Log when Claude is spawned.
- [ ] 7.3 `src/services/claudeHarness.ts` — Verify logging covers spawn without max-turns/allowed-tools. Log CLI args used.
- [ ] 7.4 `src/services/claudeSpawner.ts` — Verify logging covers spawn without max-turns/allowed-tools. Remove `maxTurns` from log messages.
- [ ] 7.5 `src/extension.ts` — Add `logger.info('[extension] Setting treeMode context key')`
- [ ] 7.6 Verify no `console.log` exists: `grep -rn "console\\.log" src/`

Every method MUST follow this pattern:
```typescript
import { logger } from '../services/logger';

public async someMethod(param1: string): Promise<Result> {
  logger.info('[ClassName.someMethod] Starting...');
  logger.info(`[ClassName.someMethod] param1=${param1}`);
  try {
    const result = /* ... */;
    logger.info(`[ClassName.someMethod] Result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.error(`[ClassName.someMethod] Error: ${(error as Error).message}`);
    throw error;
  }
}
```

Verification: `grep -rn "console\\.log" src/` must return zero results.

## 8. Tests

- [ ] 8.1 `src/test/providers/BoardTreeProvider.setMode.test.ts` — ONE FILE PER METHOD. Test `setMode()` calls `setContext` and fires refresh
- [ ] 8.2 `src/test/providers/BoardTreeProvider.buildSettingsItems.test.ts` — ONE FILE PER METHOD. Test `_buildSettingsItems()` returns card sections with Clone Repos status item
- [ ] 8.3 `src/test/services/claudeTrigger.alwaysAutoWork.test.ts` — ONE FILE PER METHOD. Test trigger fires unconditionally without config checks or confirmation
- [ ] 8.4 `src/test/services/claudeHarness.spawnWithoutRestrictions.test.ts` — ONE FILE PER METHOD. Test CLI args have no `--max-turns` or `--allowed-tools`
- [ ] 8.5 `src/test/services/claudeSpawner.spawnWithoutRestrictions.test.ts` — ONE FILE PER METHOD. Test options type and CLI args have no `maxTurns`/`allowedTools`
- [ ] 8.6 `src/test/extension.contextKey.test.ts` — Test activation sets `aiOs.treeMode` to `'boards'`
- [ ] 8.7 Run `npx vitest run --coverage` and verify ≥90% coverage on all new/modified files

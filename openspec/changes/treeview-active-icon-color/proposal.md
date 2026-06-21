## Why

The treeview has three UX problems:
1. **View-title menu is cramped** — 4 flat icons (`≡` `⚙` `↻` `▶`) with no visual indicator of the active pane mode. The refresh button is redundant (auto-polling at 30s).
2. **Settings pane is cluttered with useless options** — Auto-Work toggle, Confirm Before Work, Max Turns, Allowed Tools are all dead weight. Work should always be auto-assigned, never require confirmation, never be capped by turn limits, and agents should use all their tools freely.
3. **Settings pane is a flat, unstructured list** — no visual grouping, hard to scan. No visibility into whether repos are cloned.

## What Changes

- **Remove the "Refresh Board" button** from the view-title menu — auto-polling makes it redundant.
- **Replace the flat icon bar with a native VS Code submenu** — a single `⋯` (ellipsis) dropdown containing secondary actions. Primary action (Start Agent `▶`) stays pinned for one-click access.
- **Active mode icon reversal** — the settings/boards toggle entry in the submenu swaps icon + label depending on current mode.
- **Redesign settings pane as card-style sections** with visual grouping.
- **Add "Clone Repos" action with cloned status indicator** to the Repositories section — shows whether repos are cloned and lets the user trigger a clone/update with one click.
- **Remove all useless options entirely:**
  - `autoWorkAssignments` — work is always auto-assigned
  - `autoWorkConfirmFirst` — never ask for confirmation
  - `autoWorkMaxTurns` — never cap agent turns
  - `autoWorkAllowedTools` — agents use all tools freely
  - All corresponding commands, config properties, UI items, and conditional logic

After removal, the settings pane has: Repos Directory + Clone Repos with status badge + Claude Connect/Disconnect.

## Capabilities

### New Capabilities
- `treeview-active-indicator`: Visual indicator on the settings/boards toggle entry in the actions submenu to show the currently active pane mode.
- `treeview-actions-menu`: Native VS Code submenu (`contributes.submenus`) replacing the flat icon bar.
- `settings-card-layout`: Card-style layout for the settings pane with visual grouping.
- `repos-clone-status`: Clone Repos action in the settings pane with a visual indicator showing whether repos are currently cloned or not.

### Modified Capabilities
- `claude-trigger`: Remove all config checks — always trigger auto-work unconditionally with no restrictions.
- `claude-harness`: Remove `--max-turns` and `--allowed-tools` flags from Claude Code spawn command.
- `claude-spawner`: Remove `maxTurns` and `allowedTools` from options type and CLI args.

## Impact

- `package.json` — Remove `aiOs.refreshBoard` from `view/title`. Add `contributes.submenus`. Remove config properties `autoWorkAssignments`, `autoWorkConfirmFirst`, `autoWorkMaxTurns`, `autoWorkAllowedTools`. Remove commands `aiOs.toggleAutoWork`, `aiOs.toggleConfirmFirst`, `aiOs.enableAutoWork`, `aiOs.setMaxTurns`, `aiOs.setAllowedTools`.
- `src/extension.ts` — Remove 5 command registrations.
- `src/services/claudeTrigger.ts` — Remove all config checks. Always trigger with no restrictions.
- `src/services/claudeHarness.ts` — Remove `--max-turns` and `--allowed-tools` from CLI args.
- `src/services/claudeSpawner.ts` — Remove `maxTurns`/`allowedTools` from options type and CLI args.
- `src/providers/BoardTreeProvider.ts` — Remove all removed items. Add card-style sections. Add Clone Repos item with status badge. Add `setContext()` in `setMode()`.
- `src/providers/SettingsPanel.ts` — Remove all removed inputs from webview.

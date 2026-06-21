## Context

The treeview has two modes: `boards` and `settings`. The view-title menu currently shows 4 icons. The settings pane renders as a flat list.

**New requirement**: Add a "Clone Repos" action in the settings pane that shows whether repos are currently cloned, and lets the user trigger a clone/update with one click.

## Goals / Non-Goals

**Goals:**
- Remove the redundant "Refresh Board" button.
- Replace the flat icon bar with a native VS Code submenu.
- Keep Start Agent `▶` pinned.
- Redesign settings pane as card-style sections.
- Add Clone Repos action with visual status indicator (cloned/not cloned).
- Remove ALL useless options: auto-work toggle, confirm-first, max-turns, allowed-tools.
- Active pane mode indicator via icon/label swap in submenu.

**Non-Goals:**
- Not making the menu layout configurable.
- Not adding custom SVG icons — use VS Code Codicons only.

## Decisions

### Decision 1: Remove Refresh Board Button

Remove `aiOs.refreshBoard` from the view-title menu. Auto-polling at 30s makes it redundant.

### Decision 2: Native VS Code Submenu via `contributes.submenus`

Title bar: `▶` (pinned) + `⋯` (dropdown with Fetch Boards, Open Settings/Back to Boards).

### Decision 3: Remove ALL Useless Options

Remove `autoWorkAssignments`, `autoWorkConfirmFirst`, `autoWorkMaxTurns`, `autoWorkAllowedTools` and all related commands, config, UI items, and conditional logic. Agents run freely with all tools, no turn caps, no confirmation.

### Decision 4: Clone Repos with Status Indicator

**Choice**: Add a "Clone Repos" tree item in the Repositories section that shows the current clone status via a badge and triggers the clone action on click.

**Status indicator:**
- When repos are cloned: `$(repo-cloned) Clone Repos` with description `✓ Cloned` (green check)
- When repos are not cloned: `$(repo) Clone Repos` with description `Not cloned` (gray)
- When no board is open: `$(repo) Clone Repos` with description `No board open` (disabled, non-clickable)

**Implementation**: The `_buildSettingsItems()` method checks `repoManager.isRepoCloned()` or the state of cloned repos to determine the badge. The item calls `aiOs.cloneRepos` command on click.

**Rationale**: Users need to know at a glance whether repos are cloned. The status badge provides instant feedback without clicking. The action is one-click accessible from the settings pane.

### Decision 5: Card-Style Settings Layout

After all changes, the settings pane:

```
┌── AI OS: SETTINGS ────────────────────┐
│                                       │
│  📦 REPOSITORIES                      │
│  📁 Repos Directory          ~/ai-os  │
│  ✓  Clone Repos              Cloned   │
│  ───────────────────────────────────  │
│  ☁️  CLAUDE INTEGRATION               │
│  ☁️  Connect to Claude Code           │
│  🔌 Disconnect from Claude Code       │
└───────────────────────────────────────┘
```

When repos are NOT cloned:
```
│  📦 REPOSITORIES                      │
│  📁 Repos Directory          ~/ai-os  │
│  📦 Clone Repos            Not cloned │
```

**Implementation:**
- Section headers: `TreeItem` with `collapsibleState: CollapsibleState.None`, no command
- Clone Repos item: clickable, calls `aiOs.cloneRepos`, status in `description`
- Action items: distinct icons (`$(cloud-upload)`, `$(plug)`)
- Spacer items between sections

### Decision 6: Context Key for Mode Tracking

Set VS Code context key `aiOs.treeMode` (`'boards'` or `'settings'`) whenever the mode changes.

## Risks / Trade-offs

- [Risk] Clone status check requires calling `repoManager` from `BoardTreeProvider` → Pass `repoManager` reference or use `stateManager` to check clone state.
- [Risk] Removing `autoWorkMaxTurns` means agents run indefinitely → Desired behavior.
- [Risk] Removing `autoWorkAllowedTools` means agents use any tool → Desired behavior.

## Migration Plan

No migration needed. Config keys orphaned but harmless.

## Open Questions

- None.

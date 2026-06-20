## Why

The extension currently uses raw `console.log/warn/error/debug` calls across all source files, which only output to the Extension Host DevTools console. Users have no way to filter log severity, access a dedicated output channel, or control verbosity — making debugging in production difficult and unprofessional.

## What Changes

- Introduce a centralized `Logger` service (`src/services/logger.ts`) wrapping `vscode.LogOutputChannel` with level-aware methods (`trace`, `debug`, `info`, `warn`, `error`).
- Replace all 41 extension-host `console.*` calls across the codebase with the new logger, mapping each call to the appropriate log level.
- Dispose the `LogOutputChannel` on extension deactivation to prevent resource leaks.
- Keep `console.warn/error` only for early activation failures (before the logger is initialized).

## Capabilities

### New Capabilities
- `logger-service`: Centralized logging service using VS Code's `LogOutputChannel` API with a singleton Logger class providing level-aware methods, automatic `[AI OS]` prefix, and proper lifecycle management.

### Modified Capabilities
<!-- None — no existing specs to modify. -->

## Impact

- **Files affected**: `src/extension.ts`, `src/services/poller.ts`, `src/services/graphql.ts`, `src/services/agent.ts`, `src/services/auth.ts`, `src/providers/KanbanPanel.ts` (all console.* calls replaced).
- **New file**: `src/services/logger.ts` (Logger singleton class).
- **No breaking changes** — internal logging only, no public API changes.
- **Dependency**: None — uses only the VS Code Extension API (`vscode` package), already a dependency.

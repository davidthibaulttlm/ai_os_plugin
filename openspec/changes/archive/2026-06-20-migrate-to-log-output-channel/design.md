## Context

The AI OS extension currently uses raw `console.log/warn/error/debug` calls across 6 source files (41 call sites). These output only to the Extension Host DevTools console, which requires users to open the Developer Tools window. There is no user-controllable log level filtering, no dedicated Output panel tab, and no structured logging pattern.

VS Code provides `vscode.window.createOutputChannel(name, { log: true })` which returns a `LogOutputChannel` — a dedicated output channel with built-in log level support (`trace`, `debug`, `info`, `warn`, `error`). Users can toggle the log level from the Output panel dropdown and see logs in a named tab alongside their extension output.

## Goals / Non-Goals

**Goals:**
- Provide a centralized, singleton Logger service that wraps `LogOutputChannel`
- Replace all `console.*` calls with level-appropriate logger methods
- Give users a dedicated "AI OS" Output channel with controllable log levels
- Ensure proper lifecycle management (dispose on deactivation)
- Maintain the existing `[AI OS]` log prefix convention

**Non-Goals:**
- Structured JSON logging or log file persistence
- Log rotation or log aggregation to external services
- Webview-side logging (webview sandbox has no access to `LogOutputChannel`)
- Making log level configurable via extension settings

## Decisions

### Decision 1: Singleton Logger class over function-based utility
A singleton class (`Logger`) encapsulates the `LogOutputChannel` instance and provides type-safe level methods. This avoids passing the channel through the dependency graph and keeps the API simple: `logger.info('message')`.

**Alternatives considered:**
- Function-based utility (`getLogger()`) — less type-safe, harder to extend
- Dependency injection — overkill for a single logger instance

### Decision 2: Automatic `[AI OS]` prefix in Logger methods
The Logger prepends `[AI OS]` to all messages automatically, removing the burden from individual call sites. This ensures consistency and prevents accidental missing prefixes.

### Decision 3: Logger created on the first line of `activate()`
The `LogOutputChannel` is created on the very first line of `activate()` so that all logging during activation — including the initial "Extension activating..." message — uses the logger. No `console.*` calls are needed during normal activation. `console.error` is only used inside the `catch` block of `activate()` if logger creation itself fails.

### Decision 4: Log level mapping from existing console calls
- `console.log` → `logger.info` (lifecycle events, state changes)
- `console.warn` → `logger.warn` (recoverable issues, missing fields)
- `console.error` → `logger.error` (failures, exceptions)
- `console.debug` → `logger.debug` (rate limit info, retry details, agent cancellation)
- **Exception**: `_moveItem` debug logs in `KanbanPanel.ts` (lines 401, 410, 411, 413) map to `logger.debug()` despite being `console.log`, since they fire on every drag-and-drop and would spam at Info level
- **Note**: `trace` is available for future use but no existing calls map to this level

### Decision 5: Logger created in `activate()`, disposed in `deactivate()`
The Logger lifecycle matches the extension lifecycle. The channel is created during activation and disposed during deactivation to prevent resource leaks.

## Risks / Trade-offs

[Risk] Webview inline script uses `console.log` for IPC testing → These run in the webview sandbox and cannot access `LogOutputChannel`. Keep webview `console.log` calls as-is since they serve a different purpose (webview-side debugging).

[Risk] Large log volume at `trace`/`debug` level may slow down the Output channel → Users control the log level. Default is `Info`, which filters out verbose debug/trace messages.

[Trade-off] No log file persistence — logs exist only in the Output panel buffer. If users close the panel, logs are lost. This is acceptable for a self-hosted extension where users can keep the Output panel open during debugging.

## Migration Plan

1. Create `src/services/logger.ts` with the Logger singleton
2. Import and use `logger` in each affected file, replacing `console.*` calls
3. Verify the build passes (`npx tsc --noEmit`)
4. Test that logs appear in the "AI OS" Output channel
5. Rollback: simply revert the files — no data migration needed

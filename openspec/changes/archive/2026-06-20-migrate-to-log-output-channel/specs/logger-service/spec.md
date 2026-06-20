## ADDED Requirements

### Requirement: Logger singleton provides level-aware logging methods
The extension SHALL provide a singleton Logger service that wraps a VS Code `LogOutputChannel` and exposes `trace`, `debug`, `info`, `warn`, and `error` methods. Each method SHALL only output messages when the channel's current log level is at or below the message severity.

#### Scenario: Logger instance is a singleton
- **WHEN** `Logger.getInstance()` is called multiple times from different modules
- **THEN** the same Logger instance is returned each time

#### Scenario: Logger accessible before activate completes
- **WHEN** `Logger.getInstance()` is called on the first line of `activate()` before any other initialization
- **THEN** a valid Logger instance with a working `LogOutputChannel` is returned

#### Scenario: Log level filters messages correctly
- **WHEN** the channel log level is set to `Warning`
- **THEN** calls to `logger.trace()` and `logger.debug()` produce no output and `logger.warn()` produces output

### Requirement: Logger channel is named and accessible to users
The Logger SHALL create a `LogOutputChannel` with the name "AI OS" so users can access it from the Output panel dropdown.

#### Scenario: Output channel appears in Output panel
- **WHEN** the extension is activated
- **THEN** an "AI OS" channel is available in the VS Code Output panel dropdown

### Requirement: Logger prepends consistent prefix to all messages
The Logger SHALL automatically prepend `[AI OS]` to all log messages so that log entries are consistently identifiable.

#### Scenario: Prefix is added automatically
- **WHEN** `logger.info('Extension activated')` is called
- **THEN** the output channel displays `[AI OS] Extension activated`

### Requirement: Logger provides dispose method for cleanup
The Logger SHALL expose a `dispose()` method that disposes its `LogOutputChannel` to prevent resource leaks. The `dispose()` method SHALL be safe to call multiple times.

#### Scenario: Logger dispose method cleans up channel
- **WHEN** `logger.dispose()` is called
- **THEN** the underlying `LogOutputChannel.dispose()` is called

#### Scenario: Dispose is idempotent
- **WHEN** `logger.dispose()` is called multiple times
- **THEN** no error is thrown

### Requirement: Logger error method accepts Error objects
The `logger.error()` method SHALL accept either a string message or an `Error` object as the second argument, passing it through to `LogOutputChannel.error()`.

#### Scenario: Error object is logged with stack trace
- **WHEN** `logger.error('Operation failed', new Error('timeout'))` is called
- **THEN** the error message and stack trace are output to the channel

### Requirement: All existing console calls are migrated to logger
All `console.log`, `console.warn`, `console.error`, and `console.debug` calls in the extension host source files SHALL be replaced with the corresponding Logger method calls.

#### Scenario: No console calls remain in extension host code
- **WHEN** the source files `src/extension.ts`, `src/services/poller.ts`, `src/services/graphql.ts`, `src/services/agent.ts`, `src/services/auth.ts`, `src/providers/KanbanPanel.ts` are inspected
- **THEN** no `console.log`, `console.warn`, `console.error`, or `console.debug` calls remain (excluding webview inline scripts and the `catch` block in `activate()` where `console.error` is used as a fallback if logger creation fails)

#### Scenario: Log levels are correctly mapped from console calls
- **WHEN** a former `console.log` call for a lifecycle event is inspected
- **THEN** it is now `logger.info()`
- **WHEN** a former `console.warn` call is inspected
- **THEN** it is now `logger.warn()`
- **WHEN** a former `console.error` call is inspected
- **THEN** it is now `logger.error()`
- **WHEN** a former `console.debug` call is inspected
- **THEN** it is now `logger.debug()`
- **WHEN** a `console.log` in `_moveItem` (KanbanPanel.ts lines 401, 410, 411, 413) is inspected
- **THEN** it is mapped to `logger.debug()` (not `logger.info()`) since these are diagnostic logs that fire on every drag-and-drop

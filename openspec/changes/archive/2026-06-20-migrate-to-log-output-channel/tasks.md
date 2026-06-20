## 1. Create Logger Service

- [x] 1.1 Create `src/services/logger.ts` with a singleton `Logger` class wrapping `vscode.LogOutputChannel`
- [x] 1.2 Implement level-aware methods: `trace`, `debug`, `info`, `warn`, `error` with automatic `[AI OS]` prefix
- [x] 1.3 Implement `dispose()` method that safely disposes the channel (idempotent)
- [x] 1.4 Export a default `logger` singleton instance via `Logger.getInstance()`
- [x] 1.5 Verify TypeScript compilation passes (`npx tsc --noEmit`)

## 2. Integrate Logger into Extension Lifecycle

- [x] 2.1 Create the `LogOutputChannel` on the first line of `activate()` (before any logging) so the logger is available for all activation messages
- [x] 2.2 Import `logger` in `src/extension.ts` and replace `console.log('[AI OS] Extension activating...')` with `logger.info()`
- [x] 2.3 Replace remaining `console.*` calls in `src/extension.ts` (lines 53, 58, 65, 79, 81, 102, 257, 289) with appropriate logger methods
- [x] 2.4 Add `logger.dispose()` call in `deactivate()`

## 3. Migrate Poller Service

- [x] 3.1 Import `logger` in `src/services/poller.ts`
- [x] 3.2 Replace all `console.*` calls (lines 43, 47, 52, 66, 79, 104) with appropriate logger methods

## 4. Migrate GraphQL Client

- [x] 4.1 Import `logger` in `src/services/graphql.ts`
- [x] 4.2 Replace `console.debug` calls (lines 279, 285, 303) with `logger.debug()`

## 5. Migrate Agent Service

- [x] 5.1 Import `logger` in `src/services/agent.ts`
- [x] 5.2 Replace `console.debug` call (line 53) with `logger.debug()`

## 6. Migrate Auth Service

- [x] 6.1 Import `logger` in `src/services/auth.ts`
- [x] 6.2 Replace `console.warn` call (line 54) with `logger.warn()`

## 7. Migrate Kanban Panel

- [x] 7.1 Import `logger` in `src/providers/KanbanPanel.ts`
- [x] 7.2 Replace `console.*` calls in the message handler portion (lines 53, 57, 62, 74, 185, 187, 198, 219, 241, 248, 263, 265, 274, 283, 306, 311) with appropriate logger methods
- [x] 7.3 Replace `_moveItem` `console.log` calls (lines 401, 406, 410, 411, 413) with `logger.debug()` — these are diagnostic logs that fire on every drag-and-drop, not lifecycle events
- [x] 7.4 Keep webview inline script `console.log` calls (lines 454-461) unchanged — webview sandbox cannot access `LogOutputChannel`

## 8. Verify and Test

- [x] 8.1 Run TypeScript compilation (`npx tsc --noEmit`) and fix any type errors
- [x] 8.2 Run extension build (`node esbuild.js`) and verify it succeeds
- [x] 8.3 Verify no `console.log/warn/error/debug` remains in extension host source files (grep search)
- [ ] 8.4 Test that logs appear in the "AI OS" Output channel when running the extension

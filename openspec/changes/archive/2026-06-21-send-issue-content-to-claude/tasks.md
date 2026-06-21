## 1. GraphQL Layer
- [ ] 1.1 `src/services/graphql.queries.ts` — Add `body` field to `CONTENT_FRAGMENT`
- [ ] 1.2 `src/services/graphql.queries.ts` — Add `body?: string` to `IssueContent` interface

## 2. Agent Service Layer
- [ ] 2.1 `src/services/agent.ts` — Add `body?: string` to `PrioritizerItem` interface
- [ ] 2.2 `src/services/agent.ts` — Update `AgentTriggerCallback` type to accept `body?: string` third parameter
- [ ] 2.3 `src/services/agent.ts` — Update `startAgent()` to extract body from board state and pass to callback
- [ ] 2.4 `src/services/agent.ts` — Update `onAgentTrigger()` to look up body from board state and pass to callback

## 3. Poller Layer
- [ ] 3.1 `src/services/poller.ts` — Map `item.content?.body` into `PrioritizerItem` in `feedBoardState()`

## 4. Extension Wiring
- [ ] 4.1 `src/extension.ts` — Update `agentService.setCallback()` to accept and thread `body` parameter into `TriggerEvent`

## 5. Tests
- [ ] 5.1 `src/test/services/agent.startAgent.test.ts` — Add test: "passes issue body to callback"
- [ ] 5.2 `src/test/services/agent.startAgent.test.ts` — Update existing callback assertions for 3-argument signature
- [ ] 5.3 `src/test/services/agent.test.ts` — Update `onAgentTrigger` callback assertions for 3-argument signature
- [ ] 5.4 `src/test/services/agent.test.ts` — Update `finishAgent` callback assertions for 3-argument signature
- [ ] 5.5 Run `npx vitest run` and verify all tests pass

## 6. Build Verification
- [ ] 6.1 Run `npx tsc --noEmit` and verify zero errors
- [ ] 6.2 Run `node esbuild.js` and verify build succeeds

## 7. Mandatory Logging
- [ ] 7.1 `src/services/agent.ts` — Verify `logger` imported; verify `startAgent()` and `onAgentTrigger()` log body presence/absence
- [ ] 7.2 `src/services/poller.ts` — Verify `logger` imported; verify `feedBoardState()` logs
- [ ] 7.3 `src/extension.ts` — Verify `logger` imported; verify callback logs body presence
- [ ] 7.4 Verify no `console.log` exists: `grep -rn "console\.log" src/` must return zero results

## Why

When the agent triggers Claude Code to work on an issue, only the issue title was being sent — the full issue description (body) was missing. Claude was working blind, without the actual requirements or context from the issue.

## What Changes

- **GraphQL `CONTENT_FRAGMENT` now fetches `body`** — Issue descriptions are included in every board poll.
- **`PrioritizerItem` includes `body` field** — Board state carries issue descriptions through the pipeline.
- **`AgentTriggerCallback` accepts `body` parameter** — The callback chain threads issue content from selection to Claude spawn.
- **`buildPrompt()` receives actual issue body** — Claude's prompt now includes the full issue description.

## Capabilities

### New Capabilities
- `issue-content-delivery`: Pipeline for delivering issue body content from GraphQL poll through to Claude CLI prompt.

### Modified Capabilities
- `agent-prioritizer`: PrioritizerItem now carries issue body; callback signature gains body parameter.
- `graphql-client`: CONTENT_FRAGMENT includes body field; IssueContent type has optional body.

## Impact

- `src/services/graphql.queries.ts` — CONTENT_FRAGMENT + IssueContent type
- `src/services/agent.ts` — PrioritizerItem interface, AgentTriggerCallback type, startAgent/onAgentTrigger methods
- `src/services/poller.ts` — feedBoardState mapping
- `src/extension.ts` — Agent callback wiring
- `src/services/claudeTrigger.ts` — TriggerEvent.body already supported, now populated
- All agent-related test files — callback assertions updated for 3-argument signature

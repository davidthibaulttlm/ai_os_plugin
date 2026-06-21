## Context

Currently, when the agent prioritizer selects an issue and triggers Claude Code, only the issue title reaches Claude. The issue body (description) is fetched by the GraphQL poll but never threaded through the callback chain to `buildPrompt()`. Claude works blind on issues without context.

The existing data flow:
```
GraphQL Poll → PrioritizerItem{id, title, status, labels} → callback(id, col) → buildPrompt() → claude -p
```

## Goals / Non-Goals

**Goals:**
- Issue body flows from GraphQL poll through to Claude CLI prompt
- No additional GraphQL queries needed — body is part of every poll
- Backward compatible — body is optional, existing code handles missing body gracefully

**Non-Goals:**
- Fetching comments, linked PRs, or other issue metadata
- Streaming Claude output back to the board
- Prompt templating or customization

## Decisions

### Decision 1: Body in CONTENT_FRAGMENT (not lazy fetch)
**Why:** The `CONTENT_FRAGMENT` is already part of every board poll. Adding `body` costs one extra field per item in an existing query, avoiding a second round-trip per issue spawn. The body is needed by Claude immediately on trigger.

**Alternatives considered:**
- Lazy fetch via `getIssueByNumber()` on trigger — adds latency, extra API call, requires repo owner/name lookup
- Store body in Memento — unnecessary persistence, body changes on GitHub

### Decision 2: Thread body through callback signature
**Why:** The callback chain (`AgentTriggerCallback`) is the existing pipeline from selection to Claude spawn. Adding `body` as a third parameter keeps the flow linear and explicit.

**Alternatives considered:**
- Pass a full `PrioritizerItem` object — overkill, callback only needs body
- Global state lookup in `buildPrompt` — couples trigger to agent service state

### Decision 3: Optional body field
**Why:** PRs may not have a body, and existing board state may not have body populated during transition. Making it optional (`body?: string`) ensures no runtime errors.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Large issue bodies exceed CLI arg length limits | `claude -p` accepts multi-line strings; typical issue bodies are well under shell limits. If needed, pipe via stdin in a future iteration. |
| Poll payload increases with body text | Body is already fetched; the cost is memory in `PrioritizerItem`, negligible for typical board sizes (<100 items). |
| Callback signature change breaks existing callers | All callers are internal; tests catch signature mismatches. |

## Migration Plan

No migration needed. Changes are additive:
1. `body` field is optional in all interfaces
2. Callback third parameter is optional
3. `buildPrompt` already checks `if (event.body)` before including

## Open Questions

None — implementation is complete and tested.

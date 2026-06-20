## Context

The extension currently polls a GitHub Projects v2 board every 30s and detects when issues move into AI_SPEC or AI_CODE columns. The [`AgentService`](src/services/agent.ts:13) is reactive — it triggers when a delta event fires, but has no logic to decide *which* issue to work on when multiple exist, no WIP tracking, and no bug priority handling.

The board has 6 fixed columns:
```
BRAIN_DUMP → AI_SPEC → HUMAN_SPEC_REVIEW → AI_CODE → HUMAN_CODE_REVIEW → PR_DONE
```

The agent must only work on issues in AI-eligible columns (`AI_SPEC`, `AI_CODE`, `BRAIN_DUMP`) and must never touch columns containing "HUMAN" or "PR_DONE."

## Goals / Non-Goals

**Goals:**
- Automatically select the next issue for the AI agent based on deterministic priority
- Enforce WIP limit of 1 (bugs break WIP limit)
- Auto-move issues from BRAIN_DUMP to AI_SPEC before triggering agent
- Prioritize issues with GitHub `bug` label over all other issues
- Push issues through the pipeline: AI_CODE → AI_SPEC → BRAIN_DUMP

**Non-Goals:**
- Configurable WIP limits (fixed at 1 for now)
- Priority labels beyond `bug`
- Multi-agent coordination
- User approval workflows

## Decisions

### Decision 1: Column Priority Order — AI_CODE > AI_SPEC > BRAIN_DUMP

**Why this order:** The goal is to push issues through the pipeline to completion. An issue in `AI_CODE` is closest to being done (just needs code implementation). An issue in `AI_SPEC` needs a spec written first. `BRAIN_DUMP` is raw ideas that need to be pulled into the workflow.

```
Priority Scan:
  1. AI_CODE      (finish what's closest to done)
  2. AI_SPEC      (spec what's waiting)
  3. BRAIN_DUMP   (pull new work, auto-move to AI_SPEC)
```

**Alternatives considered:**
- `AI_SPEC > AI_CODE > BRAIN_DUMP` — Would start new specs while code waits. Creates more WIP instead of finishing work.
- `BRAIN_DUMP > AI_SPEC > AI_CODE` — Would constantly start new work and never finish existing items.

### Decision 2: Bug Label Breaks WIP Limit

An issue with the GitHub `bug` label is picked immediately regardless of current WIP status. This allows critical fixes to interrupt normal flow.

**Alternatives considered:**
- Queue bugs behind current work — Defeats the purpose of bug priority.
- Cancel current work and start bug — Too aggressive; the current issue might be 90% done. Just allow concurrent work for bugs.

### Decision 3: Auto-Move from BRAIN_DUMP to AI_SPEC

When the prioritizer selects an issue from `BRAIN_DUMP`, it automatically moves the card to `AI_SPEC` via GraphQL mutation before triggering the agent. This keeps the board state accurate and ensures the agent always works from an AI column.

**Alternatives considered:**
- Leave in BRAIN_DUMP and tell agent to work there — Board state becomes inaccurate; the card appears idle but is being worked on.
- Ask user to move first — Breaks automation goal.

### Decision 4: Top Card = Highest Priority Within Column

The within-column reorder feature (already implemented) is the priority signal. The top card in each column is the highest priority. No additional scoring or weighting.

**Alternatives considered:**
- Use GitHub issue labels for priority — Adds complexity; the user already has drag-and-drop reorder.
- Use creation date (FIFO) — Ignores user intent expressed through reordering.
- Use a combination score — Over-engineered for the use case.

### Decision 5: Prioritizer Lives in AgentService

The prioritization logic extends the existing [`AgentService`](src/services/agent.ts:13) rather than creating a new service. The agent service already tracks active agents and knows which columns trigger AI work.

**Alternatives considered:**
- Separate PrioritizerService — Clean separation but adds inter-service communication overhead for what is essentially one method call.
- Inline in the command handler — Duplicates logic if called from multiple places (command, auto-trigger, etc.).

## Mandatory Constraints (From AGENTS.md)

- **Logger in every file**: Every method MUST import and use `logger` from `src/services/logger.ts`. Log start, parameters, results, and errors. NO `console.log`.
- **Search web before coding**: Implementation must verify API signatures against current documentation, not rely on memory.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| GraphQL mutation fails when auto-moving from BRAIN_DUMP | Log error, notify user, skip this issue and try next |
| Label data not available in poll results | Extend GraphQL query to include labels (already queried in `CONTENT_FRAGMENT`) |
| Race condition: user moves card while prioritizer runs | Poller has `isPolling` guard; prioritizer reads snapshot from last poll |
| Bug label detection depends on exact label name | Normalize to lowercase and check `includes('bug')` for flexibility |

## Open Questions

- Should the "Start Agent" button show a preview of which issue will be picked? (Can be added later)
- Should the agent auto-start when a bug enters the board, or only on manual "Start"? (Starting with manual)

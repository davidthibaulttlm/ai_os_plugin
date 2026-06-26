## Context

Currently, `ColumnPromptService` manages prompts per-column in VS Code Memento. When `ClaudeHarness.buildPrompt()` assembles a prompt, it calls `promptService.assemblePromptChain(column, userContent)` which returns system + developer + user content based solely on the column name. All repos share the same prompts.

Claude Code (the CLI spawned by AI OS) reads `CLAUDE.md` from the working directory root at startup. When AI OS spawns `claude -p "..."` inside a worktree, Claude automatically picks up that repo's `CLAUDE.md`. Many VS Code projects also use `AGENTS.md` for agent guidance (Roo, Cline, etc.).

**Key distinction:**
- `CLAUDE.md` — Claude Code reads it automatically. No injection needed.
- `AGENTS.md` — Claude Code does NOT read it. Must be injected into the prompt manually.

**Current prompt flow:**
```
ColumnPromptService.assemblePromptChain(column, userContent)
  → getSystemPrompt(column)    [Memento override or default]
  → getDeveloperPrompt(column) [Memento override or default]
  → userContent (issue details)
  → joined with \n\n
```

**Target prompt flow:**
```
ColumnPromptService.assemblePromptChain(column, userContent, owner, repo)
  → RepoPromptService.hasCLAUDEmd(owner, repo)?
    YES → Minimal column prompt (role + task instruction) + userContent
           (Claude reads CLAUDE.md from worktree automatically)
    NO  → RepoPromptService.hasAGENTSmd(owner, repo)?
      YES → Minimal column prompt + AGENTS.md content injected as system context
             (AGENTS.md REPLACES column defaults — it IS the system prompt)
      NO  → Full column prompt (system + developer + userContent)
             [existing Memento fallback behavior]
```

## Goals / Non-Goals

**Goals:**
- Use CLAUDE.md as the primary source of project-specific prompt context
- Fall back to AGENTS.md when CLAUDE.md is absent (supports VS Code agent projects)
- Send minimal task prompts when CLAUDE.md exists (avoid redundancy)
- Inject AGENTS.md content into prompt when it's the fallback source
- Fall back to existing column-level defaults when neither file exists
- Add BRAIN_DUMP column prompt support with a default ideation prompt
- Warn user when a repo lacks both CLAUDE.md and AGENTS.md and offer to create CLAUDE.md
- Zero breaking changes — existing behavior preserved for repos without either file

**Non-Goals:**
- Parsing or validating CLAUDE.md/AGENTS.md content (Claude Code handles CLAUDE.md)
- Editing CLAUDE.md/AGENTS.md from the webview (users edit them in their repo)
- Per-repo prompt UI in webview (context files ARE the UI — they're files in the repo)

## Decisions

### Decision 1: RepoPromptService as a thin file reader, not a parser
**Why**: Both CLAUDE.md and AGENTS.md are free-form markdown files. We don't need to parse them — we only need to know if they exist and read their content. The service's job is existence checking and content caching, not interpretation.

**Alternative considered**: Parse file sections and inject them into the prompt. Rejected because Claude Code already reads CLAUDE.md — duplicating content in the `-p` prompt wastes tokens and creates inconsistency. AGENTS.md is injected as-is since Claude Code doesn't read it.

### Decision 2: Three-tier prompt resolution
**Why**: Different repos have different context files. The resolution chain prioritizes CLAUDE.md (native to Claude Code), then AGENTS.md (VS Code agent convention), then column defaults. AGENTS.md is NOT supplementary — it IS the system prompt, just like CLAUDE.md.

**Prompt resolution chain:**
```
1. CLAUDE.md exists? → Minimal prompt (Claude reads CLAUDE.md automatically)
2. AGENTS.md exists? → Minimal prompt + AGENTS.md injected as system context
                       (AGENTS.md REPLACES column defaults, does not supplement them)
3. Neither?          → Full column defaults (existing Memento behavior)
```

**Minimal prompt format (CLAUDE.md case):**
```
You are [role based on column]. Work on the following issue:

[issue details: number, title, body, labels, repo]

## Rules
- Stage changes with 'git add' when done
- Do NOT commit — the harness will commit after you finish
- Do NOT push — the harness will push after you finish
```

**AGENTS.md injection format (AGENTS.md case):**
```
[AGENTS.md content — this IS the system/developer prompt]

---

You are [role based on column]. Work on the following issue:

[issue details: number, title, body, labels, repo]

## Rules
- Stage changes with 'git add' when done
- Do NOT commit — the harness will commit after you finish
- Do NOT push — the harness will push after you finish
```

### Decision 3: BRAIN_DUMP gets a default ideation prompt
**Why**: BRAIN_DUMP is in `AI_ELIGIBLE_COLUMNS` in AgentService. Issues can enter this column and trigger agents. The prompt should guide the agent to expand rough ideas into structured analysis.

**Default BRAIN_DUMP system prompt:**
"You are an ideation assistant. Expand rough ideas into structured analysis with options, tradeoffs, and recommendations."

**Default BRAIN_DUMP developer prompt:**
"Take the issue idea and produce:
1. Problem Statement — clear definition of what needs solving
2. Options Analysis — 2-3 approaches with pros/cons
3. Recommendation — suggested path forward with reasoning
4. Next Steps — actionable items for the AI_SPEC column"

### Decision 4: CLAUDE.md template creation via RepoManager
**Why**: RepoManager already handles repo lifecycle (clone, worktree, etc.). Adding context file existence checking and template creation fits naturally there. The template is a simple markdown file with sections for project context, tech stack, and coding conventions.

### Decision 5: Cache file content in-memory with staleness check
**Why**: Reading the filesystem on every prompt build is wasteful. Cache the content when first read, but re-read if the file modification time has changed (user may have edited the file between runs).

## Risks / Trade-offs

[Risk] CLAUDE.md is very long → Claude Code may hit token limits combining CLAUDE.md + prompt
→ Mitigation: This is a Claude Code concern, not AI OS. Users control CLAUDE.md content.

[Risk] AGENTS.md is very long → Injecting into prompt may hit token limits
→ Mitigation: Truncate AGENTS.md content to a reasonable limit (e.g., 4000 chars) with a "[truncated]" notice.

[Risk] User edits CLAUDE.md/AGENTS.md while agent is running → Agent doesn't see changes mid-run
→ Mitigation: Acceptable. Claude Code reads CLAUDE.md at startup. Mid-run changes require a new agent spawn.

[Risk] Repo cloned but neither file exists → Agent uses generic defaults
→ Mitigation: This is the fallback path. User is warned via webview notification.

[Risk] CLAUDE.md/AGENTS.md contains conflicting instructions with column prompt → Confusion for agent
→ Mitigation: Minimal column prompt is thin (just role + task). Context files provide project info, not task instructions. They complement each other.

## Migration Plan

1. Add `RepoPromptService` — new service, no impact on existing code
2. Add `hasCLAUDEmd()`, `hasAGENTSmd()`, `getAGENTSmd()` to `RepoManager`
3. Extend `ColumnPromptService.assemblePromptChain()` with optional `owner`/`repo` params
4. Update `ClaudeHarness.buildPrompt()` to pass repo context
5. Update `ClaudeTrigger` to include `owner`/`repo` in events
6. Add BRAIN_DUMP to `AI_COLUMNS` with defaults
7. Add CLAUDE.md template creation capability
8. Update webview to show CLAUDE.md status

**Rollback**: Simply revert the `assemblePromptChain` signature change. All existing callers work without repo params (fallback behavior).

## Open Questions

- Should the CLAUDE.md template be customizable per-project, or use a single universal template?
- Should AI OS validate CLAUDE.md has minimum content (not empty)?

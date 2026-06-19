# Agent Quality Review Checklist

> **Purpose**: Every agent (Code, Architect, Debug) must pass this checklist before reporting work as complete. The Orchestrator enforces this. Agents that fail review create rework, which delays the entire project.

---

## Code Mode Agent Checklist

### Before Submitting

Run these commands and ensure they pass:

```bash
# 1. TypeScript compilation (if .ts files exist)
npx tsc --noEmit 2>/dev/null || echo "No tsconfig yet — skip"

# 2. aislop quality scan
aislop scan ./src ./webview-ui ./backend 2>/dev/null || echo "No source yet — skip"

# 3. Check for common issues
grep -rn "console\.log" src/ webview-ui/src/ 2>/dev/null | grep -v ".test." || echo "Clean"
grep -rn ": any" src/ webview-ui/src/ 2>/dev/null | grep -v "node_modules" || echo "Clean"
grep -rn "TODO\|FIXME\|HACK" src/ webview-ui/src/ backend/ 2>/dev/null || echo "Clean"
```

### Mandatory Requirements

| # | Check | How to Verify |
|---|-------|---------------|
| 1 | **No dead imports** | Every import is used at least once in the file |
| 2 | **No `any` types** | Use proper TypeScript types; `unknown` if truly unknown |
| 3 | **No `console.log` in production** | Use VS Code's `console.log` only in extension host, not webview |
| 4 | **Error handling on all async** | Every `await` is in a try/catch or has `.catch()` |
| 5 | **Matches BUILD_GUIDE patterns** | Code follows the architecture in [`BUILD_GUIDE.md`](BUILD_GUIDE.md) |
| 6 | **No hardcoded tokens/keys** | Auth via environment variables or gh CLI only |
| 7 | **CSP compliant** | Webview HTML has proper Content-Security-Policy |
| 8 | **IPC message validation** | All `postMessage` handlers validate message.type |
| 9 | **No blocking operations on main thread** | Heavy work in web workers or Python backend |
| 10 | **aislop score ≥ 80** | Run `aislop scan` and check score |

### File-Specific Checks

#### Extension Files (`src/*.ts`)
- [ ] Imports `vscode` correctly (external, not bundled)
- [ ] Uses `context.subscriptions.push()` for disposables
- [ ] Webview HTML uses nonce for CSP
- [ ] All commands registered in `activate()`

#### Webview Files (`webview-ui/src/*.tsx`)
- [ ] Uses `acquireVsCodeApi()` for IPC
- [ ] No direct `fetch()` calls (all through VS Code API)
- [ ] Components are properly typed with interfaces
- [ ] Drag-and-drop uses `@dnd-kit` (not HTML5 DnD)

#### Backend Files (`backend/src/*.py`)
- [ ] All endpoints are async
- [ ] GraphQL queries use named operations
- [ ] Rate limit awareness (checks `X-RateLimit-Remaining`)
- [ ] Proper HTTP error codes (4xx for client, 5xx for server)

---

## Architect Mode Agent Checklist

### Before Submitting

| # | Check | How to Verify |
|---|-------|---------------|
| 1 | **Read CONTEXT_FOR_NEW_SESSION.md** | References specific decisions from the doc |
| 2 | **Consistent with AGENTS.md** | No contradictions with product vision |
| 3 | **Follows BUILD_GUIDE architecture** | Aligns with system design in BUILD_GUIDE |
| 4 | **Actionable output** | Code mode can implement without asking questions |
| 5 | **No over-engineering** | Solution matches the complexity of the problem |
| 6 | **Includes trade-offs** | Documents why this approach over alternatives |

### Design Document Requirements

Every architecture document must include:
- [ ] **Problem statement** — What problem does this solve?
- [ ] **Proposed solution** — Clear description with diagrams if needed
- [ ] **Trade-offs** — What was sacrificed and why
- [ ] **Implementation steps** — Ordered list for Code mode
- [ ] **Dependencies** — What must exist before this can be built
- [ ] **Testing approach** — How to verify it works

---

## Debug Mode Agent Checklist

### Before Submitting

| # | Check | How to Verify |
|---|-------|---------------|
| 1 | **Root cause identified** | Not just symptoms — the actual bug source |
| 2 | **Reproduction steps** | Numbered list that reliably reproduces |
| 3 | **Fix verified** | Tested the fix works on the reproduction case |
| 4 | **No regressions** | Related code paths still work |
| 5 | **Logs added if needed** | Debug logging for future troubleshooting |
| 6 | **aislop clean** | Fix doesn't introduce new quality issues |

### Bug Report Template

```markdown
## Bug: [Title]

**Symptom**: What the user sees
**Root Cause**: The actual bug in the code
**Location**: [file:line] where the bug lives

### Reproduction
1. Step one
2. Step two
3. Observe the bug

### Fix
[Description of the fix applied]

### Verification
[How the fix was tested]
```

---

## Orchestrator Review Process

When an agent reports work complete, the Orchestrator:

### Step 1: Read the Output
- Read all files the agent claims to have created/modified
- Verify the content matches what was requested

### Step 2: Pattern Check
- Compare against [`BUILD_GUIDE.md`](BUILD_GUIDE.md) patterns
- Ensure consistency with existing code style

### Step 3: Quality Scan
- Run `aislop scan` on changed files
- Check for the common issues listed above

### Step 4: Decision

| Result | Action |
|--------|--------|
| **Passes all checks** | Accept, update todo list, move to next task |
| **Minor issues (fixable)** | Send specific feedback, agent fixes in next turn |
| **Major issues (architecture wrong)** | Reject, explain why, agent redesigns |
| **Incomplete** | Specify what's missing, agent completes |

### Rejection Feedback Format

When rejecting work, use this format:

```
## Review: REJECTED

**File**: [filename]
**Issue**: [specific problem]
**Expected**: [what should be there]
**Actual**: [what is there]
**Fix**: [how to fix it]

Repeat for each issue. Be specific and actionable.
```

---

## Consequences of Poor Quality

Every issue an agent creates costs time:

| Quality Level | Rework Time | Impact |
|---------------|-------------|--------|
| **Excellent** (passes first review) | 0 min | Fast progress |
| **Good** (1-2 minor fixes) | 5 min | Acceptable |
| **Fair** (3-5 fixes needed) | 15 min | Slows progress |
| **Poor** (major rework) | 30+ min | Blocks everything |
| **Broken** (architecture wrong) | Hours | Project delay |

**The more problems you create, the longer it takes to build this app.**

---

## Quick Reference: Common Failures

1. **Importing vscode in webview** — Webview runs in a browser; `vscode` module doesn't exist there
2. **Synchronous blocking in extension host** — Blocks VS Code UI thread
3. **Storing tokens in webview state** — Security risk; tokens stay in extension host only
4. **Missing CSP nonce** — Webview scripts won't execute without proper CSP
5. **Forgetting `context.subscriptions.push()`** — Extension won't dispose properly
6. **Using REST API for Projects v2** — Projects v2 is GraphQL only
7. **Hardcoding GitHub project IDs** — Must be configurable/discoverable
8. **No error handling on GraphQL calls** — Rate limits and auth failures will crash

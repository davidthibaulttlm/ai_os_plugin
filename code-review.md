# Code Review Report

**Verdict:** 🟠 REQUEST CHANGES

**Date:** 2026-06-27T21:50:00Z
**Scope:** Full codebase review of AI OS VS Code extension (src/, webview-ui/, docker_voice/). All five dimensions covered: correctness, architecture, performance, security, dependency-cve.
**Version:** 1.0.0

## Summary

The codebase shows solid architecture for a VS Code extension automating GitHub Projects v2 kanban workflows. The async-first design, delta detection via in-memory diffing, and structured IPC layer are well-executed. However, there are two security blockers (command injection via git CLI arguments, GITHUB_TOKEN exposure to spawned processes), one high-severity correctness issue (hash collision in delta detection), and dependency CVEs in vite/esbuild that need addressing. The deprecated claudeSpawner module coexisting with claudeHarness creates maintenance debt.

## Findings Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 3 |
| 🟡 Medium | 5 |
| 🟢 Low | 3 |
| ⚪ Info | 1 |
| **Total** | **14** |

## CVE Scan

- **Method:** npm audit --json (ecosystem-native auditor)
- **Complete:** Yes
- **Scope:** root package.json + webview-ui/package.json

## Dimension Status

| Dimension | Status |
|-----------|--------|
| Correctness | ✅ reviewed |
| Architecture / Design | ✅ reviewed |
| Performance | ✅ reviewed |
| Security (OWASP Top 10:2025) | ✅ reviewed |
| Dependency CVEs | ✅ reviewed |

## Correctness

### 🟠 ⚠️ `CR-001` — hashToNumber() produces collisions for distinct GitHub node IDs

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Confidence** | high |
| **Disposition** | should-fix |
| **Category** | correctness |
| **Location** | [src/services/delta.ts#147](#src/services/delta.ts#147) |

**Detail:** hashToNumber() implements a djb2-style hash that maps arbitrary-length node ID strings to a 32-bit integer. With ~4 billion possible values, birthday collisions become likely after ~sqrt(4B) ≈ 64K items. Even for smaller boards, two different node IDs can hash to the same number, causing detectDeltas() to incorrectly treat them as the same item — suppressing 'item_added' events or generating false 'item_moved' events. Since databaseId is typically present, this is a fallback path, but it activates when databaseId is null.

**Recommendation:** Replace hashToNumber with a string-based key. Change BoardItemState.githubId from number to (number | string), preferring databaseId when available and falling back to the raw node ID string. Update all Map<number, ...> to Map<string, ...> in delta.ts and poller.ts.


```
export function hashToNumber(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
```

---

### 🟡 ⚠️ `CR-002` — useVsCode uses console.log instead of logger — violates project rules

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Confidence** | high |
| **Disposition** | should-fix |
| **Category** | correctness |
| **Location** | [webview-ui/src/hooks/useVsCode.ts#15](#webview-ui/src/hooks/useVsCode.ts#15) |

**Detail:** useVsCode.ts uses console.log() extensively (lines 15, 18, 24, 27, 28, 39, 43, 45, 48) instead of the project-mandated logger import. The AGENTS.md rules state: 'NEVER use console.log — use logger only.' In the webview context, logger.ts posts to the extension host via IPC and falls back to console.* in Storybook mode, so the correct import is: import { logger } from '../logger'.

**Recommendation:** Replace all console.log/console.error calls in useVsCode.ts with the appropriate logger level calls. Use logger.debug() for verbose IPC diagnostics and logger.error() for actual failures.


```
console.log(`[AI OS IPC] Environment check: api available = ${!!api}`);
console.error('[AI OS IPC] NOT running in VS Code webview!');
```

---

### 🟡 ⚠️ `CR-003` — Empty catch block swallows disposal errors — violates project rules

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Confidence** | high |
| **Disposition** | should-fix |
| **Category** | correctness |
| **Location** | [src/providers/KanbanPanel.ts#107](#src/providers/KanbanPanel.ts#107) |

**Detail:** KanbanPanel.ts line 107 has: catch { /* disposed */ } — an empty catch block that silently swallows errors when posting to a disposed webview. The AGENTS.md security rules state: 'No Empty Catch Blocks — Every catch block MUST log the error.' While the intent (panel was disposed) is correct, the pattern violates the rule and makes debugging post-disposal issues impossible.

**Recommendation:** Add a logger.debug() call in the catch block: catch { logger.debug('[KanbanPanel._safePostMessage] Panel disposed — message dropped'); }


```
  } catch {
    // Panel disposed - message delivery failed
  }
```

---

## Architecture / Design

### 🟡 ⚠️ `ARC-001` — Deprecated claudeSpawner coexists with claudeHarness — dual code paths for agent spawning

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Confidence** | high |
| **Disposition** | should-fix |
| **Category** | architecture |
| **Location** | [src/services/claudeSpawner.ts#1](#src/services/claudeSpawner.ts#1) |

**Detail:** claudeSpawner.ts is marked @deprecated but remains actively imported and used in extension.ts (line 12: import { killAllClaudeProcesses, setWorkingStatusCallback, setOnFinishCallback } from './services/claudeSpawner'). Meanwhile, claudeHarness.ts provides an enhanced lifecycle manager with worktree preparation, prompt building, output streaming, and post-run pipeline. Having two agent spawning mechanisms creates maintenance debt, inconsistent behavior, and makes it unclear which path is the source of truth for production.

**Recommendation:** Complete the migration from claudeSpawner to claudeHarness. Remove all claudeSpawner imports from extension.ts and replace with claudeHarness equivalents. Delete claudeSpawner.ts after confirming no remaining callers. Update tests accordingly.


```
/**
 * Claude Spawner — spawns `claude -p` child processes for auto-work.
 * @deprecated Use ClaudeHarness instead. Kept for backward compatibility.
 */
```

---

### 🟡 ⚠️ `ARC-002` — PollerService violates Single Responsibility — handles polling, delta detection, board state feeding, PR merge checking, and state bridge writing

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Confidence** | high |
| **Disposition** | should-fix |
| **Category** | architecture |
| **Location** | [src/services/poller.ts#20](#src/services/poller.ts#20) |

**Detail:** PollerService (267 lines) combines five distinct responsibilities: (1) scheduling poll intervals, (2) fetching project items via GraphQL, (3) detecting deltas via detectDeltas(), (4) feeding board state to AgentService, (5) checking merged PRs and triggering worktree cleanup, and (6) writing state bridge files. This makes the class hard to test in isolation and couples the polling mechanism to business logic.

**Recommendation:** Extract PR merge detection into a separate MergedPrDetector service. Extract state bridge writing into a StateWriter service. Keep PollerService focused on scheduling + fetching + delta notification. Each extracted service can be unit-tested independently.


```
private async checkMergedPrs(items: ProjectItemNode[]): Promise<void> {
    // ... iterates all items, checks MERGED state, calls repoManager.cleanupWorktree
  }
```

---

### 🟡 💡 `ARC-003` — Commands registered at module scope execute on import rather than during activation

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Confidence** | high |
| **Disposition** | consider |
| **Category** | architecture |
| **Location** | [src/extension.ts#103](#src/extension.ts#103) |

**Detail:** extension.ts registers 'aiOs.setReposDir' (line 103) and 'aiOs.resetOnboarding' (line 124) at module scope, outside the registerCommands() function. These commands are registered when the module is first evaluated, before activate() runs. While this works in practice (the commands reference boardTreeProvider which may be undefined), it creates a registration path that bypasses the extension lifecycle and could cause issues if the module is re-imported.

**Recommendation:** Move all command registrations into registerCommands() or activate() for a single, controlled registration point. Guard commands that depend on initialized services with null checks.


```
vscode.commands.registerCommand('aiOs.setReposDir', async () => {
    // Registered at module scope, outside registerCommands()
  });
```

---

### ⚪ 👍 `PR-001` — IPCRegistry with singleton window listener prevents duplicate handler accumulation

| Field | Value |
|-------|-------|
| **Severity** | info |
| **Confidence** | high |
| **Disposition** | praise |
| **Category** | architecture |
| **Location** | [webview-ui/src/hooks/useVsCode.ts#63](#webview-ui/src/hooks/useVsCode.ts#63) |

**Detail:** The IPCRegistry pattern (window.__aiOsIPC) with ensureListener() is a well-designed solution to the common webview problem of stacked message listeners during module reloads. The single persistent window.addEventListener survives HTML reassignment while the handler Map allows clean registration/deregistration via onMessage/offMessage. This is exactly the pattern VS Code webview documentation recommends.

**Recommendation:** None — this is a good pattern. Consider documenting it in a code comment for new contributors.


---

## Performance

### 🟡 💡 `PERF-001` — checkMergedPrs() iterates all board items on every poll cycle

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Confidence** | medium |
| **Disposition** | consider |
| **Category** | performance |
| **Location** | [src/services/poller.ts#136](#src/services/poller.ts#136) |

**Detail:** checkMergedPrs() runs on every poll cycle (30s interval) and iterates all ProjectItemNodes checking for MERGED state PRs. For each merged PR found, it calls repoManager.cleanupWorktree() which spawns git processes. On a board with 100+ items, this adds significant overhead per poll cycle. The function is fire-and-forget (unawaited in poll()), so errors don't block the poll but cleanup may be delayed.

**Recommendation:** Cache the set of already-processed merged PRs (by content.number + repo) and only trigger cleanup for newly-merged PRs detected since the last poll. This avoids redundant git operations for PRs that have been merged for a while.


```
private async checkMergedPrs(items: ProjectItemNode[]): Promise<void> {
    for (const item of items) {
      const content = item.content;
      if (!content) continue;
      if (content.state === 'MERGED' && content.repository) {
        // Spawns git cleanup for EVERY merged PR on every poll
      }
    }
  }
```

---

### 🟢 💡 `PERF-002` — Label comparison uses JSON.stringify(sort()) instead of set-based comparison

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Confidence** | medium |
| **Disposition** | consider |
| **Category** | performance |
| **Location** | [src/services/delta.ts#80](#src/services/delta.ts#80) |

**Detail:** delta.ts compares labels using JSON.stringify(last.labels.sort()) !== JSON.stringify(labels.sort()) (line 80). This creates sorted copies and serializes them for comparison. For typical label counts (1-5), this is negligible, but the pattern is O(n log n) per item when a set-based comparison would be O(n). Same pattern used for assignee comparison on line 70.

**Recommendation:** Replace with a set-based equality check: new Set(a) equals new Set(b). This is both more efficient and more readable. Consider extracting to a helper function arraysEqualIgnoringOrder(a, b).


```
if (last.title !== title || JSON.stringify(last.labels.sort()) !== JSON.stringify(labels.sort()))
```

---

## Security (OWASP Top 10:2025)

### 🔴 🚫 `SEC-001` — Command injection via unsanitized owner/repo in git CLI arguments

| Field | Value |
|-------|-------|
| **Severity** | critical |
| **Confidence** | high |
| **Disposition** | blocker |
| **Category** | security |
| **Location** | [src/services/repoManager.ts#175](#src/services/repoManager.ts#175) |

**Detail:** repoManager.ts constructs git CLI arguments directly from owner and repo parameters (e.g., 'clone', '--branch', defaultBranch, 'https://github.com/${owner}/${repo}.git', repo). If owner or repo contains shell metacharacters or path traversal sequences, the spawned git process could execute arbitrary commands or access unintended paths. The slugify() method exists but is only used for branch names and worktree paths, not for the git URL or clone target directory.

**Recommendation:** Validate owner and repo against a strict whitelist pattern (e.g., /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/) before passing to any git command. Apply this validation at the RepoManager constructor or cloneRepo entry point.

**References:**
- OWASP Top 10:2025 - A03 Injection


---

### 🔴 🚫 `SEC-002` — GITHUB_TOKEN exposed as environment variable to spawned Claude process

| Field | Value |
|-------|-------|
| **Severity** | critical |
| **Confidence** | high |
| **Disposition** | blocker |
| **Category** | security |
| **Location** | [src/services/claudeSpawner.ts#61](#src/services/claudeSpawner.ts#61) |

**Detail:** claudeSpawner.ts passes the GitHub token as GITHUB_TOKEN env var to every spawned 'claude' child process (line 61: env: { ...process.env, GITHUB_TOKEN: options.githubToken }). This exposes the token to the Claude Code process and any subprocesses it spawns. On Linux, the token appears in /proc/{pid}/environ for any user with access. The claudeHarness.ts module should be audited for the same pattern.

**Recommendation:** Instead of passing the token via environment, use git credential helpers or write the token to a temporary file with restrictive permissions (0600) and reference it via GIT_ASKPASS or a .netrc file. Alternatively, use GitHub's fine-grained personal access tokens with minimal scopes and short expiration.

**References:**
- OWASP Top 10:2025 - A07 Identification and Authentication Failures


---

### 🟢 💡 `SEC-003` — Logger auto-shows output channel on creation — intrusive for users

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Confidence** | medium |
| **Disposition** | consider |
| **Category** | security |
| **Location** | [src/services/logger.ts#21](#src/services/logger.ts#21) |

**Detail:** Logger.getInstance() calls Logger._instance._channel.show() (line 21), which automatically opens the AI OS output panel when the extension activates. This is intrusive for users who don't need to see debug output. The channel should be created lazily and only shown when explicitly requested or when an error/warning is logged.

**Recommendation:** Remove the .show() call from getInstance(). Add a logger.show() method that callers can invoke when they want to bring the channel to the user's attention. Or show the channel only on warn/error level messages.


```
Logger._instance._channel = vscode.window.createOutputChannel('AI OS', { log: true });
Logger._instance._channel.show();
```

---

## Dependency CVEs

### 🟠 ⚠️ `CVE-001` — vite <=6.4.2 has multiple CVEs including path traversal and fs.deny bypass

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Confidence** | high |
| **Disposition** | should-fix |
| **Category** | dependency-cve |
| **Location** | [webview-ui/package.json#33](#webview-ui/package.json#33) |

**Detail:** npm audit reports vite (direct devDependency ^5.0.0, resolved to <=6.4.2) has three vulnerabilities: GHSA-4w7w-66w2-5vf9 (path traversal in optimized deps .map handling, moderate), GHSA-v6wh-96g9-6wx3 (NTLMv2 hash disclosure via UNC paths on Windows, moderate), and GHSA-fx2h-pf6j-xcff (server.fs.deny bypass on Windows alternate paths, high). Fix available in vite 8.1.0 (major version bump required).

**Recommendation:** Upgrade vite to ^6.4.3+ or ^8.1.0 if feasible. Since vite is a devDependency, these CVEs affect development-time only — not the production extension bundle. However, the fs.deny bypass (GHSA-fx2h-pf6j-xcff) is rated high and should be addressed before the next release.

**References:**
- GHSA-4w7w-66w2-5vf9
- GHSA-v6wh-96g9-6wx3
- GHSA-fx2h-pf6j-xcff


---

### 🟡 ⚠️ `CVE-002` — esbuild <=0.24.2 allows dev server to be accessed by arbitrary websites

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Confidence** | high |
| **Disposition** | should-fix |
| **Category** | dependency-cve |
| **Location** | [webview-ui/package.json#33](#webview-ui/package.json#33) |

**Detail:** npm audit reports esbuild (transitive dependency of vite) has GHSA-67mh-4wv8-2f99: esbuild enables any website to send requests to the development server and read responses (CVSS 5.3, moderate). This affects the Vite dev server used during webview development. Fix available via vite upgrade to 8.1.0.

**Recommendation:** Upgrade vite (which pulls in a patched esbuild). This is a dev-time only vulnerability since esbuild is not bundled in the extension.

**References:**
- GHSA-67mh-4wv8-2f99


---

---

*Report generated deterministically from `report.json` via `scripts/render_report.py`*

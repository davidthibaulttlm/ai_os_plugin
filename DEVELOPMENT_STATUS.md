# AI OS — Development Status & Installation Guide

> **Last Updated**: 2026-06-19
> **Current Phase**: Specification & Architecture (Pre-Implementation)

---

## Project Status Overview

| Component | Status | Details |
|-----------|--------|---------|
| Product Vision | ✅ Complete | [`CONTEXT_FOR_NEW_SESSION.md`](CONTEXT_FOR_NEW_SESSION.md) |
| Architecture Design | ✅ Complete | [`BUILD_GUIDE.md`](BUILD_GUIDE.md) — 1,950 lines of detailed specs |
| OpenSpec Config | ✅ Complete | [`openspec/config.yaml`](openspec/config.yaml) |
| Quality Gates (aislop) | ✅ Complete | [`.github/workflows/aislop.yml`](.github/workflows/aislop.yml) |
| Agent Rules | ✅ Complete | [`AGENTS.md`](AGENTS.md) + per-mode rules in `.roo/rules-*` |
| Extension Source Code | ⏳ Not Started | No `src/`, `webview-ui/`, or `backend/` directories exist yet |
| `package.json` | ⏳ Not Started | Needs to be created per [`BUILD_GUIDE.md`](BUILD_GUIDE.md:207) |
| Python Backend | ⏳ Not Started | No `pyproject.toml` or `backend/` directory |
| VSIX Package | ⏳ Not Started | Depends on code implementation |

---

## What Exists Right Now

The repository contains **specification and planning artifacts only**:

```
ai_os_plugin/
├── AGENTS.md                       # AI agent guidance (product context)
├── BUILD_GUIDE.md                  # Complete implementation guide (1,950 lines)
├── CONTEXT_FOR_NEW_SESSION.md      # Full product context (447 lines)
├── openspec/config.yaml            # OpenSpec workflow config
├── .aislop/                        # Quality gate configuration
├── .github/workflows/aislop.yml    # CI quality gate
├── .roo/                           # Agent mode rules + OpenSpec skills
└── .codebase-memory/               # Knowledge graph (empty, no code indexed)
```

**No source code files exist yet.** The `BUILD_GUIDE.md` contains complete code templates for every file needed.

---

## Installation Instructions

### Phase 1: Prerequisites (Do This Now)

Install these tools before any code is written:

```bash
# 1. Node.js 18+ (check version)
node --version    # Should be 18.x or higher
npm --version

# 2. Python 3.11+
python3 --version  # Should be 3.11+

# 3. uv package manager (Python)
pip install uv
uv --version

# 4. gh CLI (GitHub CLI) — for authentication
gh --version
gh auth login      # Authenticate with your GitHub account

# 5. VS Code (obviously)
code --version

# 6. vsce (VS Code Extension Manager) — for packaging/publishing
npm install -g @vscode/vsce
```

### Phase 2: After Code Implementation Starts

Once source files are created, the setup commands are:

```bash
# 1. Install extension dependencies
npm install

# 2. Install webview dependencies
cd webview-ui && npm install && cd ..

# 3. Install Python backend dependencies
cd backend && uv sync && cd ..

# 4. Start development (3 terminals)
# Terminal 1: Python backend
cd backend && uv run uvicorn src.main:app --reload --port 8000

# Terminal 2: Webview dev server
cd webview-ui && npm run dev

# Terminal 3: Extension watch mode
npm run watch

# 4. Launch VS Code with extension loaded
code --extensionDevelopmentPath=$PWD
```

### Phase 3: Loading the Dev Extension in VS Code

**Method A: Extension Development Host (Recommended for Active Dev)**

```bash
code --extensionDevelopmentPath=$PWD
```

This loads your extension in a new VS Code window. Any changes to TypeScript files will reload automatically (with `npm run watch` running).

**Method B: VS Code Launch Debugger**

Use the built-in debug configuration (once `launch.json` is created):
1. Open `ai_os_plugin` in VS Code
2. Press `F5` or go to Run → Start Debugging
3. Select "Run Extension" configuration

**Method C: Manual VSIX Installation (For Testing Builds)**

```bash
# Build the extension
npm run compile
cd webview-ui && npm run build && cd ..

# Package as VSIX
npx vsce package

# Install the VSIX manually
code --install-extension ai-os-plugin-0.1.0.vsix
```

### Phase 4: Publishing to Marketplace (Future)

```bash
# Login to VS Code Marketplace
npx vsce login your-publisher-id

# Publish
npx vsce publish

# Or publish to Open VSX (alternative registry)
npm install -g ovsx
npx ovsx publish
```

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub PAT (fallback if gh CLI unavailable) | — | No (uses gh CLI) |
| `POLL_INTERVAL` | Seconds between GraphQL polls | `30` | No |
| `BACKEND_PORT` | Python backend port | `8000` | No |
| `LOG_LEVEL` | Logging verbosity | `INFO` | No |

---

## Quality Review Process for All Agents

### Pre-Submission Checklist

Every agent (Code, Architect, Debug) MUST verify their work before reporting completion:

#### Code Mode Agents
- [ ] **No dead imports** — all imports are used
- [ ] **No `any` types** — proper TypeScript types throughout
- [ ] **No console.log in production code** — use proper logging
- [ ] **Error handling** — all async operations have try/catch
- [ ] **aislop clean** — run `aislop scan` on changed files, zero findings
- [ ] **TypeScript compiles** — `npx tsc --noEmit` passes
- [ ] **Follows BUILD_GUIDE patterns** — matches architecture in [`BUILD_GUIDE.md`](BUILD_GUIDE.md)

#### Architect Mode Agents
- [ ] **Consistent with AGENTS.md** — doesn't contradict product decisions
- [ ] **References existing context** — reads [`CONTEXT_FOR_NEW_SESSION.md`](CONTEXT_FOR_NEW_SESSION.md) before designing
- [ ] **Actionable output** — produces specs that Code mode can implement directly
- [ ] **No over-engineering** — keeps scope to what's needed

#### Debug Mode Agents
- [ ] **Root cause identified** — not just symptoms treated
- [ ] **Reproduction steps** — documented how to reproduce
- [ ] **Fix verified** — tested the fix works
- [ ] **No regressions** — checked related code isn't broken

### Review Workflow

```
Agent Works → Agent Self-Reviews (checklist above) → Orchestrator Reviews → aislop Scan → Merge
```

The Orchestrator will:
1. Read the agent's output files
2. Verify against the BUILD_GUIDE.md patterns
3. Run `aislop scan` if source code exists
4. Reject work that doesn't meet standards with specific feedback

---

## Next Steps to Get to MVP

1. **Create project structure** — Initialize `src/`, `webview-ui/`, `backend/` directories
2. **Implement extension entry point** — `package.json`, `tsconfig.json`, `src/extension.ts`
3. **Build Python backend** — `backend/pyproject.toml`, FastAPI app, GraphQL client
4. **Create webview UI** — React app with Kanban board components
5. **Wire up IPC** — Extension ↔ Webview ↔ Backend communication
6. **Implement GitHub auth** — gh CLI token extraction
7. **Build poller** — 30s GraphQL polling with delta detection
8. **Test end-to-end** — Load extension, connect to GitHub, view board

---

## Key Decision Reminders

- **GitHub Projects v2 = GraphQL only** — No REST API exists
- **No database** — State in VS Code Memento + in-memory
- **Fixed 6-column kanban** — Not user-configurable
- **Polling model** — 30s interval, not webhooks
- **Auth via gh CLI** — No separate OAuth flow

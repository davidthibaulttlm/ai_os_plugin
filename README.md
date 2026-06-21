# AI OS — AI-Powered Kanban Automation for GitHub Projects v2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue.svg)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)

Self-hosted VS Code extension that connects to your GitHub account and automates kanban workflows on [GitHub Projects v2](https://docs.github.com/en/issues/planning-and-tracking-with-projects) boards. AI agents automatically work on issues entering `AI_SPEC` / `AI_CODE` columns.

## ✨ Features

- **GitHub Projects v2 Integration** — Connect via `gh` CLI token, no separate OAuth flow
- **Interactive Kanban Board** — Drag-and-drop issue cards across 6 workflow columns
- **AI Agent Auto-Trigger** — When issues enter `AI_SPEC` or `AI_CODE`, Claude Code agents spawn automatically
- **Real-Time Polling** — 30s GraphQL polling keeps your board in sync with external changes
- **MCP Server** — Exposes kanban board state as MCP tools for AI agent integration
- **Repository Management** — Clone project repos into worktrees for agent work
- **Zero Infrastructure** — No database, no webhooks, no tunnels. Everything runs in VS Code

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   VS Code Window                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Webview Panel (React)                 │  │
│  │  - Kanban board with drag-and-drop                │  │
│  │  - Issue cards with status/priority               │  │
│  │  - AI agent progress indicators                   │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ postMessage IPC                │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │           Extension Host (TypeScript)              │  │
│  │  - Commands & Tree views                          │  │
│  │  - Message router (extension ↔ webview)           │  │
│  │  - State persistence via vscode.Memento           │  │
│  │  - Spawns Claude Code agent processes             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │
         │ GraphQL (httpx async)
         ▼
   GitHub Projects v2 API
```

## 📋 Kanban Columns

| # | Column | Description |
|---|--------|-------------|
| 1 | `BRAIN_DUMP` | Raw ideas, not yet specified |
| 2 | `AI_SPEC` | AI agent writes the specification |
| 3 | `HUMAN_SPEC_REVIEW` | Human reviews the spec |
| 4 | `AI_CODE` | AI agent codes the implementation |
| 5 | `HUMAN_CODE_REVIEW` | Human reviews the code |
| 6 | `PR_DONE` | Pull request merged, feature complete |

These columns are **hardcoded constants** — not user-configurable.

## 🚀 Quick Start

### Prerequisites

```bash
# Node.js 18+
node --version

# gh CLI (GitHub CLI) — for authentication
gh --version
gh auth login

# VS Code
code --version

# vsce (for packaging/publishing)
npm install -g @vscode/vsce
```

### Development Setup

```bash
# 1. Clone and install dependencies
git clone https://github.com/your-org/ai-os-plugin.git
cd ai-os-plugin
npm install

# 2. Install webview dependencies
cd webview-ui && npm install && cd ..

# 3. Start development (3 terminals)
# Terminal 1: Extension watch mode
npm run watch

# Terminal 2: Webview dev server
npm run dev:webview

# Terminal 3: Launch VS Code with extension loaded
code --extensionDevelopmentPath=$PWD
```

### Build & Package

```bash
# Build extension
npm run build

# Build webview
npm run build:webview

# Package as VSIX
npm run package

# Publish to marketplace (requires vsce login)
npm run publish
```

## ⚙️ Configuration

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `aiOs.autoWorkColumns` | `["AI_SPEC", "AI_CODE"]` | Columns that trigger auto-work |
| `aiOs.reposDir` | `~/ai-os-repos` | Directory for cloned repos |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | — | Fallback GitHub token (uses `gh` CLI by default) |
| `POLL_INTERVAL` | `30` | GraphQL polling interval in seconds |
| `LOG_LEVEL` | `INFO` | Log verbosity level |

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Extension | VS Code Extension API + TypeScript |
| Frontend | React 18, Vite 5, Tailwind CSS v4, `@dnd-kit` |
| Styling | Tailwind CSS v4 (CSS-first config via `@theme`) |
| HTTP | `httpx` (async GraphQL) |
| State | VS Code Memento (`context.globalState`) + in-memory |
| Testing | Vitest with V8 coverage |
| Quality | aislop (code quality gates) |

## 🧪 Testing

```bash
# Run all tests with coverage
npm test

# Watch mode
npm run test:watch
```

## 📖 Documentation

- **[BUILD_GUIDE.md](BUILD_GUIDE.md)** — Complete implementation guide (architecture, code patterns, API details)
- **[AGENTS.md](AGENTS.md)** — AI agent guidance and development rules
- **[DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)** — Current development phase and installation guide

## 🔑 Key Design Decisions

1. **GraphQL-only for Projects v2** — GitHub Projects v2 has no REST API
2. **Async throughout** — `httpx` async client, async FastAPI handlers
3. **Delta detection via in-memory diffing** — Compare each poll result against last-known state
4. **Fixed kanban template** — Not user-configurable for consistency
5. **VS Code extension** — Eliminates webhook infrastructure (no tunnels needed)
6. **No database** — State persists via VS Code Memento and in-memory only

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the rules in [AGENTS.md](AGENTS.md)
4. Run tests (`npm test`) and ensure 90%+ coverage
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Rules

- **Logger in every file** — Every method must log using the `logger` utility
- **One test file per method** — Never clump multiple methods into one test file
- **90% code coverage** is mandatory on all new/modified files
- **aislop quality gates** run on every edit via CI

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🔗 Links

- [GitHub Issues](https://github.com/your-org/ai-os-plugin/issues)
- [GitHub Projects v2 Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)

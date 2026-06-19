# AI OS — VS Code Extension Build Guide

> **Purpose**: Complete implementation guide for building the AI OS VS Code extension. This document contains everything an agent needs to implement the extension from scratch, including architecture, code patterns, API details, and development workflow.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [System Architecture](#2-system-architecture)
3. [Project Structure](#3-project-structure)
4. [VS Code Extension Setup](#4-vs-code-extension-setup)
5. [Webview with React](#5-webview-with-react)
6. [Python Backend](#6-python-backend)
7. [GitHub GraphQL API](#7-github-graphql-api)
8. [State Management](#8-state-management)
9. [IPC Communication](#9-ipc-communication)
10. [Kanban Board Implementation](#10-kanban-board-implementation)
11. [AI Agent Workflow](#11-ai-agent-workflow)
12. [Development Workflow](#12-development-workflow)
13. [Testing Strategy](#13-testing-strategy)
14. [Publishing](#14-publishing)
15. [Reference Links](#15-reference-links)

---

## 1. Product Overview

**AI OS** is a self-hosted VS Code extension that:

- Connects to the user's GitHub account via `gh` CLI token
- Displays kanban boards from GitHub Projects v2
- Allows drag-and-drop to move items between columns
- Polls project state every 30s for external changes
- Triggers AI agents when issues enter `AI_SPEC` or `AI_CODE` columns
- Shows AI agent progress in the IDE

### Key Concept: GitHub Projects v2

A **GitHub Project v2** is a kanban board that aggregates issues and PRs from **multiple repositories**. The extension queries the **Project**, not individual repos. One project = one kanban board = items from many repos.

### Fixed Kanban Columns

| Order | Column | Description |
|-------|--------|-------------|
| 1 | `BRAIN_DUMP` | Raw ideas, not yet specified |
| 2 | `AI_SPEC` | AI agent is writing the specification |
| 3 | `HUMAN_SPEC_REVIEW` | Human reviews the spec |
| 4 | `AI_CODE` | AI agent is coding the implementation |
| 5 | `HUMAN_CODE_REVIEW` | Human reviews the code |
| 6 | `PR_DONE` | Pull request merged, feature complete |

These columns are **hardcoded constants**, not user-configurable.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Window                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Webview Panel                          │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │           React Kanban Board UI                  │  │  │
│  │  │  - Drag & Drop columns                          │  │  │
│  │  │  - Issue cards with status/priority              │  │  │
│  │  │  - AI agent progress indicators                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                    ↕ postMessage IPC                   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Extension Host (TypeScript)               │  │
│  │  - Commands: "AI OS: Open Board", "AI OS: Assign..."  │  │  │
│  │  - Webview provider                                    │  │  │
│  │  - Message router (extension ↔ webview)               │  │  │
│  │  - Spawns Python backend process                       │  │  │
│  │  - State persistence via vscode.Memento                │  │  │
│  │  - Notifications / Status bar                          │  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Python Backend (FastAPI)                     │  │  │
│  │  - GitHub GraphQL client (httpx)                      │  │  │
│  │  - Background poller (30s interval)                    │  │  │
│  │  - Delta detection engine                              │  │  │
│  │  - AI agent trigger                                    │  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↕ GraphQL (authenticated via gh CLI token)
┌─────────────────────────────────────────────────────────────┐
│              GitHub GraphQL API                              │
│  - Projects v2 queries and mutations                         │
│  - Rate limit: 5,000 points/hour                             │
└─────────────────────────────────────────────────────────────┘
```

### Communication Flow

1. **Webview → Extension**: `panel.webview.postMessage()` from React
2. **Extension → Webview**: `webview.onDidReceiveMessage()` handler in TypeScript
3. **Extension → Python**: stdin/stdout JSON-RPC or HTTP (FastAPI on localhost)
4. **Python → Extension**: stdout JSON responses or HTTP callbacks

### State Persistence

- **In-memory state**: Current board state held in extension host memory
- **Persistent state**: `vscode.Memento` (`context.globalState`) for settings, selected board, auth state
- **Webview state**: `acquireVsCodeApi().getState()` / `setState()` for webview persistence across panel hides
- **Delta detection**: Compare in-memory poll results; no database needed

### Asymmetric Latency Model

| Direction | Action | Latency | User Perception |
|-----------|--------|---------|-----------------|
| **Outbound** | User moves card, assigns agent | **Instant** (GraphQL mutation) | Feels responsive |
| **Inbound** | Teammate changes, AI updates | **~30s** (GraphQL polling) | Acceptable (user is coding) |

---

## 3. Project Structure

```
ai_os_plugin/
├── package.json                    # VS Code extension manifest
├── tsconfig.json                   # TypeScript config for extension
├── esbuild.js                      # Build script (extension + webview)
│
├── src/                            # Extension source (TypeScript)
│   ├── extension.ts                # Entry point: activate(), deactivate()
│   ├── providers/
│   │   └── KanbanPanel.ts          # Webview panel provider
│   ├── services/
│   │   ├── github.ts               # GitHub GraphQL client wrapper
│   │   ├── auth.ts                 # gh CLI token management
│   │   ├── poller.ts               # Background poller service
│   │   ├── backend.ts              # Python backend process manager
│   │   └── state.ts                # Memento-based state management
│   ├── commands/
│   │   ├── openBoard.ts            # AI OS: Open Board
│   │   ├── assignAgent.ts          # AI OS: Assign Agent
│   │   └── moveColumn.ts           # AI OS: Move to AI_CODE, etc.
│   └── types/
│       ├── ipc.ts                  # IPC message types
│       └── github.ts               # GitHub API type definitions
│
├── webview-ui/                     # React webview app
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts              # Vite config for webview
│   ├── src/
│   │   ├── index.tsx               # React entry point
│   │   ├── App.tsx                 # Main app component
│   │   ├── vscode.d.ts             # Type declarations for acquireVsCodeApi
│   │   ├── components/
│   │   │   ├── KanbanBoard.tsx     # Board container
│   │   │   ├── KanbanColumn.tsx    # Single column (draggable)
│   │   │   ├── IssueCard.tsx       # Issue/PR card
│   │   │   └── Header.tsx          # Board header with controls
│   │   ├── hooks/
│   │   │   └── useVsCode.ts        # IPC hook for VS Code communication
│   │   ├── store/
│   │   │   └── boardStore.ts       # Zustand store for board state
│   │   └── styles/
│   │       └── index.css           # Global styles (Tailwind or custom)
│   └── index.html
│
├── backend/                        # Python FastAPI backend
│   ├── pyproject.toml              # uv project config
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── api/
│   │   │   └── routes.py           # API endpoints
│   │   ├── github/
│   │   │   ├── client.py           # httpx GraphQL client
│   │   │   ├── queries.py          # GraphQL query strings
│   │   │   ├── mutations.py        # GraphQL mutation strings
│   │   │   └── templates.py        # Kanban column constants
│   │   ├── services/
│   │   │   ├── poller.py           # Background polling service
│   │   │   ├── delta.py            # Delta detection logic
│   │   │   └── agent.py            # AI agent trigger service
│   │   └── events/
│   │       └── handlers.py         # Event processing
│   └── tests/
│       ├── test_github.py
│       ├── test_delta.py
│       └── test_poller.py
│
├── .vscode/
│   ├── launch.json                 # Debug configurations
│   └── tasks.json                  # Build tasks
│
├── AGENTS.md                       # AI agent guidance
├── CONTEXT_FOR_NEW_SESSION.md      # Full product context
├── BUILD_GUIDE.md                  # This file
└── .gitignore
```

---

## 4. VS Code Extension Setup

### 4.1 package.json

```json
{
  "name": "ai-os-plugin",
  "displayName": "AI OS",
  "description": "AI-powered kanban automation for GitHub Projects v2",
  "version": "0.1.0",
  "publisher": "your-publisher",
  "engines": {
    "vscode": "^1.85.0"
  },
  "extensionKind": ["ui", "workspace"],
  "categories": ["Other", "SCM Providers"],
  "activationEvents": [
    "onCommand:aiOs.openBoard",
    "onCommand:aiOs.assignAgent",
    "onWebviewPanel:aiOs.kanbanPanel"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "aiOs.openBoard",
        "title": "Open Board",
        "category": "AI OS"
      },
      {
        "command": "aiOs.assignAgent",
        "title": "Assign Agent",
        "category": "AI OS"
      },
      {
        "command": "aiOs.refreshBoard",
        "title": "Refresh Board",
        "category": "AI OS"
      },
      {
        "command": "aiOs.moveToAISpec",
        "title": "Move to AI_SPEC",
        "category": "AI OS"
      },
      {
        "command": "aiOs.moveToAICode",
        "title": "Move to AI_CODE",
        "category": "AI OS"
      }
    ],
    "menus": {
      "view/item/context": [
        {
          "command": "aiOs.assignAgent",
          "when": "viewItem == aiOsIssue"
        }
      ]
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "aiOs",
          "title": "AI OS",
          "icon": "resources/icons/ai-os.svg"
        }
      ]
    },
    "views": {
      "aiOs": [
        {
          "type": "webview",
          "id": "aiOs.kanbanPanel",
          "name": "Kanban Board"
        }
      ]
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "compile": "node esbuild.js --production",
    "watch": "node esbuild.js --watch",
    "build": "node esbuild.js --production",
    "build:webview": "cd webview-ui && npm run build",
    "dev:webview": "cd webview-ui && npm run dev",
    "package": "vsce package",
    "publish": "vsce publish",
    "lint": "eslint src --ext ts",
    "test": "vscode-test"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.19.0",
    "@vscode/vsce": "^2.21.0",
    "@vscode/test-cli": "^0.0.4",
    "@vscode/test-electron": "^2.3.8"
  },
  "dependencies": {
    "@vscode/webview-ui-toolkit": "^1.0.0"
  }
}
```

### 4.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", ".vscode-test", "webview-ui"]
}
```

### 4.3 esbuild.js

```javascript
const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    outdir: "dist",
    external: ["vscode"],
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

### 4.4 Extension Entry Point (src/extension.ts)

```typescript
import * as vscode from 'vscode';
import { KanbanPanel } from './providers/KanbanPanel';
import { AuthService } from './services/auth';
import { BackendService } from './services/backend';
import { StateManager } from './services/state';

let panel: KanbanPanel | undefined;
let backend: BackendService | undefined;
let stateManager: StateManager | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log('AI OS extension activated');

  // Initialize state manager (uses vscode.Memento)
  stateManager = new StateManager(context.globalState);

  // Initialize auth service
  const authService = new AuthService();

  // Check gh CLI token
  const token = await authService.getGitHubToken();
  if (!token) {
    const response = await vscode.window.showWarningMessage(
      'GitHub CLI not authenticated. Please run `gh auth login`.',
      'Open gh CLI Docs',
      'Dismiss'
    );
    if (response === 'Open gh CLI Docs') {
      vscode.env.openExternal(vscode.Uri.parse('https://cli.github.com/manual/gh_auth_login'));
    }
    return;
  }

  // Start Python backend
  backend = new BackendService(context.extensionUri, token);
  await backend.start();

  // Restore last selected board from state
  const lastBoardId = stateManager.getLastBoardId();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('aiOs.openBoard', async () => {
      if (panel) {
        panel.reveal(vscode.ViewColumn.One);
        return;
      }
      panel = KanbanPanel.createOrShow(context.extensionUri, backend!, lastBoardId);
    }),

    vscode.commands.registerCommand('aiOs.assignAgent', () => {
      vscode.window.showInformationMessage('Assign Agent clicked');
    }),

    vscode.commands.registerCommand('aiOs.refreshBoard', async () => {
      if (panel) {
        await panel.refresh();
      }
    }),

    vscode.commands.registerCommand('aiOs.moveToAISpec', async () => {
      // Move selected item to AI_SPEC column
    }),

    vscode.commands.registerCommand('aiOs.moveToAICode', async () => {
      // Move selected item to AI_CODE column
    })
  );
}

export function deactivate() {
  backend?.stop();
  panel?.dispose();
}
```

### 4.5 State Manager (src/services/state.ts)

```typescript
import * as vscode from 'vscode';

/**
 * Manages persistent state using VS Code's Memento API.
 * No database needed — VS Code handles persistence.
 */
export class StateManager {
  private static readonly LAST_BOARD_KEY = 'aiOs.lastBoardId';
  private static readonly BOARD_STATE_KEY = 'aiOs.boardState.';

  constructor(private readonly globalState: vscode.Memento) {}

  // Board selection
  getLastBoardId(): string | undefined {
    return this.globalState.get<string>(StateManager.LAST_BOARD_KEY);
  }

  async setLastBoardId(boardId: string): Promise<void> {
    await this.globalState.update(StateManager.LAST_BOARD_KEY, boardId);
  }

  // Board cache (last known state for delta detection)
  getLastBoardState(boardId: string): any {
    return this.globalState.get<any>(`${StateManager.BOARD_STATE_KEY}${boardId}`);
  }

  async setBoardState(boardId: string, state: any): Promise<void> {
    await this.globalState.update(`${StateManager.BOARD_STATE_KEY}${boardId}`, state);
  }

  // Clear all stored state
  async clearAll(): Promise<void> {
    await this.globalState.update(StateManager.LAST_BOARD_KEY, undefined);
  }
}
```

### 4.6 Webview Panel Provider (src/providers/KanbanPanel.ts)

```typescript
import * as vscode from 'vscode';
import { BackendService } from '../services/backend';
import { IPCMessage } from '../types/ipc';

export class KanbanPanel {
  public static currentPanel: KanbanPanel | undefined;
  private static readonly viewType = 'aiOs.kanbanPanel';

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private readonly _backend: BackendService;

  private constructor(panel: vscode.WebviewPanel, backend: BackendService, initialBoardId?: string) {
    this._panel = panel;
    this._backend = backend;

    this._panel.iconPath = vscode.Uri.joinPath(
      this._panel.webview.asWebviewUri(vscode.Uri.file('/resources/icons/ai-os.svg'))
    );

    // Set webview HTML
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message: IPCMessage) => {
        try {
          switch (message.type) {
            case 'loadBoard':
              const boardData = await this._backend.getBoard(message.boardId);
              this._panel.webview.postMessage({
                type: 'boardData',
                data: boardData
              });
              break;

            case 'moveItem':
              const result = await this._backend.moveItem(message.itemId, message.columnId);
              this._panel.webview.postMessage({
                type: 'itemMoved',
                data: result
              });
              break;

            case 'refresh':
              const refreshed = await this._backend.refreshBoard();
              this._panel.webview.postMessage({
                type: 'boardData',
                data: refreshed
              });
              break;
          }
        } catch (error) {
          this._panel.webview.postMessage({
            type: 'error',
            data: { message: (error as Error).message }
          });
        }
      },
      undefined,
      this._disposables
    );

    // Reset when panel is closed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri, backend: BackendService, initialBoardId?: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Reuse existing panel
    if (KanbanPanel.currentPanel) {
      KanbanPanel.currentPanel._panel.reveal(column);
      return KanbanPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      KanbanPanel.viewType,
      'AI OS Kanban',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui/dist')
        ],
        retainContextWhenHidden: true
      }
    );

    KanbanPanel.currentPanel = new KanbanPanel(panel, backend, initialBoardId);
    return KanbanPanel.currentPanel;
  }

  public async refresh() {
    const data = await this._backend.refreshBoard();
    this._panel.webview.postMessage({
      type: 'boardData',
      data
    });
  }

  public dispose() {
    KanbanPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const item = this._disposables.pop();
      if (item) item.dispose();
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        vscode.Uri.file(__dirname),
        '../../webview-ui/dist/assets/index.js'
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        vscode.Uri.file(__dirname),
        '../../webview-ui/dist/assets/index.css'
      )
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>AI OS Kanban</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

---

## 5. Webview with React

### 5.1 webview-ui/package.json

```json
{
  "name": "ai-os-webview",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

### 5.2 vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  server: {
    strictPort: true,
    port: 5173
  }
});
```

### 5.3 VS Code API Type Declaration (webview-ui/src/vscode.d.ts)

```typescript
interface VsCodeApi {
  postMessage(message: any): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
}

declare function acquireVsCodeApi(): VsCodeApi;
```

### 5.4 IPC Hook (webview-ui/src/hooks/useVsCode.ts)

```typescript
import { useEffect, useState, useCallback } from 'react';

interface VsCodeApi {
  postMessage(message: any): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
}

let vsCodeApi: VsCodeApi;

export function initVsCode() {
  // @ts-ignore - acquireVsCodeApi exists in webview context
  vsCodeApi = window.acquireVsCodeApi();
}

export function useVsCode() {
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    initVsCode();

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'boardData':
          setState(message.data);
          // Persist in webview state for panel hide/show
          vsCodeApi.setState({ boardData: message.data });
          break;
        case 'itemMoved':
          setState(prev => ({
            ...prev,
            items: prev.items.map((item: any) =>
              item.id === message.data.id ? { ...item, ...message.data } : item
            )
          }));
          break;
        case 'error':
          console.error('Webview error:', message.data);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const postMessage = useCallback((type: string, data?: any) => {
    vsCodeApi.postMessage({ type, data });
  }, []);

  return { state, postMessage };
}
```

### 5.5 Board Store (webview-ui/src/store/boardStore.ts)

```typescript
import { create } from 'zustand';

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
}

export interface IssueItem {
  id: string;
  type: 'ISSUE' | 'PULL_REQUEST';
  title: string;
  number: number;
  status: string;
  url: string;
  repo: string;
  priority?: string;
  labels?: string[];
}

interface BoardState {
  columns: KanbanColumn[];
  items: IssueItem[];
  loading: boolean;
  error: string | null;
  setBoardData: (columns: KanbanColumn[], items: IssueItem[]) => void;
  updateItem: (id: string, updates: Partial<IssueItem>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  columns: [],
  items: [],
  loading: false,
  error: null,
  setBoardData: (columns, items) => set({ columns, items, loading: false }),
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

### 5.6 Main App (webview-ui/src/App.tsx)

```typescript
import { useEffect } from 'react';
import { useVsCode } from './hooks/useVsCode';
import { useBoardStore } from './store/boardStore';
import KanbanBoard from './components/KanbanBoard';

export default function App() {
  const { state, postMessage } = useVsCode();
  const { setBoardData, setLoading } = useBoardStore();

  useEffect(() => {
    // Request board data on mount
    setLoading(true);
    postMessage('loadBoard', { boardId: 'default' });
  }, [postMessage, setLoading]);

  useEffect(() => {
    if (state) {
      setBoardData(state.columns, state.items);
    }
  }, [state, setBoardData]);

  return (
    <div className="h-screen flex flex-col">
      <KanbanBoard onMoveItem={(itemId, columnId) => {
        postMessage('moveItem', { itemId, columnId });
      }} />
    </div>
  );
}
```

### 5.7 Kanban Board Component (webview-ui/src/components/KanbanBoard.tsx)

```typescript
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { useBoardStore } from '../store/boardStore';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  onMoveItem: (itemId: string, columnId: string) => void;
}

export default function KanbanBoard({ onMoveItem }: KanbanBoardProps) {
  const { columns, items } = useBoardStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the column the item was dropped on
    const droppedColumn = columns.find(col => col.id === overId);
    if (droppedColumn) {
      onMoveItem(activeId, droppedColumn.id);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-4 overflow-x-auto h-full">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            items={items.filter(item => item.status === column.name)}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

---

## 6. Python Backend

### 6.1 pyproject.toml

```toml
[project]
name = "ai-os-backend"
version = "0.1.0"
description = "AI OS VS Code Extension Backend"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "httpx>=0.26.0",
    "pydantic>=2.5.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "ruff>=0.2.0",
]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### 6.2 Backend Entry Point (backend/src/main.py)

```python
import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import router
from src.services.poller import start_poller, stop_poller

app = FastAPI(title="AI OS Backend", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.on_event("startup")
async def startup():
    # Start background poller
    asyncio.create_task(start_poller())

@app.on_event("shutdown")
async def shutdown():
    await stop_poller()

def main():
    """Run FastAPI on localhost."""
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

if __name__ == "__main__":
    main()
```

### 6.3 GitHub GraphQL Client (backend/src/github/client.py)

```python
import httpx
from typing import Any, Optional

GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"

class GitHubGraphQLClient:
    """Async GraphQL client for GitHub Projects v2 API."""

    def __init__(self, token: str):
        self.token = token
        self._client = httpx.AsyncClient(
            base_url=GITHUB_GRAPHQL_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/vnd.github+json",
            },
            timeout=30.0,
        )

    async def execute(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute a GraphQL query or mutation."""
        response = await self._client.post(
            "",
            json={"query": query, "variables": variables or {}},
        )
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            raise GitHubAPIError(data["errors"])
        return data["data"]

    async def close(self):
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        await self.close()

class GitHubAPIError(Exception):
    def __init__(self, errors: list[dict]):
        self.errors = errors
        super().__init__(f"GitHub API error: {errors}")
```

### 6.4 GraphQL Queries (backend/src/github/queries.py)

```python
# List all projects for the authenticated user (viewer + orgs)
LIST_PROJECTS_QUERY = """
query ListProjects($first: Int = 100) {
  viewer {
    login
    projectsV2(first: $first) {
      nodes {
        id
        title
        url
        number
      }
    }
    organizations(first: 100) {
      nodes {
        login
        projectsV2(first: $first) {
          nodes {
            id
            title
            url
            number
          }
        }
      }
    }
  }
}
"""

# Get project items with all field values
GET_PROJECT_ITEMS_QUERY = """
query GetProjectItems($id: ID!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      title
      url
      number
      items(first: 50, after: $after) {
        nodes {
          id
          databaseId
          type
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                id
                field {
                  ... on ProjectV2FieldCommon {
                    name
                    id
                  }
                }
              }
              ... on ProjectV2ItemFieldTextValue {
                name
                text
                field {
                  ... on ProjectV2FieldCommon {
                    name
                    id
                  }
                }
              }
              ... on ProjectV2ItemFieldNumberValue {
                name
                number
                field {
                  ... on ProjectV2FieldCommon {
                    name
                    id
                  }
                }
              }
              ... on ProjectV2ItemFieldDateValue {
                name
                date
                field {
                  ... on ProjectV2FieldCommon {
                    name
                    id
                  }
                }
              }
            }
          }
          content {
            ... on Issue {
              id
              number
              title
              url
              state
              repository {
                id
                name
                owner { login }
              }
              labels(first: 10) {
                nodes { name, color }
              }
            }
            ... on PullRequest {
              id
              number
              title
              url
              state
              repository {
                id
                name
                owner { login }
              }
              labels(first: 10) {
                nodes { name, color }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
"""

# Get project fields (columns/options)
GET_PROJECT_FIELDS_QUERY = """
query GetProjectFields($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      fields(first: 30) {
        nodes {
          ... on ProjectV2SingleSelectField {
            name
            id
            options {
              id
              name
              color
            }
          }
          ... on ProjectV2Field {
            name
            id
          }
        }
      }
    }
  }
}
"""
```

### 6.5 GraphQL Mutations (backend/src/github/mutations.py)

```python
# Update item field value (move card between columns)
UPDATE_ITEM_FIELD_MUTATION = """
mutation UpdateItemField($input: UpdateProjectV2ItemFieldValueInput!) {
  updateProjectV2ItemFieldValue(input: $input) {
    success
  }
}
"""
# Input variables:
# {
#   "input": {
#     "projectId": "PVT_lADO...",
#     "itemId": "PVTI_lADO...",
#     "fieldId": "PVTSSF_lADO...",
#     "value": { "singleSelectOptionId": "option-id-here" }
#   }
# }

# Add item to project
ADD_ITEM_TO_PROJECT_MUTATION = """
mutation AddItemToProject($input: AddProjectV2ItemByIdInput!) {
  addProjectV2ItemById(input: $input) {
    item {
      id
    }
  }
}
"""
# Input: { "input": { "projectId": "...", "contentId": "..." } }

# Remove item from project
REMOVE_ITEM_FROM_PROJECT_MUTATION = """
mutation RemoveItemFromProject($input: RemoveProjectV2ItemInput!) {
  removeProjectV2Item(input: $input) {
    success
  }
}
"""
# Input: { "input": { "projectId": "...", "itemId": "..." } }

# Add comment to issue
ADD_COMMENT_MUTATION = """
mutation AddComment($input: AddCommentInput!) {
  addComment(input: $input) {
    commentEdge {
      node {
        id
        body
      }
    }
  }
}
"""
# Input: { "input": { "subjectId": "ISSUE_NODE_ID", "body": "comment text" } }

# Update issue body
UPDATE_ISSUE_MUTATION = """
mutation UpdateIssue($input: UpdateIssueInput!) {
  updateIssue(input: $input) {
    issue {
      id
      body
    }
  }
}
"""
```

### 6.6 Kanban Column Constants (backend/src/github/templates.py)

```python
"""Fixed kanban column constants — not user-configurable."""

from dataclasses import dataclass

@dataclass(frozen=True)
class KanbanColumn:
    name: str
    description: str
    ai_triggered: bool = False

# Fixed 6-column kanban template
BRAIN_DUMP = KanbanColumn(
    name="BRAIN_DUMP",
    description="Raw ideas, not yet specified"
)

AI_SPEC = KanbanColumn(
    name="AI_SPEC",
    description="AI agent is writing the specification",
    ai_triggered=True
)

HUMAN_SPEC_REVIEW = KanbanColumn(
    name="HUMAN_SPEC_REVIEW",
    description="Human reviews the spec"
)

AI_CODE = KanbanColumn(
    name="AI_CODE",
    description="AI agent is coding the implementation",
    ai_triggered=True
)

HUMAN_CODE_REVIEW = KanbanColumn(
    name="HUMAN_CODE_REVIEW",
    description="Human reviews the code"
)

PR_DONE = KanbanColumn(
    name="PR_DONE",
    description="Pull request merged, feature complete"
)

# Ordered list for rendering
COLUMNS: tuple[KanbanColumn, ...] = (
    BRAIN_DUMP,
    AI_SPEC,
    HUMAN_SPEC_REVIEW,
    AI_CODE,
    HUMAN_CODE_REVIEW,
    PR_DONE,
)

# Columns that trigger AI agent
AI_TRIGGER_COLUMNS: frozenset[str] = frozenset({
    AI_SPEC.name,
    AI_CODE.name,
})
```

### 6.7 Delta Detection Service (backend/src/services/delta.py)

```python
"""Delta detection: compare poll results against in-memory state."""

from typing import Any

class DeltaEvent:
    def __init__(self, issue_id: int, event_type: str, data: dict[str, Any]):
        self.issue_id = issue_id
        self.event_type = event_type
        self.data = data

def detect_deltas(
    last_known_state: dict[int, dict[str, Any]],
    current_items: list[dict[str, Any]],
) -> list[DeltaEvent]:
    """Compare current poll result against last known in-memory state."""
    events: list[DeltaEvent] = []

    # Build lookup maps
    poll_map = {item["github_id"]: item for item in current_items}

    # Detect new items and status changes
    for github_id, item in poll_map.items():
        stored = last_known_state.get(github_id)
        if not stored:
            # New item
            events.append(DeltaEvent(
                issue_id=github_id,
                event_type="item_added",
                data={"status": item.get("status"), "title": item.get("title")}
            ))
        elif stored.get("status") != item.get("status"):
            # Status changed
            events.append(DeltaEvent(
                issue_id=github_id,
                event_type="status_changed",
                data={
                    "from_status": stored.get("status"),
                    "to_status": item.get("status"),
                }
            ))

    # Detect removed items
    for github_id, stored in last_known_state.items():
        if github_id not in poll_map:
            events.append(DeltaEvent(
                issue_id=github_id,
                event_type="item_removed",
                data={"previous_status": stored.get("status")}
            ))

    return events
```

### 6.8 Poller Service (backend/src/services/poller.py)

```python
import asyncio
import logging
from src.github.client import GitHubGraphQLClient
from src.github.queries import GET_PROJECT_ITEMS_QUERY
from src.services.delta import detect_deltas

logger = logging.getLogger(__name__)

POLL_INTERVAL = 30  # seconds
_poller_task: asyncio.Task | None = None

# In-memory state for delta detection
_last_board_state: dict[int, dict] = {}

async def start_poller():
    global _poller_task
    if _poller_task and not _poller_task.done():
        return
    _poller_task = asyncio.create_task(_poll_loop())

async def stop_poller():
    global _poller_task
    if _poller_task:
        _poller_task.cancel()
        try:
            await _poller_task
        except asyncio.CancelledError:
            pass

async def _poll_loop():
    """Main polling loop: fetch board state, detect deltas, process events."""
    while True:
        try:
            await asyncio.sleep(POLL_INTERVAL)
            await _poll_boards()
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Poller error")

async def _poll_boards():
    """Poll all registered boards."""
    # For each board, fetch items and detect changes against in-memory state
    pass  # Implementation depends on board registry
```

---

## 7. GitHub GraphQL API

### 7.1 Authentication

The extension uses the `gh` CLI token. Read it via:

```bash
gh auth token
```

Required scopes for the token:
```
repo,project,read:org
```

Login command users should run:
```bash
gh auth login --scopes gist,read:org,repo,workflow,project
```

### 7.2 Rate Limits

| Metric | Value |
|--------|-------|
| Points per hour | 5,000 (authenticated) |
| Points per minute | 2,000 (hard cap) |
| Typical poll cost | 5-15 points |
| Polls per hour at 30s | 120 |
| Points per hour polling | 600-1,800 |
| Concurrent boards | 2-8 (depends on size) |

### 7.3 Key Query Patterns

**List all projects (user + orgs):**
```graphql
query {
  viewer {
    login
    projectsV2(first: 100) {
      nodes { id, title, url, number }
    }
    organizations(first: 100) {
      nodes {
        login
        projectsV2(first: 100) {
          nodes { id, title, url, number }
        }
      }
    }
  }
}
```

**Get project items with Status field:**
```graphql
query($id: ID!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: 50, after: $after) {
        nodes {
          id
          type
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
          content {
            ... on Issue {
              id, number, title, url
              repository { id, name, owner { login } }
            }
            ... on PullRequest {
              id, number, title, url
              repository { id, name, owner { login } }
            }
          }
        }
        pageInfo { hasNextPage, endCursor }
      }
    }
  }
}
```

**Move card (update Status field):**
```graphql
mutation($input: UpdateProjectV2ItemFieldValueInput!) {
  updateProjectV2ItemFieldValue(input: $input) {
    success
  }
}
```
Variables:
```json
{
  "input": {
    "projectId": "PVT_lADO...",
    "itemId": "PVTI_lADO...",
    "fieldId": "PVTSSF_lADO...",
    "value": { "singleSelectOptionId": "option-id" }
  }
}
```

### 7.4 Pagination

GitHub Projects v2 uses cursor-based pagination. Always check `pageInfo.hasNextPage` and use `pageInfo.endCursor` as the `after` parameter for the next page.

---

## 8. State Management

### 8.1 VS Code Memento (Extension Host)

All persistent state lives in VS Code's `Memento` API — no database needed:

```typescript
// Save
await context.globalState.update('aiOs.lastBoardId', 'PVT_lADO...');

// Load
const lastBoardId = context.globalState.get<string>('aiOs.lastBoardId');
```

**What to store in globalState:**
- Last selected board ID
- Board column mapping (field IDs → column names)
- User preferences (theme, refresh interval)
- Auth state (last successful auth timestamp)

### 8.2 Webview State

The webview uses `acquireVsCodeApi()` for state that survives panel hide/show:

```typescript
const vsCodeApi = acquireVsCodeApi();

// Save
vsCodeApi.setState({ boardData: currentBoard });

// Load (on panel restore)
const saved = vsCodeApi.getState();
```

### 8.3 In-Memory State

- **Extension host**: Current board state held in TypeScript objects
- **Python backend**: In-memory dict for last-known board state (delta detection)
- **Webview**: Zustand store for React component state

### 8.4 Delta Detection Flow

```
1. Poll GitHub GraphQL → get current board state
2. Compare against in-memory last-known state
3. Detect: new items, status changes, removed items
4. Update in-memory state with new data
5. Push changes to webview via IPC
6. Persist board mapping in vscode.globalState
```

---

## 9. IPC Communication

### 9.1 Message Types (src/types/ipc.ts)

```typescript
/** Messages from Webview → Extension */
export interface IPCMessage {
  type: string;
  data?: any;
}

export type WebviewToExtension =
  | { type: 'loadBoard'; data: { boardId: string } }
  | { type: 'moveItem'; data: { itemId: string; columnId: string } }
  | { type: 'refresh'; data?: never }
  | { type: 'selectIssue'; data: { issueId: string } }
  | { type: 'assignAgent'; data: { issueId: string } };

/** Messages from Extension → Webview */
export type ExtensionToWebview =
  | { type: 'boardData'; data: BoardData }
  | { type: 'itemMoved'; data: MovedItem }
  | { type: 'error'; data: { message: string } }
  | { type: 'agentProgress'; data: { issueId: string; status: string } };

export interface BoardData {
  columns: { id: string; name: string; color: string }[];
  items: {
    id: string;
    type: 'ISSUE' | 'PULL_REQUEST';
    title: string;
    number: number;
    status: string;
    url: string;
    repo: string;
    priority?: string;
    labels?: string[];
  }[];
}

export interface MovedItem {
  id: string;
  status: string;
}
```

### 9.2 Important IPC Rules

- **Webview runs in a sandbox** — No `localStorage`, no `document.cookie`, no direct DOM access to parent
- **Use `acquireVsCodeApi()`** for persistent state (`getState`/`setState`)
- **Messages fail silently** — Always wrap IPC handlers in try/catch
- **CSP is mandatory** — The webview Content-Security-Policy must allow scripts from the correct source

---

## 10. Kanban Board Implementation

### 10.1 Column Mapping

The fixed columns map to GitHub Project v2 single-select field options. When the extension loads a board, it must:

1. Fetch the project's fields via `GET_PROJECT_FIELDS_QUERY`
2. Find the "Status" field (or equivalent single-select)
3. Map each option's `id` to our column constants
4. Store the mapping in `vscode.globalState` for reuse

### 10.2 Drag and Drop

Use `@dnd-kit/core` for drag-and-drop. When a card is dropped on a new column:

1. Webview sends `moveItem` message with `itemId` and target `columnId`
2. Extension calls Python backend to execute `UPDATE_ITEM_FIELD_MUTATION`
3. Backend returns result, extension sends `itemMoved` back to webview
4. Webview updates local state optimistically

### 10.3 Optimistic Updates

For better UX, update the UI immediately when the user drops a card, then reconcile with the server response. If the server fails, revert the change and show an error toast.

---

## 11. AI Agent Workflow

### 11.1 Trigger Conditions

AI agent triggers when an issue enters these columns:

| Column | Action |
|--------|--------|
| `AI_SPEC` | Generate technical specification from issue description |
| `AI_CODE` | Generate code implementation from approved spec |

### 11.2 Agent Output

The agent writes output as:
- **Comments** on the issue (for specs and code reviews)
- **Issue body updates** (for status tracking)

### 11.3 State Machine

```
BRAIN_DUMP → [user moves] → AI_SPEC → [AI writes spec] → HUMAN_SPEC_REVIEW
                                                        → [human approves] → AI_CODE → [AI writes code] → HUMAN_CODE_REVIEW
                                                                                                          → [human approves] → PR_DONE
                                                        ← [human requests changes]
                                                                 ← [human requests changes]
```

---

## 12. Development Workflow

### 12.1 Prerequisites

- Node.js 18+
- Python 3.11+
- `uv` package manager (`pip install uv`)
- `gh` CLI authenticated (`gh auth login`)
- VS Code installed

### 12.2 Setup Commands

```bash
# 1. Clone and enter project
cd ai_os_plugin

# 2. Install extension dependencies
npm install

# 3. Install webview dependencies
cd webview-ui && npm install && cd ..

# 4. Install Python backend dependencies
cd backend && uv sync && cd ..

# 5. Start development
# Terminal 1: Python backend
cd backend && uv run uvicorn src.main:app --reload --port 8000

# Terminal 2: Webview dev server
cd webview-ui && npm run dev

# Terminal 3: Extension watch mode
npm run watch

# 4. Launch VS Code with extension
code --extensionDevelopmentPath=$PWD
```

### 12.3 Debug Configuration (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "vscode.extension",
      "request": "launch",
      "preLaunchTask": "npm: watch",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    },
    {
      "name": "Debug Extension",
      "type": "pwa-node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/extension.js",
      "runtimeArgs": ["--nolazy"],
      "skipFiles": ["<node_internals>/**"],
      "preLaunchTask": "npm: compile"
    },
    {
      "name": "Debug Python Backend",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/main.py",
      "console": "integratedTerminal",
      "env": {
        "DEBUG": "1"
      }
    }
  ]
}
```

### 12.4 Build for Production

```bash
# Build extension
npm run compile

# Build webview
cd webview-ui && npm run build && cd ..

# Package as VSIX
npx vsce package

# Publish to Marketplace (requires vsce login)
npx vsce publish
```

---

## 13. Testing Strategy

### 13.1 Extension Tests

Use `@vscode/test-cli` for integration tests:

```typescript
import * as vscode from 'vscode';
import * as assert from 'assert';
import { test } from '@vscode/test-cli';

test('should activate extension', async () => {
  const extension = vscode.extensions.getExtension('your-publisher.ai-os-plugin');
  await extension?.activate();
  assert.ok(extension?.isActive);
});
```

### 13.2 Backend Tests

```python
import pytest
from httpx import AsyncClient, ASGITransport
from src.main import app

@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
```

### 13.3 Webview Tests

Use React Testing Library with Vitest for component tests.

---

## 14. Publishing

### 14.1 VS Code Marketplace

```bash
# Install vsce
npm install -g @vscode/vsce

# Login (creates .vscode-extension.mvsix file)
npx vsce login your-publisher

# Package
npx vsce package

# Publish
npx vsce publish
```

### 14.2 Open VSX (Alternative Registry)

```bash
npm install -g ovsx
npx ovsx publish
```

---

## 15. Reference Links

| Resource | URL |
|----------|-----|
| VS Code Extension API | https://code.visualstudio.com/api |
| VS Code Webview Guide | https://code.visualstudio.com/api/extension-guides/webview |
| VS Code Contribution Points | https://code.visualstudio.com/api/references/contribution-points |
| VS Code Activation Events | https://code.visualstudio.com/api/references/activation-events |
| VS Code Extension Context / Memento | https://code.visualstudio.com/api/references/vscode-api#ExtensionContext |
| GitHub Projects API Docs | https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects |
| GitHub GraphQL Reference | https://docs.github.com/en/graphql/reference/projects |
| GitHub GraphQL Rate Limits | https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api |
| ProjectV2 Object Type | https://docs.github.com/en/graphql/reference/object#projectv2 |
| ProjectV2Item Object Type | https://docs.github.com/en/graphql/reference/object#projectv2item |
| projects_v2_item Webhook | https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_item |
| gh CLI Auth | https://cli.github.com/manual/gh_auth_login |
| FastAPI Docs | https://fastapi.tiangolo.com/ |
| httpx Docs | https://www.python-httpx.org/ |
| dnd-kit Docs | https://docs.dndkit.com/ |
| Zustand Docs | https://docs.pmnd.rs/zustand/getting-started/introduction |
| Vite Docs | https://vitejs.dev/ |
| VS Code Extension Samples | https://github.com/microsoft/vscode-extension-samples |
| React Webview Sample | https://github.com/githubnext/vscode-react-webviews |

---

## Appendix A: Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub PAT (fallback if gh CLI unavailable) | — |
| `POLL_INTERVAL` | Seconds between polls | `30` |
| `BACKEND_PORT` | Python backend port | `8000` |
| `LOG_LEVEL` | Logging verbosity | `INFO` |

## Appendix B: Error Handling Patterns

- **GraphQL errors**: Check `data.errors` in response; map to user-friendly messages
- **Rate limit errors**: HTTP 403 with `X-RateLimit-Remaining: 0`; back off and retry after cooldown
- **Auth errors**: Token expired or insufficient scopes; prompt user to re-authenticate
- **Network errors**: Retry with exponential backoff (1s, 2s, 4s, max 30s)
- **Webview errors**: Wrap all `postMessage` handlers in try/catch; send `error` type message back

## Appendix C: Security Considerations

- **Never store tokens in webview** — Tokens stay in the extension host and Python backend
- **CSP is mandatory** — Restrict script sources to prevent XSS
- **Validate all IPC messages** — Webview is untrusted; validate message types and data shapes
- **HTTPS only for GitHub API** — httpx should reject non-HTTPS connections
- **Token scopes minimal** — Request only `repo`, `project`, `read:org` scopes

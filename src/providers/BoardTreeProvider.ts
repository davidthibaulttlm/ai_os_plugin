import * as vscode from 'vscode';
import { getClaudeConfigPaths, isMcpConfigured } from '../services/claudeConfig';
import { logger } from '../services/logger';

export interface BoardTreeItem extends vscode.TreeItem {
  boardId?: string;
  boardName?: string;
}

export type TreeMode = 'boards' | 'settings';

// External references set by extension.ts for status checking
let _repoManager: any;
let _stateManager: any;

export function setTreeProviderDeps(repoManager: any, stateManager: any): void {
  _repoManager = repoManager;
  _stateManager = stateManager;
}

export class BoardTreeProvider implements vscode.TreeDataProvider<BoardTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BoardTreeItem | undefined | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private boards: BoardTreeItem[] = [];
  private isLoading = false;
  public mode: TreeMode = 'boards';

  refresh(): void {
    logger.debug('[BoardTreeProvider.refresh] Refreshing tree data');
    this._onDidChangeTreeData.fire();
  }

  setLoading(loading: boolean): void {
    logger.info(`[BoardTreeProvider.setLoading] loading=${loading}`);
    this.isLoading = loading;
    this.refresh();
  }

  setBoards(boards: { id: string; name: string; number?: number; url?: string }[]): void {
    logger.info(`[BoardTreeProvider.setBoards] Setting ${boards.length} boards`);
    this.boards = boards.map((b) => ({
      label: `${b.name} (#${b.number ?? '?'})`,
      description: b.url,
      tooltip: `Open board: ${b.name}\n${b.url}`,
      command: {
        command: 'aiOs.openBoardFromTree',
        title: 'Open Board',
        arguments: [b.id, b.name],
      },
      contextValue: 'board',
    }));
    this.isLoading = false;
    logger.info(`[BoardTreeProvider.setBoards] Result: ${this.boards.length} boards set`);
    this.refresh();
  }

  setMode(mode: TreeMode): void {
    logger.info(`[BoardTreeProvider.setMode] Setting mode to ${mode}`);
    this.mode = mode;
    vscode.commands.executeCommand('setContext', 'aiOs.treeMode', mode);
    logger.info(`[BoardTreeProvider.setMode] Context key aiOs.treeMode set to ${mode}`);
    this.refresh();
    logger.info(`[BoardTreeProvider.setMode] Result: mode=${mode}`);
  }

  getTreeItem(element: BoardTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BoardTreeItem): Thenable<BoardTreeItem[]> {
    logger.debug(`[BoardTreeProvider.getChildren] element=${element ? 'nested' : 'root'} mode=${this.mode}`);
    if (element) {
      return Promise.resolve([]);
    }

    if (this.mode === 'settings') {
      const items = this._buildSettingsItems();
      logger.debug(`[BoardTreeProvider.getChildren] Settings mode: ${items.length} items`);
      return Promise.resolve(items);
    }

    // boards mode
    if (this.isLoading) {
      return Promise.resolve([
        {
          label: 'Loading projects...',
          tooltip: 'Fetching your GitHub Projects...',
          contextValue: 'loading',
        } as BoardTreeItem,
      ]);
    }
    if (this.boards.length === 0) {
      return Promise.resolve([
        {
          label: 'No boards loaded',
          tooltip: 'Click the list icon to fetch your GitHub Projects',
          contextValue: 'empty',
        } as BoardTreeItem,
      ]);
    }
    logger.debug(`[BoardTreeProvider.getChildren] Boards mode: ${this.boards.length} boards`);
    return Promise.resolve(this.boards);
  }

  private _buildSettingsItems(): BoardTreeItem[] {
    logger.info('[BoardTreeProvider._buildSettingsItems] Building settings items');
    const config = vscode.workspace.getConfiguration('aiOs');
    const reposDir = config.get<string>('reposDir', '~/ai-os-repos');

    // Determine clone status
    const boardId = _stateManager?.getLastBoardId();
    let cloneIconName = 'repo';
    let cloneDescription = 'Not cloned';
    let cloneClickable = true;

    if (!boardId) {
      cloneIconName = 'question';
      cloneDescription = 'No board open';
      cloneClickable = false;
    } else if (_repoManager && _repoManager.getClonedRepos) {
      const cloned = _repoManager.getClonedRepos();
      const hasCloned = cloned && cloned.length > 0;
      cloneIconName = hasCloned ? 'check' : 'repo';
      cloneDescription = hasCloned ? 'Cloned' : 'Not cloned';
      cloneClickable = true;
    }

    logger.info(`[BoardTreeProvider._buildSettingsItems] Clone status: ${cloneDescription} boardId=${boardId ?? 'none'}`);

    const items: BoardTreeItem[] = [
      // Section header: REPOSITORIES
      {
        label: 'REPOSITORIES',
        tooltip: 'Repository settings',
        iconPath: new vscode.ThemeIcon('package'),
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: 'sectionHeader',
      } as BoardTreeItem,
      // Repos Directory
      {
        label: 'Repos Directory',
        tooltip: `Currently: ${reposDir} — Click to change`,
        description: reposDir,
        iconPath: new vscode.ThemeIcon('folder'),
        command: {
          command: 'aiOs.setReposDir',
          title: 'Set Repos Directory',
        },
        contextValue: 'settingInput',
      } as BoardTreeItem,
      // Clone Repos with status
      {
        label: 'Clone Repos',
        tooltip: cloneClickable
          ? 'Click to clone or update repositories'
          : 'Open a board first to enable cloning',
        description: cloneDescription,
        iconPath: new vscode.ThemeIcon(cloneIconName),
        command: cloneClickable
          ? { command: 'aiOs.cloneRepos', title: 'Clone Repos' }
          : undefined,
        contextValue: cloneClickable ? 'cloneReposClickable' : 'cloneReposDisabled',
      } as BoardTreeItem,
      // Spacer
      {
        label: '',
        tooltip: '',
        contextValue: 'spacer',
      } as BoardTreeItem,
      // Section header: CLAUDE INTEGRATION
      {
        label: 'CLAUDE INTEGRATION',
        tooltip: 'Claude Code connection settings',
        iconPath: new vscode.ThemeIcon('cloud-upload'),
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: 'sectionHeader',
      } as BoardTreeItem,
      // Connect / Disconnect Claude Code — show only the relevant action
      ...(() => {
        const configPaths = getClaudeConfigPaths();
        const configured = isMcpConfigured(configPaths);
        logger.info(`[BoardTreeProvider._buildSettingsItems] MCP configured: ${configured}`);
        if (configured) {
          return [this._makeActionItem('Disconnect from Claude Code', 'Remove MCP config from ~/.claude/settings.json', 'cancel', 'aiOs.disconnectClaude')];
        } else {
          return [this._makeActionItem('Connect to Claude Code', 'Write MCP config to ~/.claude/settings.json', 'plug', 'aiOs.configureClaude')];
        }
      })(),
    ];

    logger.info(`[BoardTreeProvider._buildSettingsItems] Result: ${items.length} items`);
    return items;
  }

  private _makeActionItem(label: string, tooltip: string, icon: string, command: string): BoardTreeItem {
    logger.debug(`[BoardTreeProvider._makeActionItem] label=${label} command=${command}`);
    return {
      label,
      tooltip,
      iconPath: new vscode.ThemeIcon(icon),
      command: { command, title: label },
      contextValue: 'settingAction',
    } as BoardTreeItem;
  }
}

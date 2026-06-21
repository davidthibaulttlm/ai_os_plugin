import * as vscode from 'vscode';
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
    let cloneStatus: { icon: string; description: string; clickable: boolean };

    if (!boardId) {
      cloneStatus = { icon: '$(repo)', description: 'No board open', clickable: false };
    } else if (_repoManager && _repoManager.getClonedRepos) {
      const cloned = _repoManager.getClonedRepos();
      const hasCloned = cloned && cloned.length > 0;
      cloneStatus = hasCloned
        ? { icon: '$(repo-cloned)', description: 'Cloned', clickable: true }
        : { icon: '$(repo)', description: 'Not cloned', clickable: true };
    } else {
      cloneStatus = { icon: '$(repo)', description: 'Not cloned', clickable: true };
    }

    logger.info(`[BoardTreeProvider._buildSettingsItems] Clone status: ${cloneStatus.description} boardId=${boardId ?? 'none'}`);

    const items: BoardTreeItem[] = [
      // Section header: REPOSITORIES
      {
        label: '$(package) REPOSITORIES',
        tooltip: 'Repository settings',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: 'sectionHeader',
      } as BoardTreeItem,
      // Repos Directory
      {
        label: '$(folder) Repos Directory',
        tooltip: `Currently: ${reposDir} — Click to change`,
        description: reposDir,
        command: {
          command: 'aiOs.setReposDir',
          title: 'Set Repos Directory',
        },
        contextValue: 'settingInput',
      } as BoardTreeItem,
      // Clone Repos with status
      {
        label: `${cloneStatus.icon} Clone Repos`,
        tooltip: cloneStatus.clickable
          ? 'Click to clone or update repositories'
          : 'Open a board first to enable cloning',
        description: cloneStatus.description,
        command: cloneStatus.clickable
          ? { command: 'aiOs.cloneRepos', title: 'Clone Repos' }
          : undefined,
        contextValue: cloneStatus.clickable ? 'cloneReposClickable' : 'cloneReposDisabled',
      } as BoardTreeItem,
      // Spacer
      {
        label: '',
        tooltip: '',
        contextValue: 'spacer',
      } as BoardTreeItem,
      // Section header: CLAUDE INTEGRATION
      {
        label: '$(cloud-upload) CLAUDE INTEGRATION',
        tooltip: 'Claude Code connection settings',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        contextValue: 'sectionHeader',
      } as BoardTreeItem,
      // Connect to Claude Code
      {
        label: '$(cloud-upload) Connect to Claude Code',
        tooltip: 'Write MCP config to ~/.claude/settings.json',
        command: {
          command: 'aiOs.configureClaude',
          title: 'Connect to Claude Code',
        },
        contextValue: 'settingAction',
      } as BoardTreeItem,
      // Disconnect from Claude Code
      {
        label: '$(plug) Disconnect from Claude Code',
        tooltip: 'Remove MCP config from ~/.claude/settings.json',
        command: {
          command: 'aiOs.disconnectClaude',
          title: 'Disconnect from Claude Code',
        },
        contextValue: 'settingAction',
      } as BoardTreeItem,
    ];

    logger.info(`[BoardTreeProvider._buildSettingsItems] Result: ${items.length} items`);
    return items;
  }
}

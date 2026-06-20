import * as vscode from 'vscode';

export interface BoardTreeItem extends vscode.TreeItem {
  boardId?: string;
  boardName?: string;
}

export type TreeMode = 'boards' | 'settings';

export class BoardTreeProvider implements vscode.TreeDataProvider<BoardTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BoardTreeItem | undefined | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private boards: BoardTreeItem[] = [];
  private isLoading = false;
  public mode: TreeMode = 'boards';

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.refresh();
  }

  setBoards(boards: { id: string; name: string; number?: number; url?: string }[]): void {
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
    this.refresh();
  }

  setMode(mode: TreeMode): void {
    this.mode = mode;
    this.refresh();
  }

  getTreeItem(element: BoardTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BoardTreeItem): Thenable<BoardTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    if (this.mode === 'settings') {
      return Promise.resolve(this._buildSettingsItems());
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
    return Promise.resolve(this.boards);
  }

  private _buildSettingsItems(): BoardTreeItem[] {
    const config = vscode.workspace.getConfiguration('aiOs');
    const autoWork = config.get<boolean>('autoWorkAssignments', false);
    const maxTurns = config.get<number>('autoWorkMaxTurns', 25);
    const allowedTools = config.get<string>('autoWorkAllowedTools', '');
    const confirmFirst = config.get<boolean>('autoWorkConfirmFirst', true);

    return [
      {
        label: '$(gear) AI OS Settings',
        tooltip: 'AI OS Configuration',
        contextValue: 'settingsHeader',
      } as BoardTreeItem,
      {
        label: `$(check${autoWork ? '' : '-mark'}) Auto-Work Assignments`,
        tooltip: `${autoWork ? 'Enabled' : 'Disabled'} — Click to toggle`,
        description: autoWork ? 'ON' : 'OFF',
        command: {
          command: 'aiOs.toggleAutoWork',
          title: 'Toggle Auto-Work',
        },
        contextValue: 'settingToggle',
      } as BoardTreeItem,
      {
        label: `$(check${confirmFirst ? '' : '-mark'}) Confirm Before Work`,
        tooltip: `${confirmFirst ? 'Enabled' : 'Disabled'} — Click to toggle`,
        description: confirmFirst ? 'ON' : 'OFF',
        command: {
          command: 'aiOs.toggleConfirmFirst',
          title: 'Toggle Confirm First',
        },
        contextValue: 'settingToggle',
      } as BoardTreeItem,
      {
        label: '$(num) Max Turns',
        tooltip: `Currently: ${maxTurns} — Click to change`,
        description: String(maxTurns),
        command: {
          command: 'aiOs.setMaxTurns',
          title: 'Set Max Turns',
        },
        contextValue: 'settingInput',
      } as BoardTreeItem,
      {
        label: '$(tools) Allowed Tools',
        tooltip: `Currently: ${allowedTools || 'All tools'} — Click to change`,
        description: allowedTools || 'All tools',
        command: {
          command: 'aiOs.setAllowedTools',
          title: 'Set Allowed Tools',
        },
        contextValue: 'settingInput',
      } as BoardTreeItem,
      {
        label: '$(cloud) Connect to Claude Code',
        tooltip: 'Write MCP config to ~/.claude/settings.json',
        command: {
          command: 'aiOs.configureClaude',
          title: 'Connect to Claude Code',
        },
        contextValue: 'settingAction',
      } as BoardTreeItem,
      {
        label: '$(debug-disconnect) Disconnect from Claude Code',
        tooltip: 'Remove MCP config from ~/.claude/settings.json',
        command: {
          command: 'aiOs.disconnectClaude',
          title: 'Disconnect from Claude Code',
        },
        contextValue: 'settingAction',
      } as BoardTreeItem,
    ];
  }
}

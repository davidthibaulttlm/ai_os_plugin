import * as vscode from 'vscode';

export interface BoardTreeItem extends vscode.TreeItem {
  boardId?: string;
  boardName?: string;
}

export class BoardTreeProvider implements vscode.TreeDataProvider<BoardTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BoardTreeItem | undefined | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private boards: BoardTreeItem[] = [];
  private isLoading = false;

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

  getTreeItem(element: BoardTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BoardTreeItem): Thenable<BoardTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }
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
}

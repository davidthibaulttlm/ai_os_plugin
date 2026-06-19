import * as vscode from 'vscode';

export interface BoardTreeItem extends vscode.TreeItem {
  boardId?: string;
  boardName?: string;
}

export class BoardTreeProvider implements vscode.TreeDataProvider<BoardTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BoardTreeItem | undefined | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private boards: BoardTreeItem[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setBoards(boards: { id: string; name: string }[]): void {
    this.boards = boards.map((b) => ({
      label: b.name,
      id: b.id,
      tooltip: `Open board: ${b.name}`,
      command: {
        command: 'aiOs.openBoard',
        title: 'Open Board',
        arguments: [b.id],
      },
      contextValue: 'board',
    }));
    this.refresh();
  }

  getTreeItem(element: BoardTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BoardTreeItem): Thenable<BoardTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }
    if (this.boards.length === 0) {
      return Promise.resolve([
        {
          label: 'No board selected',
          tooltip: 'Run "AI OS: Select Board" to connect to a GitHub Project',
          contextValue: 'empty',
        } as BoardTreeItem,
      ]);
    }
    return Promise.resolve(this.boards);
  }
}

import * as vscode from 'vscode';

export class StateManager {
  private static readonly LAST_BOARD_KEY = 'aiOs.lastBoardId';
  private static readonly COLUMN_MAPPING_KEY = 'aiOs.columnMapping.';

  constructor(private readonly globalState: vscode.Memento) {}

  /** Get the last selected board ID */
  public getLastBoardId(): string | undefined {
    return this.globalState.get<string>(StateManager.LAST_BOARD_KEY);
  }

  /** Set the last selected board ID */
  public async setLastBoardId(boardId: string): Promise<void> {
    await this.globalState.update(StateManager.LAST_BOARD_KEY, boardId);
  }

  /** Get column field mapping for a specific project */
  public getColumnMapping(projectId: string): Record<string, string> | undefined {
    return this.globalState.get<Record<string, string>>(
      `${StateManager.COLUMN_MAPPING_KEY}${projectId}`
    );
  }

  /** Set column field mapping for a specific project */
  public async setColumnMapping(
    projectId: string,
    mapping: Record<string, string>
  ): Promise<void> {
    await this.globalState.update(
      `${StateManager.COLUMN_MAPPING_KEY}${projectId}`,
      mapping
    );
  }

  /** Clear all stored state */
  public async clearAll(): Promise<void> {
    await this.globalState.update(StateManager.LAST_BOARD_KEY, undefined);
  }
}

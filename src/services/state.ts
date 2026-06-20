import * as vscode from 'vscode';
import { logger } from './logger';

export class StateManager {
  private static readonly LAST_BOARD_KEY = 'aiOs.lastBoardId';
  private static readonly COLUMN_MAPPING_KEY = 'aiOs.columnMapping.';

  constructor(private readonly globalState: vscode.Memento) {
    logger.info('[StateManager] Initialized');
  }

  /** Get the last selected board ID */
  public getLastBoardId(): string | undefined {
    const boardId = this.globalState.get<string>(StateManager.LAST_BOARD_KEY);
    logger.debug(`[StateManager.getLastBoardId] boardId=${boardId ?? 'undefined'}`);
    return boardId;
  }

  /** Set the last selected board ID */
  public async setLastBoardId(boardId: string): Promise<void> {
    logger.info(`[StateManager.setLastBoardId] Setting boardId=${boardId}`);
    await this.globalState.update(StateManager.LAST_BOARD_KEY, boardId);
  }

  /** Get column field mapping for a specific project */
  public getColumnMapping(projectId: string): Record<string, string> | undefined {
    const mapping = this.globalState.get<Record<string, string>>(
      `${StateManager.COLUMN_MAPPING_KEY}${projectId}`
    );
    logger.debug(`[StateManager.getColumnMapping] projectId=${projectId}, mapping=${mapping ? 'found' : 'none'}`);
    return mapping;
  }

  /** Set column field mapping for a specific project */
  public async setColumnMapping(
    projectId: string,
    mapping: Record<string, string>
  ): Promise<void> {
    logger.info(`[StateManager.setColumnMapping] projectId=${projectId}, keys=${Object.keys(mapping).length}`);
    await this.globalState.update(
      `${StateManager.COLUMN_MAPPING_KEY}${projectId}`,
      mapping
    );
  }

  /** Clear all stored state */
  public async clearAll(): Promise<void> {
    logger.info('[StateManager.clearAll] Clearing all state');
    await this.globalState.update(StateManager.LAST_BOARD_KEY, undefined);
  }
}

/**
 * State Bridge — writes board state to a shared JSON file for the MCP server.
 * Uses atomic writes (write to temp file, then rename) to prevent partial reads.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface BoardState {
  columns: Record<string, Array<{ number: number; title: string; labels?: string[] }>>;
  issues: Array<{ number: number; title: string; column: string; labels?: string[] }>;
  lastUpdated: string;
}

/**
 * Write board state to the shared JSON file atomically.
 */
export async function writeBoardState(stateFilePath: string, state: BoardState): Promise<void> {
  logger.debug(`[stateBridge.writeBoardState] Writing state to ${stateFilePath}, issues=${state.issues.length}`);
  const dir = path.dirname(stateFilePath);
  if (!fs.existsSync(dir)) {
    logger.info(`[stateBridge.writeBoardState] Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${stateFilePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tempPath, stateFilePath);
  logger.debug(`[stateBridge.writeBoardState] State written successfully`);
}

/**
 * Get the state file path.
 */
export function getStateFilePath(globalStorageUri: string): string {
  const filePath = path.join(globalStorageUri, 'board-state.json');
  logger.debug(`[stateBridge.getStateFilePath] globalStorageUri=${globalStorageUri} -> ${filePath}`);
  return filePath;
}

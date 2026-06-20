/**
 * Shared utilities for MCP tools — reading board state from the shared JSON file.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BoardState {
  columns: Record<string, Array<{ number: number; title: string; labels?: string[] }>>;
  issues: Array<{ number: number; title: string; column: string; labels?: string[] }>;
  lastUpdated: string;
}

/**
 * Read the board state from the shared JSON file.
 * Returns null if the file doesn't exist or is invalid.
 */
export function readBoardState(): BoardState | null {
  const stateFile = process.env.AI_OS_STATE_FILE;
  if (!stateFile || !fs.existsSync(stateFile)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf-8');
    const data = JSON.parse(raw) as BoardState;
    return data;
  } catch {
    return null;
  }
}

/**
 * Check if the board state is stale (older than 60 seconds).
 */
export function isStale(state: BoardState | null): boolean {
  if (!state || !state.lastUpdated) return true;
  const age = Date.now() - new Date(state.lastUpdated).getTime();
  return age > 60_000;
}

/**
 * Get the state file path for use by the extension host.
 */
export function getStateFilePath(globalStorageUri: string): string {
  return path.join(globalStorageUri, 'board-state.json');
}

/**
 * Shared utilities for MCP tools — reading board state from the shared JSON file.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BoardState } from '../../services/stateBridge';

/**
 * Read the board state from the shared JSON file.
 * Returns null if the file doesn't exist or is invalid.
 */
export function readBoardState(): BoardState | null {
  let stateFile = process.env.AI_OS_STATE_FILE;
  let exists = stateFile ? fs.existsSync(stateFile) : false;
  
  // Fallback: if env var not set or file doesn't exist, search common locations
  if (!stateFile || !exists) {
    const home = process.env.HOME || '';
    const candidates = [
      // VS Code Server global storage (Linux/WSL)
      path.join(home, '.vscode-server', 'data', 'User', 'globalStorage', 'ai-os.ai-os-plugin', 'board-state.json'),
      // VS Code global storage (macOS)
      path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'ai-os.ai-os-plugin', 'board-state.json'),
      // VS Code global storage (Windows)
      path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'ai-os.ai-os-plugin', 'board-state.json'),
      // Extension directory fallback
      path.join(path.dirname(process.argv[1] || ''), '..', '..', 'board-state.json'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        stateFile = candidate;
        exists = true;
        process.stderr.write(
          `[AI OS MCP] Fallback: Found state file at ${candidate}\n`
        );
        break;
      }
    }
  }

  // Diagnostic logging
  process.stderr.write(
    `[AI OS MCP] readBoardState: stateFile=${stateFile ?? '(undefined)'}, ` +
    `exists=${exists}\n`
  );

  if (!stateFile || !exists) {
    if (!stateFile) {
      process.stderr.write(
        `[AI OS MCP] ERROR: AI_OS_STATE_FILE env var is not set and no fallback found.\n`
      );
    } else {
      process.stderr.write(
        `[AI OS MCP] ERROR: State file does not exist at: ${stateFile}\n`
      );
    }
    return null;
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf-8');
    const data = JSON.parse(raw) as BoardState;
    process.stderr.write(
      `[AI OS MCP] readBoardState: OK — ${data.issues?.length ?? 0} issues, ` +
      `${Object.keys(data.columns ?? {}).length} columns\n`
    );
    return data;
  } catch (error) {
    process.stderr.write(
      `[AI OS MCP] ERROR: Failed to parse state file: ${(error as Error).message}\n`
    );
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

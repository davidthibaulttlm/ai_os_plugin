/**
 * Claude Code detector — checks if Claude Code is installed (VS Code extension and/or CLI).
 */

import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { logger } from './logger';

export interface ClaudeDetectionResult {
  extensionInstalled: boolean;
  cliInstalled: boolean;
}

/**
 * Detect Claude Code installation status.
 * Checks both the VS Code extension and the CLI binary.
 */
export function detectClaudeCode(): ClaudeDetectionResult {
  const result: ClaudeDetectionResult = {
    extensionInstalled: false,
    cliInstalled: false,
  };

  try {
    const ext = vscode.extensions.getExtension('anthropic.claude-code');
    result.extensionInstalled = ext !== undefined;
  } catch (error) {
    logger.error(`Failed to check Claude extension: ${(error as Error).message}`);
  }

  try {
    const platformCommand = process.platform === 'win32' ? 'where claude' : 'which claude';
    execSync(platformCommand, { timeout: 5000 });
    result.cliInstalled = true;
  } catch {
    result.cliInstalled = false;
  }

  logger.info(`Claude detection: extension=${result.extensionInstalled}, cli=${result.cliInstalled}`);
  return result;
}

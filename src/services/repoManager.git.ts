/** Git helper: runGit with token auth via GIT_ASKPASS */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from './logger';
import type { GitResult } from './repoManager.types';

export interface GitRunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export function runGit(token: string, cwd: string, args: string[]): Promise<GitRunResult> {
  logger.debug(`[Git.runGit] cwd=${cwd} args=${args.join(' ')}`);

  const askpassScript = `#!/bin/sh
echo '${token}'`;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-os-'));
  const askpassPath = path.join(tmpDir, 'askpass.sh');
  fs.writeFileSync(askpassPath, askpassScript, { mode: 0o700 });

  const env = {
    ...process.env,
    GIT_ASKPASS: askpassPath,
    GIT_TERMINAL_PROMPT: '0',
  };

  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd, env, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('exit', (code) => {
      try { fs.unlinkSync(askpassPath); fs.rmdirSync(tmpDir); } catch { /* ignore */ }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
    });

    child.on('error', (error) => {
      try { fs.unlinkSync(askpassPath); fs.rmdirSync(tmpDir); } catch { /* ignore */ }
      resolve({ stdout: '', stderr: error.message, code: -1 });
    });
  });
}

export function handleGitResult(result: { code: number | null; stderr: string }, action: string, owner: string, repo: string): GitResult {
  if (result.code === 0) {
    logger.info(`[Git.handleGitResult] Successfully ${action}ed ${owner}/${repo}`);
    return { success: true };
  } else {
    const error = result.stderr || `${action.charAt(0).toUpperCase() + action.slice(1)} failed`;
    logger.error(`[Git.handleGitResult] Error ${action}ing ${owner}/${repo}: ${error}`);
    return { success: false, error: error.substring(0, 100) };
  }
}

/** Check if git is available on the system (async). */
export function checkGitAvailableAsync(): Promise<boolean> {
  logger.info('[Git.checkGitAvailableAsync] Checking git availability');
  return new Promise((resolve) => {
    try {
      const child = spawn('git', ['--version']);
      child.on('exit', (code) => {
        const available = code === 0;
        logger.info(`[Git.checkGitAvailableAsync] Result: ${available}`);
        resolve(available);
      });
      child.on('error', () => {
        logger.error('[Git.checkGitAvailableAsync] Error spawning git');
        resolve(false);
      });
    } catch (error) {
      logger.error(`[Git.checkGitAvailableAsync] Error: ${(error as Error).message}`);
      resolve(false);
    }
  });
}

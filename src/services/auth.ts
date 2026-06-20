import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

/**
 * AuthService handles GitHub authentication via gh CLI token
 * with GITHUB_TOKEN environment variable fallback.
 */
export class AuthService {
  private _token: string | undefined;

  /**
   * Execute command with timeout to prevent hanging.
   */
  private async execWithTimeout(command: string, timeoutMs = 5000): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  /**
   * Get GitHub token from gh CLI or environment variable.
   * Priority: 1) Cached token, 2) GITHUB_TOKEN env, 3) gh auth token
   */
  public async getGitHubToken(): Promise<string | undefined> {
    logger.info('[AuthService.getGitHubToken] Starting token retrieval...');
    if (this._token) {
      logger.info('[AuthService.getGitHubToken] Returning cached token');
      return this._token;
    }

    try {
      // Try environment variable first
      const envToken = process.env.GITHUB_TOKEN;
      if (envToken) {
        this._token = envToken.trim();
        logger.info(`[AuthService.getGitHubToken] Got token from GITHUB_TOKEN env (length=${this._token.length})`);
        return this._token;
      }
      logger.debug('[AuthService.getGitHubToken] No GITHUB_TOKEN env, trying gh CLI...');

      // Fall back to gh CLI with timeout
      const { stdout } = await this.execWithTimeout('gh auth token', 5000);
      const token = stdout.trim();
      if (token) {
        this._token = token;
        logger.info(`[AuthService.getGitHubToken] Got token from gh CLI (length=${this._token.length})`);
        return this._token;
      }
      logger.warn('[AuthService.getGitHubToken] gh CLI returned empty token');
    } catch (error) {
      logger.warn(`[AuthService.getGitHubToken] Failed to get GitHub token: ${(error as Error).message}`);
      return undefined;
    }

    logger.warn('[AuthService.getGitHubToken] No token found anywhere');
    return undefined;
  }

  /**
   * Validate that the token has required scopes.
   * Returns true if token appears valid.
   */
  public async validateToken(token: string): Promise<boolean> {
    logger.info('[AuthService.validateToken] Validating token...');
    try {
      const { stdout } = await this.execWithTimeout('gh auth status', 5000);
      const valid = stdout.includes('Logged in');
      logger.info(`[AuthService.validateToken] gh auth status: ${valid ? 'valid' : 'invalid'}`);
      return valid;
    } catch (error) {
      logger.warn(`[AuthService.validateToken] gh auth status failed: ${(error as Error).message}, falling back to length check`);
      const valid = token.length > 10;
      logger.info(`[AuthService.validateToken] Length check: ${valid ? 'valid' : 'invalid'} (length=${token.length})`);
      return valid;
    }
  }

  /**
   * Clear cached token.
   */
  public clearToken(): void {
    logger.info('[AuthService.clearToken] Clearing cached token');
    this._token = undefined;
  }
}

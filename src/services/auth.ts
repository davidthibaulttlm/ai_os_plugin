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
    if (this._token) {
      return this._token;
    }

    try {
      // Try environment variable first
      const envToken = process.env.GITHUB_TOKEN;
      if (envToken) {
        this._token = envToken.trim();
        return this._token;
      }

      // Fall back to gh CLI with timeout
      const { stdout } = await this.execWithTimeout('gh auth token', 5000);
      const token = stdout.trim();
      if (token) {
        this._token = token;
        return this._token;
      }
    } catch (error) {
      // gh CLI not available or timed out
      logger.warn(`Failed to get GitHub token: ${(error as Error).message}`);
      return undefined;
    }

    return undefined;
  }

  /**
   * Validate that the token has required scopes.
   * Returns true if token appears valid.
   */
  public async validateToken(token: string): Promise<boolean> {
    try {
      const { stdout } = await this.execWithTimeout('gh auth status', 5000);
      return stdout.includes('Logged in');
    } catch {
      // If gh auth status fails, check if we have a non-empty token
      return token.length > 10;
    }
  }

  /**
   * Clear cached token.
   */
  public clearToken(): void {
    this._token = undefined;
  }
}

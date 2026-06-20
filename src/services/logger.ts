import * as vscode from 'vscode';

/**
 * Singleton Logger service wrapping VS Code's LogOutputChannel.
 * Provides level-aware logging with automatic [AI OS] prefix.
 */
class Logger {
  private static _instance: Logger | undefined;
  private _channel: vscode.LogOutputChannel | undefined;

  private constructor() {}

  /**
   * Get or create the singleton Logger instance.
   * Creates the LogOutputChannel on first call.
   */
  public static getInstance(): Logger {
    if (!Logger._instance) {
      Logger._instance = new Logger();
      Logger._instance._channel = vscode.window.createOutputChannel('AI OS', { log: true });
      Logger._instance._channel.show();
    }
    return Logger._instance;
  }

  /**
   * Log a trace level message.
   */
  public trace(message: string, ...args: unknown[]): void {
    this._channel?.trace(`[AI OS] ${message}`, ...args);
  }

  /**
   * Log a debug level message.
   */
  public debug(message: string, ...args: unknown[]): void {
    this._channel?.debug(`[AI OS] ${message}`, ...args);
  }

  /**
   * Log an info level message.
   */
  public info(message: string, ...args: unknown[]): void {
    this._channel?.info(`[AI OS] ${message}`, ...args);
  }

  /**
   * Log a warning level message.
   */
  public warn(message: string, ...args: unknown[]): void {
    this._channel?.warn(`[AI OS] ${message}`, ...args);
  }

  /**
   * Log an error level message.
   * Accepts an optional Error object for stack trace inclusion.
   */
  public error(message: string, error?: Error | unknown): void {
    this._channel?.error(`[AI OS] ${message}`, error);
  }

  /**
   * Dispose the underlying LogOutputChannel and clear the singleton.
   * Safe to call multiple times. Allows re-creation on next getInstance().
   */
  public dispose(): void {
    this._channel?.dispose();
    this._channel = undefined;
    Logger._instance = undefined;
  }
}

/** Default logger singleton instance */
export const logger = Logger.getInstance();

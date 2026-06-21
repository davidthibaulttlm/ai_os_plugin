import * as vscode from 'vscode';
import type { GraphQLClient } from '../services/graphql';
import type { BoardData, ExtensionToWebview, IPCMessage, WebviewToExtension } from '../types/ipc';
import { logger } from '../services/logger';
import { ColumnPromptService } from '../services/columnPrompt';
import {
  loadBoardData,
  moveItem,
  reorderItem,
  getHtmlForWebview,
  handleMessage,
} from './KanbanPanel.helpers';

/**
 * Webview panel provider for the AI OS Kanban board.
 * Handles panel creation, CSP nonce, and IPC message routing.
 */
export class KanbanPanel {
  public static currentPanel: KanbanPanel | undefined;
  private static readonly viewType = 'aiOs.kanbanPanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _graphql: GraphQLClient;
  private readonly _promptService: ColumnPromptService;
  private _projectId: string | undefined;
  private _onDisposeCallbacks: Array<() => void> = [];

  /**
   * Register a callback to be invoked when the panel is disposed.
   */
  public onDispose(callback: () => void): void {
    this._onDisposeCallbacks.push(callback);
  }

  /**
   * Get the underlying webview for posting messages.
   */
  public get webview(): vscode.Webview {
    return this._panel.webview;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    graphql: GraphQLClient,
    promptService: ColumnPromptService,
    projectId?: string
  ) {
    logger.info('[KanbanPanel.constructor] Initializing KanbanPanel');
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._graphql = graphql;
    this._promptService = promptService;
    this._projectId = projectId;
    logger.info('[KanbanPanel.constructor] Result: initialized');

    // Set webview options
    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'dist'),
      ],
    };

    // Set webview HTML
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    this._panel.webview.onDidReceiveMessage(
      async (message: IPCMessage) => {
        logger.debug('Message received from webview', { type: message.type });
        try {
          if (!message || typeof message !== 'object' || !('type' in message)) {
            logger.warn('Invalid IPC message — missing type');
            return;
          }
          await handleMessage({
            webview: this._panel.webview,
            projectId: this._projectId,
            setProjectId: (id: string) => { this._projectId = id; },
            graphql: this._graphql,
            promptService: this._promptService,
            safePostMessage: (msg: ExtensionToWebview) => this._safePostMessage(msg),
            refresh: () => this.refresh(),
            loadBoardData: (projectId: string) => this._loadBoardData(projectId),
            moveItem: (projectId: string, itemId: string, columnId: string) => this._moveItem(projectId, itemId, columnId),
            reorderItem: (projectId: string, itemId: string, afterId: string | null) => this._reorderItem(projectId, itemId, afterId),
          }, message as WebviewToExtension);
        } catch (error) {
          logger.error(`Unhandled error in message handler: ${(error as Error).message}`);
          try {
            this._panel.webview.postMessage({
              type: 'error',
              data: { message: (error as Error).message },
            } as ExtensionToWebview);
          } catch { /* disposed */ }
        }
      },
      undefined,
      this._disposables
    );
    logger.debug('onDidReceiveMessage handler registered');

    // Reset when panel is closed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Load initial board if provided
    if (projectId) {
      this._loadInitialBoard(projectId);
    }
  }

  /**
   * Create or show the Kanban panel.
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    graphql: GraphQLClient,
    promptService: ColumnPromptService,
    projectId?: string
  ): KanbanPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Reuse existing panel if it still exists (not disposed)
    if (KanbanPanel.currentPanel) {
      try {
        // Update HTML with fresh cache-busting to ensure latest JS loads
        KanbanPanel.currentPanel._panel.webview.html =
          KanbanPanel.currentPanel._getHtmlForWebview(KanbanPanel.currentPanel._panel.webview);
        KanbanPanel.currentPanel._panel.reveal(column);
        return KanbanPanel.currentPanel;
      } catch {
        // Panel was disposed, clear reference and create new one
        KanbanPanel.currentPanel = undefined;
      }
    }

    const panel = vscode.window.createWebviewPanel(
      KanbanPanel.viewType,
      'AI OS Kanban',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
        ],
        retainContextWhenHidden: false,
      }
    );

    KanbanPanel.currentPanel = new KanbanPanel(panel, extensionUri, graphql, promptService, projectId);
    return KanbanPanel.currentPanel;
  }

  /**
   * Reveal the panel in the specified column.
   */
  public reveal(column: vscode.ViewColumn): void {
    this._panel.reveal(column);
  }

  private _safePostMessage(msg: ExtensionToWebview): void {
    try {
      this._panel.webview.postMessage(msg);
    } catch {
      // Panel disposed - message delivery failed
    }
  }

  /**
   * Refresh the board data.
   */
  public async refresh(): Promise<void> {
    if (!this._projectId) {
      return;
    }

    try {
      const data = await this._loadBoardData(this._projectId);
      try {
        this._panel.webview.postMessage({
          type: 'boardData',
          data,
        } as ExtensionToWebview);
      } catch {
        // Webview disposed
      }
    } catch (error) {
      try {
        this._panel.webview.postMessage({
          type: 'error',
          data: { message: (error as Error).message },
        } as ExtensionToWebview);
      } catch {
        // Webview disposed
      }
    }
  }

  /**
   * Notify the webview about agent progress.
   */
  public notifyAgentProgress(issueId: string, status: string): void {
    try {
      this._panel.webview.postMessage({
        type: 'agentProgress',
        data: { issueId, status },
      } as ExtensionToWebview);
    } catch {
      // Webview disposed
    }
  }

  /**
   * Notify the webview that Claude is working (or stopped working) on an issue.
   */
  public notifyWorkingStatus(issueNumber: number, active: boolean): void {
    try {
      this._panel.webview.postMessage({
        type: 'workingStatus',
        data: { issueNumber, active },
      } as ExtensionToWebview);
    } catch {
      // Webview disposed
    }
  }

  /**
   * Load initial board data asynchronously (fire-and-forget from constructor).
   */
  private async _loadInitialBoard(projectId: string): Promise<void> {
    try {
      logger.info(`Loading initial board for project ${projectId}`);
      const boardData = await this._loadBoardData(projectId);
      logger.info(`Board loaded: ${boardData.items.length} items, ${boardData.columns.length} columns`);
      try {
        this._panel.webview.postMessage({
          type: 'boardData',
          data: boardData,
        } as ExtensionToWebview);
      } catch {
        // Webview disposed
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.error(`Error loading initial board: ${errorMsg}`);
      try {
        this._panel.webview.postMessage({
          type: 'error',
          data: { message: `Failed to load board: ${errorMsg}` },
        } as ExtensionToWebview);
      } catch {
        // Webview disposed
      }
    }
  }

  /**
   * Dispose of panel resources.
   */
  public dispose(): void {
    // Invoke dispose callbacks (e.g., stop poller)
    for (const callback of this._onDisposeCallbacks) {
      try {
        callback();
      } catch (error) {
        logger.error(`Error in dispose callback: ${(error as Error).message}`);
      }
    }
    this._onDisposeCallbacks = [];

    KanbanPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const item = this._disposables.pop();
      if (item) {
        item.dispose();
      }
    }
  }

  /**
   * Load board data from GitHub.
   */
  private async _loadBoardData(projectId: string): Promise<BoardData> {
    return loadBoardData(this._graphql, projectId);
  }

  /**
   * Move an item to a different column.
   */
  private async _moveItem(
    projectId: string,
    itemId: string,
    columnId: string
  ): Promise<{ id: string; status: string }> {
    return moveItem(this._graphql, projectId, itemId, columnId);
  }

  /**
   * Reorder an item within the project.
   */
  private async _reorderItem(
    projectId: string,
    itemId: string,
    afterId: string | null
  ): Promise<void> {
    return reorderItem(this._graphql, projectId, itemId, afterId);
  }

  /**
   * Generate HTML for the webview with CSP nonce.
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return getHtmlForWebview(webview, this._extensionUri);
  }

}

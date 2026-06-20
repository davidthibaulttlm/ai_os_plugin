import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { GraphQLClient } from '../services/graphql';
import type { BoardData, ExtensionToWebview, IPCMessage, WebviewToExtension } from '../types/ipc';
import { logger } from '../services/logger';

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
  private _projectId: string | undefined;
  private _onDisposeCallbacks: Array<() => void> = [];

  /**
   * Register a callback to be invoked when the panel is disposed.
   */
  public onDispose(callback: () => void): void {
    this._onDisposeCallbacks.push(callback);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    graphql: GraphQLClient,
    projectId?: string
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._graphql = graphql;
    this._projectId = projectId;

    // Set webview options
    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'dist'),
      ],
    };

    // Set webview HTML
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message: IPCMessage) => {
        logger.debug('Message received from webview', { type: (message as any)?.type });
        try {
          // Validate message structure
          if (!message || typeof message !== 'object' || !('type' in message)) {
            logger.warn('Invalid IPC message — missing type');
            return;
          }
          await this._handleMessage(message as WebviewToExtension);
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

    // Create new panel
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

    KanbanPanel.currentPanel = new KanbanPanel(panel, extensionUri, graphql, projectId);
    return KanbanPanel.currentPanel;
  }

  /**
   * Reveal the panel in the specified column.
   */
  public reveal(column: vscode.ViewColumn): void {
    this._panel.reveal(column);
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
   * Handle incoming messages from the webview.
   */
  private async _handleMessage(message: WebviewToExtension): Promise<void> {
    // Validate message type against allowed types
    const allowedTypes = ['loadBoard', 'moveItem', 'reorderItem', 'refresh', 'selectIssue', 'assignAgent', '__ping__', '__inline_ping__', '__react_ready__'];
    if (!allowedTypes.includes(message.type)) {
      logger.warn(`Unknown IPC message type: ${message.type}`);
      return;
    }

    switch (message.type) {
      case 'loadBoard': {
        if (!message.data?.boardId || typeof message.data.boardId !== 'string') {
          logger.warn('loadBoard: missing or invalid boardId');
          return;
        }
        this._projectId = message.data.boardId;
        const boardData = await this._loadBoardData(message.data.boardId);
        try {
          this._panel.webview.postMessage({
            type: 'boardData',
            data: boardData,
          } as ExtensionToWebview);
        } catch { /* disposed */ }
        break;
      }

      case 'moveItem': {
        logger.info(`moveItem received: itemId=${message.data?.itemId}, columnId=${message.data?.columnId}, projectId=${this._projectId}`);
        if (!this._projectId || !message.data?.itemId || !message.data?.columnId) {
          logger.warn('moveItem: missing required fields');
          return;
        }
        try {
          const result = await this._moveItem(
            this._projectId,
            message.data.itemId,
            message.data.columnId
          );
          logger.info(`moveItem success: ${JSON.stringify(result)}`);
          try {
            this._panel.webview.postMessage({
              type: 'itemMoved',
              data: result,
            } as ExtensionToWebview);
          } catch { /* disposed */ }
        } catch (error) {
          const errorMsg = (error as Error).message;
          logger.error(`moveItem FAILED: ${errorMsg}`);
          try {
            this._panel.webview.postMessage({
              type: 'error',
              data: { message: `Failed to move item: ${errorMsg}` },
            } as ExtensionToWebview);
          } catch { /* disposed */ }
        }
        break;
      }

      case 'reorderItem': {
        logger.info(`reorderItem received: itemId=${message.data?.itemId}, afterId=${message.data?.afterId}, projectId=${this._projectId}`);
        if (!this._projectId || !message.data?.itemId) {
          logger.warn('reorderItem: missing required fields');
          return;
        }
        try {
          await this._reorderItem(
            this._projectId,
            message.data.itemId,
            message.data.afterId ?? null
          );
          logger.info(`reorderItem success for ${message.data.itemId}`);
          try {
            this._panel.webview.postMessage({
              type: 'itemReordered',
              data: { itemId: message.data.itemId },
            } as ExtensionToWebview);
          } catch { /* disposed */ }
        } catch (error) {
          const errorMsg = (error as Error).message;
          logger.error(`reorderItem FAILED: ${errorMsg}`);
          try {
            this._panel.webview.postMessage({
              type: 'error',
              data: { message: `Failed to reorder item: ${errorMsg}` },
            } as ExtensionToWebview);
          } catch { /* disposed */ }
        }
        break;
      }

      case 'refresh': {
        await this.refresh();
        break;
      }

      case 'selectIssue': {
        // Validate URL before opening — only allow https://github.com
        if (message.data?.issueId) {
          const url = message.data.issueId;
          try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('github.com')) {
              logger.warn(`Blocked attempt to open non-GitHub URL: ${url}`);
              return;
            }
            await vscode.env.openExternal(vscode.Uri.parse(url));
          } catch {
            logger.warn(`Invalid URL for selectIssue: ${url}`);
          }
        }
        break;
      }

      case 'assignAgent': {
        if (message.data?.issueId) {
          this._panel.webview.postMessage({
            type: 'agentProgress',
            data: { issueId: message.data.issueId, status: 'started' },
          } as ExtensionToWebview);
        }
        break;
      }
    }
  }

  /**
   * Load board data from GitHub.
   */
  private async _loadBoardData(projectId: string): Promise<BoardData> {
    const [items, fields] = await Promise.all([
      this._graphql.getProjectItems(projectId),
      this._graphql.getProjectFields(projectId),
    ]);

    // Build column mapping from fields
    const columns = this._buildColumns(fields);

    // Build items list
    const boardItems = items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.content?.title ?? 'Unknown',
      number: item.content?.number ?? 0,
      status: this._extractStatus(item),
      url: item.content?.url ?? '',
      repo: item.content?.repository?.name ?? '',
      labels: item.content?.labels?.nodes.map((l) => l.name) ?? [],
      priority: this._extractPriority(item.content?.labels?.nodes ?? []),
    }));

    return { columns, items: boardItems };
  }

  /**
   * Build columns from project fields.
   */
  private _buildColumns(fields: { name: string; id: string; options?: { id: string; name: string; color?: string }[] }[]): Array<{ id: string; name: string; color: string }> {
    const statusField = fields.find((f) => f.name === 'Status');
    if (!statusField?.options) {
      // Return default columns if no Status field found
      return [
        { id: 'BRAIN_DUMP', name: 'BRAIN_DUMP', color: 'gray' },
        { id: 'AI_SPEC', name: 'AI_SPEC', color: 'blue' },
        { id: 'HUMAN_SPEC_REVIEW', name: 'HUMAN_SPEC_REVIEW', color: 'yellow' },
        { id: 'AI_CODE', name: 'AI_CODE', color: 'green' },
        { id: 'HUMAN_CODE_REVIEW', name: 'HUMAN_CODE_REVIEW', color: 'purple' },
        { id: 'PR_DONE', name: 'PR_DONE', color: 'emerald' },
      ];
    }

    return statusField.options.map((option) => ({
      id: option.id,
      name: option.name,
      color: option.color ?? 'gray',
    }));
  }

  /**
   * Extract status from a project item.
   */
  private _extractStatus(item: { fieldValues: { nodes: { name?: string; field?: { name: string } }[] } }): string {
    for (const fv of item.fieldValues.nodes) {
      if (fv.field?.name === 'Status' && fv.name) {
        return fv.name;
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Move an item to a different column.
   */
  private async _moveItem(
    projectId: string,
    itemId: string,
    columnId: string
  ): Promise<{ id: string; status: string }> {
    logger.debug(`_moveItem: fetching project fields for ${projectId}`);
    const fields = await this._graphql.getProjectFields(projectId);
    const statusField = fields.find((f) => f.name === 'Status');

    if (!statusField) {
      logger.error(`_moveItem: Status field not found. Available fields: ${fields.map(f => f.name).join(', ')}`);
      throw new Error('Status field not found in project');
    }

    logger.debug(`_moveItem: Status field id=${statusField.id}, options=${JSON.stringify(statusField.options?.map(o => ({ id: o.id, name: o.name })))}`);
    logger.debug(`_moveItem: calling graphql.moveItem(projectId=${projectId}, itemId=${itemId}, fieldId=${statusField.id}, optionId=${columnId})`);
    const success = await this._graphql.moveItem(projectId, itemId, statusField.id, columnId);
    logger.debug(`_moveItem: graphql.moveItem returned success=${success}`);

    // Resolve the column name from the option ID for the response
    const columnName = statusField.options?.find((o) => o.id === columnId)?.name ?? columnId;
    return { id: itemId, status: columnName };
  }

  /**
   * Reorder an item within the project using updateProjectV2ItemPosition.
   */
  private async _reorderItem(
    projectId: string,
    itemId: string,
    afterId: string | null
  ): Promise<void> {
    logger.debug(`_reorderItem: projectId=${projectId}, itemId=${itemId}, afterId=${afterId}`);
    const success = await this._graphql.reorderItem(projectId, itemId, afterId);
    if (!success) {
      throw new Error('reorderItem returned no items');
    }
  }

  /**
   * Extract priority from labels.
   * Looks for labels starting with 'priority/' and returns the priority level.
   */
  private _extractPriority(labels: { name: string; color: string }[]): string | undefined {
    const priorityLabel = labels.find((l) => l.name.toLowerCase().startsWith('priority/'));
    return priorityLabel ? priorityLabel.name.replace(/^priority\//i, '') : undefined;
  }

  /**
   * Generate HTML for the webview with CSP nonce.
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const cacheBust = Date.now();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'assets', 'style.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource}; connect-src ${webview.cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}?v=${cacheBust}" rel="stylesheet">
    <title>AI OS Kanban</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">
      console.log('[AI OS] Inline script starting...');
      window.addEventListener('error', function(e) {
        console.error('[AI OS] JS error:', e.message, e.filename, e.lineno);
      });
      window.addEventListener('unhandledrejection', function(e) {
        console.error('[AI OS] Unhandled rejection:', e.reason);
      });
    </script>
    <script type="module" src="${scriptUri}?v=${cacheBust}"></script>
</body>
</html>`;
  }
}

/**
 * Generate a random nonce for CSP.
 */
function getNonce(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

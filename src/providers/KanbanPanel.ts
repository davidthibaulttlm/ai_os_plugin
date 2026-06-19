import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { GraphQLClient } from '../services/graphql';
import type { BoardData, ExtensionToWebview, IPCMessage, WebviewToExtension } from '../types/ipc';

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
        try {
          // Validate message structure
          if (!message || typeof message !== 'object' || !('type' in message)) {
            console.warn('[AI OS] Invalid IPC message received — missing type');
            return;
          }
          await this._handleMessage(message as WebviewToExtension);
        } catch (error) {
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
        retainContextWhenHidden: true,
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
   * Load initial board data asynchronously (fire-and-forget from constructor).
   */
  private async _loadInitialBoard(projectId: string): Promise<void> {
    try {
      console.log(`[AI OS] Loading initial board for project ${projectId}`);
      const boardData = await this._loadBoardData(projectId);
      console.log(`[AI OS] Board loaded: ${boardData.items.length} items, ${boardData.columns.length} columns`);
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
      console.error(`[AI OS] Error loading initial board: ${errorMsg}`);
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
        console.error(`[AI OS] Error in dispose callback: ${(error as Error).message}`);
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
    const allowedTypes = ['loadBoard', 'moveItem', 'refresh', 'selectIssue', 'assignAgent'];
    if (!allowedTypes.includes(message.type)) {
      console.warn(`[AI OS] Unknown IPC message type: ${message.type}`);
      return;
    }

    switch (message.type) {
      case 'loadBoard': {
        if (!message.data?.boardId || typeof message.data.boardId !== 'string') {
          console.warn('[AI OS] loadBoard: missing or invalid boardId');
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
        if (!this._projectId || !message.data?.itemId || !message.data?.columnId) {
          console.warn('[AI OS] moveItem: missing required fields');
          return;
        }
        const result = await this._moveItem(
          this._projectId,
          message.data.itemId,
          message.data.columnId
        );
        try {
          this._panel.webview.postMessage({
            type: 'itemMoved',
            data: result,
          } as ExtensionToWebview);
        } catch { /* disposed */ }
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
              console.warn(`[AI OS] Blocked attempt to open non-GitHub URL: ${url}`);
              return;
            }
            await vscode.env.openExternal(vscode.Uri.parse(url));
          } catch {
            console.warn(`[AI OS] Invalid URL for selectIssue: ${url}`);
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
    const fields = await this._graphql.getProjectFields(projectId);
    const statusField = fields.find((f) => f.name === 'Status');

    if (!statusField) {
      throw new Error('Status field not found in project');
    }

    await this._graphql.moveItem(projectId, itemId, statusField.id, columnId);

    // Resolve the column name from the option ID for the response
    const columnName = statusField.options?.find((o) => o.id === columnId)?.name ?? columnId;
    return { id: itemId, status: columnName };
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
    <link href="${styleUri}" rel="stylesheet">
    <title>AI OS Kanban</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
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

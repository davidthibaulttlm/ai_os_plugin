import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { GraphQLClient } from '../services/graphql';
import type { BoardData, ExtensionToWebview } from '../types/ipc';
import type { ColumnPromptService } from '../services/columnPrompt';
import { logger } from '../services/logger';

/**
 * Load board data from GitHub.
 */
export async function loadBoardData(graphql: GraphQLClient, projectId: string): Promise<BoardData> {
  logger.info(`[KanbanPanel.loadBoardData] Loading board data for project ${projectId}`);
  const [items, fields] = await Promise.all([
    graphql.getProjectItems(projectId),
    graphql.getProjectFields(projectId),
  ]);

  const columns = buildColumns(fields);

  const boardItems = items.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.content?.title ?? 'Unknown',
    number: item.content?.number ?? 0,
    status: extractStatus(item),
    url: item.content?.url ?? '',
    repo: item.content?.repository?.name ?? '',
    labels: item.content?.labels?.nodes.map((l) => l.name) ?? [],
    priority: extractPriority(item.content?.labels?.nodes ?? []),
  }));

  logger.info(`[KanbanPanel.loadBoardData] Loaded ${boardItems.length} items, ${columns.length} columns`);
  return { columns, items: boardItems };
}

/**
 * Build columns from project fields.
 */
export function buildColumns(fields: { name: string; id: string; options?: { id: string; name: string; color?: string }[] }[]): Array<{ id: string; name: string; color: string }> {
  const statusField = fields.find((f) => f.name === 'Status');
  if (!statusField?.options) {
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
export function extractStatus(item: { fieldValues: { nodes: { name?: string; field?: { name: string } }[] } }): string {
  for (const fv of item.fieldValues.nodes) {
    if (fv.field?.name === 'Status' && fv.name) {
      return fv.name;
    }
  }
  return 'UNKNOWN';
}

/**
 * Extract priority from labels.
 */
export function extractPriority(labels: { name: string; color: string }[]): string | undefined {
  const priorityLabel = labels.find((l) => l.name.toLowerCase().startsWith('priority/'));
  return priorityLabel ? priorityLabel.name.replace(/^priority\//i, '') : undefined;
}

/**
 * Move an item to a different column.
 */
export async function moveItem(
  graphql: GraphQLClient,
  projectId: string,
  itemId: string,
  columnId: string
): Promise<{ id: string; status: string }> {
  logger.debug(`[KanbanPanel.moveItem] Fetching project fields for ${projectId}`);
  const fields = await graphql.getProjectFields(projectId);
  const statusField = fields.find((f) => f.name === 'Status');

  if (!statusField) {
    logger.error(`[KanbanPanel.moveItem] Status field not found. Available fields: ${fields.map(f => f.name).join(', ')}`);
    throw new Error('Status field not found in project');
  }

  logger.debug(`[KanbanPanel.moveItem] Status field id=${statusField.id}, options=${JSON.stringify(statusField.options?.map(o => ({ id: o.id, name: o.name })))}`);
  logger.debug(`[KanbanPanel.moveItem] Calling graphql.moveItem(projectId=${projectId}, itemId=${itemId}, fieldId=${statusField.id}, optionId=${columnId})`);
  const success = await graphql.moveItem(projectId, itemId, statusField.id, columnId);
  logger.debug(`[KanbanPanel.moveItem] graphql.moveItem returned success=${success}`);

  const columnName = statusField.options?.find((o) => o.id === columnId)?.name ?? columnId;
  return { id: itemId, status: columnName };
}

/**
 * Reorder an item within the project.
 */
export async function reorderItem(
  graphql: GraphQLClient,
  projectId: string,
  itemId: string,
  afterId: string | null
): Promise<void> {
  logger.debug(`[KanbanPanel.reorderItem] projectId=${projectId}, itemId=${itemId}, afterId=${afterId}`);
  const success = await graphql.reorderItem(projectId, itemId, afterId);
  if (!success) {
    throw new Error('reorderItem returned no items');
  }
}

/**
 * Generate HTML for the webview with CSP nonce.
 */
export function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const cacheBust = Date.now();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'assets', 'index.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'assets', 'style.css')
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

/**
 * Generate a random nonce for CSP.
 */
function getNonce(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

import type { RepoManager } from '../services/repoManager';
import type { RepoPromptService } from '../services/repoPrompt';

export interface KanbanPanelContext {
  webview: vscode.Webview;
  projectId: string | undefined;
  setProjectId: (id: string) => void;
  graphql: GraphQLClient;
  promptService: ColumnPromptService;
  repoManager?: RepoManager;
  repoPromptService?: RepoPromptService;
  safePostMessage: (msg: ExtensionToWebview) => void;
  refresh: () => Promise<void>;
  loadBoardData: (projectId: string) => Promise<BoardData>;
  moveItem: (projectId: string, itemId: string, columnId: string) => Promise<{ id: string; status: string }>;
  reorderItem: (projectId: string, itemId: string, afterId: string | null) => Promise<void>;
}

// IPC message handlers extracted to KanbanPanel.handlers.ts
export { handleMessage } from './KanbanPanel.handlers';

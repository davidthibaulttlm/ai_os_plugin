import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { GraphQLClient } from '../services/graphql';
import type { BoardData, ExtensionToWebview, WebviewToExtension } from '../types/ipc';
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

export interface KanbanPanelContext {
  webview: vscode.Webview;
  projectId: string | undefined;
  setProjectId: (id: string) => void;
  graphql: GraphQLClient;
  promptService: ColumnPromptService;
  safePostMessage: (msg: ExtensionToWebview) => void;
  refresh: () => Promise<void>;
  loadBoardData: (projectId: string) => Promise<BoardData>;
  moveItem: (projectId: string, itemId: string, columnId: string) => Promise<{ id: string; status: string }>;
  reorderItem: (projectId: string, itemId: string, afterId: string | null) => Promise<void>;
}

const ALLOWED_TYPES = ['loadBoard', 'moveItem', 'reorderItem', 'refresh', 'selectIssue', 'assignAgent', 'saveColumnPrompt', 'resetColumnPrompt', 'requestColumnPrompts', '__ping__', '__inline_ping__', '__react_ready__', '__log__'];

/**
 * Handle incoming messages from the webview.
 */
export async function handleMessage(ctx: KanbanPanelContext, message: WebviewToExtension): Promise<void> {
  if (!ALLOWED_TYPES.includes(message.type)) {
    logger.warn(`Unknown IPC message type: ${message.type}`);
    return;
  }

  switch (message.type) {
    case 'loadBoard':
      await handleLoadBoard(ctx, message);
      break;
    case 'moveItem':
      await handleMoveItem(ctx, message);
      break;
    case 'reorderItem':
      await handleReorderItem(ctx, message);
      break;
    case 'refresh':
      await handleRefresh(ctx);
      break;
    case 'selectIssue':
      await handleSelectIssue(message);
      break;
    case 'assignAgent':
      handleAssignAgent(ctx, message);
      break;
    case '__log__':
      handleLog(message);
      break;
    case 'saveColumnPrompt':
      await handleSaveColumnPrompt(ctx, message);
      break;
    case 'resetColumnPrompt':
      await handleResetColumnPrompt(ctx, message);
      break;
    case 'requestColumnPrompts':
      await handleRequestColumnPrompts(ctx, message);
      break;
  }
}

async function handleLoadBoard(ctx: KanbanPanelContext, message: WebviewToExtension): Promise<void> {
  if (message.type !== 'loadBoard') return;
  if (!message.data?.boardId || typeof message.data.boardId !== 'string') {
    logger.warn('loadBoard: missing or invalid boardId');
    return;
  }
  ctx.setProjectId(message.data.boardId);
  const boardData = await ctx.loadBoardData(message.data.boardId);
  try {
    ctx.webview.postMessage({
      type: 'boardData',
      data: boardData,
    } as ExtensionToWebview);
  } catch { /* disposed */ }
}

async function handleMoveItem(ctx: KanbanPanelContext, message: WebviewToExtension): Promise<void> {
  if (message.type !== 'moveItem') return;
  logger.info(`moveItem received: itemId=${message.data?.itemId}, columnId=${message.data?.columnId}, projectId=${ctx.projectId}`);
  if (!ctx.projectId || !message.data?.itemId || !message.data?.columnId) {
    logger.warn('moveItem: missing required fields');
    return;
  }
  try {
    const result = await ctx.moveItem(ctx.projectId, message.data.itemId, message.data.columnId);
    logger.info(`moveItem success: ${JSON.stringify(result)}`);
    ctx.safePostMessage({ type: 'itemMoved', data: result });
  } catch (error) {
    const errorMsg = (error as Error).message;
    logger.error(`moveItem FAILED: ${errorMsg}`);
    ctx.safePostMessage({ type: 'error', data: { message: `Failed to move item: ${errorMsg}` } });
  }
}

async function handleReorderItem(ctx: KanbanPanelContext, message: WebviewToExtension): Promise<void> {
  if (message.type !== 'reorderItem') return;
  logger.info(`reorderItem received: itemId=${message.data?.itemId}, afterId=${message.data?.afterId}, projectId=${ctx.projectId}`);
  if (!ctx.projectId || !message.data?.itemId) {
    logger.warn('reorderItem: missing required fields');
    return;
  }
  try {
    await ctx.reorderItem(ctx.projectId, message.data.itemId, message.data.afterId ?? null);
    logger.info(`reorderItem success for ${message.data.itemId}`);
    ctx.safePostMessage({ type: 'itemReordered', data: { itemId: message.data.itemId } });
  } catch (error) {
    const errorMsg = (error as Error).message;
    logger.error(`reorderItem FAILED: ${errorMsg}`);
    ctx.safePostMessage({ type: 'error', data: { message: `Failed to reorder item: ${errorMsg}` } });
  }
}

async function handleRefresh(ctx: KanbanPanelContext): Promise<void> {
  await ctx.refresh();
}

async function handleSelectIssue(message: WebviewToExtension): Promise<void> {
  if (message.type !== 'selectIssue') return;
  if (!message.data?.issueId) return;
  const url = message.data.issueId;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('github.com')) {
      logger.warn(`Blocked attempt to open non-GitHub URL: ${url}`);
      return;
    }
    await vscode.env.openExternal(vscode.Uri.parse(url));
  } catch (error) {
    logger.warn(`Invalid URL for selectIssue: ${url} - ${(error as Error).message}`);
  }
}

function handleAssignAgent(ctx: KanbanPanelContext, message: WebviewToExtension): void {
  if (message.type !== 'assignAgent') return;
  if (!message.data?.issueId) return;
  ctx.webview.postMessage({
    type: 'agentProgress',
    data: { issueId: message.data.issueId, status: 'started' },
  } as ExtensionToWebview);
}

function handleLog(message: WebviewToExtension): void {
  if (message.type !== '__log__') return;
  const logData = message.data as { level?: string; message?: string };
  if (!logData?.message) return;
  switch (logData.level) {
    case 'error':
      logger.error(`[webview] ${logData.message}`);
      break;
    case 'warn':
      logger.warn(`[webview] ${logData.message}`);
      break;
    case 'debug':
      logger.debug(`[webview] ${logData.message}`);
      break;
    default:
      logger.info(`[webview] ${logData.message}`);
      break;
  }
}

async function handleSaveColumnPrompt(ctx: KanbanPanelContext, message: WebviewToExtension): Promise<void> {
  if (message.type !== 'saveColumnPrompt') return;
  logger.info(`[KanbanPanel._handleMessage] saveColumnPrompt: column=${message.data?.column}, type=${message.data?.promptType}`);
  if (!message.data?.column || !message.data?.promptType || !('value' in message.data)) {
    logger.warn('[KanbanPanel._handleMessage] saveColumnPrompt: missing required fields');
    return;
  }
  try {
    ctx.promptService.savePrompt(
      message.data.column,
      message.data.promptType as 'system' | 'developer',
      message.data.value
    );
    logger.info(`[KanbanPanel._handleMessage] saveColumnPrompt: saved for ${message.data.column}`);
  } catch (error) {
    logger.error(`[KanbanPanel._handleMessage] saveColumnPrompt error: ${(error as Error).message}`);
    ctx.safePostMessage({ type: 'error', data: { message: `Failed to save prompt: ${(error as Error).message}` } });
  }
}

async function handleResetColumnPrompt(ctx: KanbanPanelContext, message: WebviewToExtension): Promise<void> {
  if (message.type !== 'resetColumnPrompt') return;
  logger.info(`[KanbanPanel._handleMessage] resetColumnPrompt: column=${message.data?.column}, type=${message.data?.promptType}`);
  if (!message.data?.column || !message.data?.promptType) {
    logger.warn('[KanbanPanel._handleMessage] resetColumnPrompt: missing required fields');
    return;
  }
  try {
    ctx.promptService.resetPrompt(
      message.data.column,
      message.data.promptType as 'system' | 'developer'
    );
    logger.info(`[KanbanPanel._handleMessage] resetColumnPrompt: reset for ${message.data.column}`);
    loadAndSendColumnPrompts(ctx, message.data.column);
  } catch (error) {
    logger.error(`[KanbanPanel._handleMessage] resetColumnPrompt error: ${(error as Error).message}`);
    ctx.safePostMessage({ type: 'error', data: { message: `Failed to reset prompt: ${(error as Error).message}` } });
  }
}

async function handleRequestColumnPrompts(ctx: KanbanPanelContext, message: WebviewToExtension): Promise<void> {
  if (message.type !== 'requestColumnPrompts') return;
  logger.info(`[KanbanPanel._handleMessage] requestColumnPrompts: column=${message.data?.column}`);
  if (!message.data?.column) {
    logger.warn('[KanbanPanel._handleMessage] requestColumnPrompts: missing column');
    return;
  }
  try {
    logger.info(`[KanbanPanel._handleMessage] requestColumnPrompts: sending prompts for ${message.data.column}`);
    loadAndSendColumnPrompts(ctx, message.data.column);
  } catch (error) {
    logger.error(`[KanbanPanel._handleMessage] requestColumnPrompts error: ${(error as Error).message}`);
    ctx.safePostMessage({ type: 'error', data: { message: `Failed to load prompts: ${(error as Error).message}` } });
  }
}

/**
 * Load column prompts and send to webview.
 */
function loadAndSendColumnPrompts(ctx: KanbanPanelContext, column: string): void {
  const system = ctx.promptService.getSystemPrompt(column);
  const developer = ctx.promptService.getDeveloperPrompt(column);
  const systemDefault = ctx.promptService.getDefaultSystemPrompt(column);
  const developerDefault = ctx.promptService.getDefaultDeveloperPrompt(column);
  ctx.safePostMessage({
    type: 'columnPrompts',
    data: {
      column,
      system,
      developer,
      systemDefault,
      developerDefault,
    },
  } as ExtensionToWebview);
}

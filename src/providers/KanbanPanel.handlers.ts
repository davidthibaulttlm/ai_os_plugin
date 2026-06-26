/** IPC message handlers for KanbanPanel */

import * as vscode from 'vscode';
import type { ExtensionToWebview, WebviewToExtension } from '../types/ipc';
import { logger } from '../services/logger';
import type { KanbanPanelContext } from './KanbanPanel.helpers';

const ALLOWED_TYPES = ['loadBoard', 'moveItem', 'reorderItem', 'refresh', 'selectIssue', 'assignAgent', 'saveColumnPrompt', 'resetColumnPrompt', 'requestColumnPrompts', 'createCLAUDEmd', '__ping__', '__inline_ping__', '__react_ready__', '__log__'];

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
    case 'createCLAUDEmd':
      await handleCreateCLAUDEmd(ctx, message);
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

async function handleCreateCLAUDEmd(ctx: KanbanPanelContext, message: WebviewToExtension): Promise<void> {
  if (message.type !== 'createCLAUDEmd') return;
  logger.info(`[KanbanPanel.handleCreateCLAUDEmd] owner=${message.data?.owner} repo=${message.data?.repo}`);
  if (!message.data?.owner || !message.data?.repo) {
    logger.warn('[KanbanPanel.handleCreateCLAUDEmd] missing required fields');
    return;
  }
  if (!ctx.repoPromptService) {
    logger.warn('[KanbanPanel.handleCreateCLAUDEmd] no repoPromptService available');
    ctx.safePostMessage({
      type: 'claudeMdCreated',
      data: { success: false, error: 'RepoPromptService not available' },
    } as ExtensionToWebview);
    return;
  }
  try {
    const created = ctx.repoPromptService.createCLAUDEmdTemplate(message.data.owner, message.data.repo);
    const result = created
      ? { success: true }
      : { success: false, error: 'CLAUDE.md already exists or repo not cloned' };
    logger.info(`[KanbanPanel.handleCreateCLAUDEmd] Result: ${JSON.stringify(result)}`);
    ctx.safePostMessage({
      type: 'claudeMdCreated',
      data: result,
    } as ExtensionToWebview);
  } catch (error) {
    logger.error(`[KanbanPanel.handleCreateCLAUDEmd] Error: ${(error as Error).message}`);
    ctx.safePostMessage({
      type: 'claudeMdCreated',
      data: { success: false, error: (error as Error).message },
    } as ExtensionToWebview);
  }
}

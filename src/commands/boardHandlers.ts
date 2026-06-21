/** Board command handlers — extracted from extension.ts for modularity */

import * as vscode from 'vscode';
import { KanbanPanel } from '../providers/KanbanPanel';
import { openBoard } from './openBoard';
import { assignAgent } from './assignAgent';
import { logger } from '../services/logger';
import { getStateFilePath } from '../services/stateBridge';
import type { GraphQLClient } from '../services/graphql';
import type { PollerService } from '../services/poller';
import type { AgentService } from '../services/agent';
import type { RepoManager } from '../services/repoManager';
import type { StateManager } from '../services/state';
import type { ColumnPromptService } from '../services/columnPrompt';
import { checkMissingRepos } from './cloneRepos';

let panel: KanbanPanel | undefined;
let graphql: GraphQLClient | undefined;
let poller: PollerService | undefined;
let agentService: AgentService | undefined;
let repoManager: RepoManager | undefined;
let stateManager: StateManager | undefined;
let _globalStorageUri: string | undefined;
let boardTreeProvider: any | undefined;
let columnPromptService: ColumnPromptService | undefined;

export function setBoardHandlerDeps(
  p: KanbanPanel | undefined,
  g: GraphQLClient | undefined,
  pol: PollerService | undefined,
  a: AgentService | undefined,
  s: StateManager | undefined,
  uri: string | undefined,
  tree: any | undefined,
  rm: RepoManager | undefined,
  cps: ColumnPromptService | undefined
): void {
  panel = p;
  graphql = g;
  poller = pol;
  agentService = a;
  stateManager = s;
  _globalStorageUri = uri;
  boardTreeProvider = tree;
  repoManager = rm;
  columnPromptService = cps;
}

export function getPanel(): KanbanPanel | undefined { return panel; }
export function setPanel(p: KanbanPanel | undefined): void { panel = p; }

function createPollerCallback(): (events: Array<{ type: string; issueId: number; data: Record<string, unknown> }>) => void {
  return (events) => {
    void events;
    panel?.refresh();
  };
}

export async function handleOpenBoard(context: vscode.ExtensionContext): Promise<void> {
  logger.info('[handleOpenBoard] Opening board');
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }
  await openBoard(context.extensionUri, graphql, stateManager!, columnPromptService!, (p) => {
    panel = p;
    p.onDispose(() => {
      poller?.stop();
      logger.info('Poller stopped on panel dispose');
    });
    const boardId = stateManager?.getLastBoardId();
    if (boardId && graphql && poller) {
      agentService?.setProjectId(boardId);
      poller.start(graphql, boardId, createPollerCallback(), getStateFilePath(context.globalStorageUri.fsPath));
    }
  });
}

export async function handleAssignAgent(): Promise<void> {
  logger.info('[handleAssignAgent] Assign agent command invoked');
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }
  await assignAgent(graphql, agentService!);
}

export async function handleStartAgent(): Promise<void> {
  logger.info('[handleStartAgent] Start Agent command invoked');
  if (!agentService) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }
  try {
    const result = await agentService.startAgent();
    if (result.started && result.issueId) {
      vscode.window.showInformationMessage(`AI Agent started for issue #${result.issueId}`);
    } else if (result.reason === 'busy') {
      vscode.window.showInformationMessage(`Agent is busy working on #${agentService.getCurrentWip()}`);
    } else if (result.reason === 'empty') {
      vscode.window.showInformationMessage('No issues available for AI agent');
    } else if (result.reason === 'auto_move_failed') {
      vscode.window.showWarningMessage(
        `Failed to auto-move issue #${result.issueId} from BRAIN_DUMP to AI_SPEC`
      );
    }
  } catch (error) {
    logger.error(`[handleStartAgent] Error: ${(error as Error).message}`);
    vscode.window.showErrorMessage(`Failed to start agent: ${(error as Error).message}`);
  }
}

export async function loadProjectsAuto(ctx: vscode.ExtensionContext): Promise<void> {
  logger.info('[loadProjectsAuto] Starting auto-load');
  if (!graphql) return;
  try {
    boardTreeProvider?.setLoading(true);
    const projects = await graphql.listProjects();

    if (projects.length === 0) {
      boardTreeProvider?.setLoading(false);
      return;
    }

    boardTreeProvider?.setBoards(
      projects.map((p: any) => ({ id: p.id, name: p.title, number: p.number, url: p.url }))
    );

    // Auto-open last used board if exists
    const lastBoardId = stateManager?.getLastBoardId();
    if (lastBoardId) {
      const lastProject = projects.find((p: any) => p.id === lastBoardId);
      if (lastProject) {
        handleOpenBoardFromTree(ctx, lastBoardId, lastProject.title);
      }
    }
    boardTreeProvider?.setLoading(false);
  } catch (error) {
    boardTreeProvider?.setLoading(false);
    logger.error(`Failed to auto-load projects: ${(error as Error).message}`);
  }
}

export async function handleFetchBoards(): Promise<void> {
  logger.info('[handleFetchBoards] Fetching boards');
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }
  try {
    boardTreeProvider?.setLoading(true);
    const projects = await graphql.listProjects();
    if (projects.length === 0) {
      boardTreeProvider?.setLoading(false);
      vscode.window.showInformationMessage('No GitHub Projects found. Create one at https://github.com/projects');
      return;
    }
    boardTreeProvider?.setBoards(
      projects.map((p: any) => ({ id: p.id, name: p.title, number: p.number, url: p.url }))
    );
    boardTreeProvider?.setLoading(false);
  } catch (error) {
    boardTreeProvider?.setLoading(false);
    vscode.window.showErrorMessage(`Failed to load projects: ${(error as Error).message}`);
  }
}

export async function handleSelectBoard(): Promise<void> {
  logger.info('[handleSelectBoard] Selecting board');
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }
  try {
    const projects = await graphql.listProjects();
    if (projects.length === 0) {
      vscode.window.showInformationMessage('No GitHub Projects found. Create one at https://github.com/projects');
      return;
    }
    // Also populate the tree view
    boardTreeProvider?.setBoards(
      projects.map((p: any) => ({ id: p.id, name: p.title, number: p.number, url: p.url }))
    );
    const picks: vscode.QuickPickItem[] = projects.map((p) => ({
      label: p.title,
      description: `#${p.number}`,
      detail: p.url,
    }));
    const selected = await vscode.window.showQuickPick(picks, {
      placeHolder: 'Select a GitHub Project to open as a kanban board',
    });
    if (!selected) return;
    const project = projects.find((p) => p.title === selected.label);
    if (!project) return;
    await stateManager?.setLastBoardId(project.id);
    if (poller) {
      agentService?.setProjectId(project.id);
      poller.start(graphql, project.id, createPollerCallback(), getStateFilePath(_globalStorageUri!));
    }
    vscode.window.showInformationMessage(`Board "${project.title}" selected and polling started`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load projects: ${(error as Error).message}`);
  }
}

export async function handleOpenBoardFromTree(
  context: vscode.ExtensionContext,
  boardId: string,
  boardName: string
): Promise<void> {
  logger.info(`[handleOpenBoardFromTree] Opening board ${boardName}`);
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }
  await stateManager?.setLastBoardId(boardId);
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
  const p = KanbanPanel.createOrShow(context.extensionUri, graphql, columnPromptService!, boardId);
  panel = p;
  p.onDispose(() => {
    poller?.stop();
    logger.info('Poller stopped on panel dispose');
  });
  if (poller) {
    agentService?.setProjectId(boardId);
    poller.start(graphql, boardId, createPollerCallback(), getStateFilePath(context.globalStorageUri.fsPath));
  }
  vscode.window.showInformationMessage(`Opened board "${boardName}"`);

  setTimeout(async () => {
    if (poller && repoManager) {
      const items = poller.getItems();
      if (items.length > 0) {
        await checkMissingRepos(repoManager, items);
      }
    }
  }, 2000); // Wait for initial poll to complete
}

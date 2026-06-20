import * as vscode from 'vscode';
import { KanbanPanel } from './providers/KanbanPanel';
import { BoardTreeProvider } from './providers/BoardTreeProvider';
import { AuthService } from './services/auth';
import { StateManager } from './services/state';
import { GraphQLClient } from './services/graphql';
import { PollerService } from './services/poller';
import { AgentService } from './services/agent';
import { openBoard } from './commands/openBoard';
import { assignAgent } from './commands/assignAgent';
import { logger } from './services/logger';

let panel: KanbanPanel | undefined;
let graphql: GraphQLClient | undefined;
let poller: PollerService | undefined;
let agentService: AgentService | undefined;
let stateManager: StateManager | undefined;
let authServiceInstance: AuthService | undefined;
let boardTreeProvider: BoardTreeProvider | undefined;
let extensionUri: vscode.Uri | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info('Extension activating...');

  try {
    stateManager = new StateManager(context.globalState);
    authServiceInstance = new AuthService();

    // Register tree view for activity bar
    boardTreeProvider = new BoardTreeProvider();
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('aiOs.boardSelector', boardTreeProvider)
    );

    // Register ALL commands first — they check auth internally
    context.subscriptions.push(
      vscode.commands.registerCommand('aiOs.openBoard', () => handleOpenBoard(context)),
      vscode.commands.registerCommand('aiOs.openBoardFromTree', (boardId: string, boardName: string) =>
        handleOpenBoardFromTree(context, boardId, boardName)
      ),
      vscode.commands.registerCommand('aiOs.assignAgent', () => handleAssignAgent()),
      vscode.commands.registerCommand('aiOs.refreshBoard', () => {
        panel?.refresh();
        boardTreeProvider?.refresh();
      }),
      vscode.commands.registerCommand('aiOs.fetchBoards', () => handleFetchBoards()),
      vscode.commands.registerCommand('aiOs.selectBoard', () => handleSelectBoard()),
      vscode.commands.registerCommand('aiOs.moveToAISpec', () =>
        vscode.window.showInformationMessage('Use drag-and-drop on the kanban board to move items')
      ),
      vscode.commands.registerCommand('aiOs.moveToAICode', () =>
        vscode.window.showInformationMessage('Use drag-and-drop on the kanban board to move items')
      )
    );
    logger.info('Commands and tree view registered');

    // Init auth and services lazily
    const token = await authServiceInstance.getGitHubToken();
    if (!token) {
      logger.warn('No GitHub token — commands will prompt for auth');
      return;
    }

    // Validate token has required scopes
    const tokenValid = await authServiceInstance.validateToken(token);
    if (!tokenValid) {
      logger.warn('Token may have insufficient scopes');
    }

    graphql = new GraphQLClient(token);
    poller = new PollerService();
    agentService = new AgentService();

    agentService.setCallback(async (issueId: string, columnName: string) => {
      vscode.window.showInformationMessage(
        `AI Agent triggered for issue #${issueId} in column ${columnName}`
      );
      panel?.notifyAgentProgress(issueId, columnName);
    });

    // Store extension URI for auto-load
    extensionUri = context.extensionUri;

    // Auto-load projects on activation
    loadProjectsAuto(context.extensionUri);

    logger.info('Extension activated successfully');
  } catch (error) {
    console.error('[AI OS] Activation error:', error);
    vscode.window.showErrorMessage(
      `AI OS failed to activate: ${(error as Error).message}`
    );
  }
}

async function handleOpenBoard(context: vscode.ExtensionContext): Promise<void> {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }
  await openBoard(context.extensionUri, graphql, stateManager!, (p) => {
    panel = p;
    // Stop poller when panel is disposed
    p.onDispose(() => {
      poller?.stop();
      logger.info('Poller stopped on panel dispose');
    });
    const boardId = stateManager?.getLastBoardId();
    if (boardId && graphql && poller) {
      poller.start(graphql, boardId, (events) => {
        for (const event of events) {
          if (event.type === 'item_moved') {
            const toStatus = event.data.to as string;
            if (PollerService.isAiTriggerColumn(toStatus)) {
              agentService?.onAgentTrigger(String(event.issueId), toStatus);
            }
          } else if (event.type === 'item_added') {
            const status = event.data.status as string;
            if (PollerService.isAiTriggerColumn(status)) {
              agentService?.onAgentTrigger(String(event.issueId), status);
            }
          } else if (event.type === 'item_removed') {
            agentService?.cancelAgent(String(event.issueId));
          }
        }
        panel?.refresh();
      });
    }
  });
}

async function handleAssignAgent(): Promise<void> {
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }
  await assignAgent(graphql, agentService!);
}

/** Auto-load projects on activation (silent, no error toast) */
async function loadProjectsAuto(extUri: vscode.Uri): Promise<void> {
  if (!graphql) {
    return;
  }

  try {
    boardTreeProvider?.setLoading(true);
    const projects = await graphql.listProjects();

    if (projects.length === 0) {
      boardTreeProvider?.setLoading(false);
      return;
    }

    boardTreeProvider?.setBoards(
      projects.map((p) => ({ id: p.id, name: p.title, number: p.number, url: p.url }))
    );

    // Auto-open last used board if exists
    const lastBoardId = stateManager?.getLastBoardId();
    if (lastBoardId) {
      const lastProject = projects.find(p => p.id === lastBoardId);
      if (lastProject) {
        handleOpenBoardFromTree(
          { extensionUri: extUri } as vscode.ExtensionContext,
          lastBoardId,
          lastProject.title
        );
      }
    }
  } catch (error) {
    boardTreeProvider?.setLoading(false);
    logger.error(`Failed to auto-load projects: ${(error as Error).message}`);
  }
}

/** Fetch boards and populate the tree view (no quick pick) */
async function handleFetchBoards(): Promise<void> {
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }

  try {
    boardTreeProvider?.setLoading(true);
    const projects = await graphql.listProjects();

    if (projects.length === 0) {
      boardTreeProvider?.setLoading(false);
      vscode.window.showInformationMessage(
        'No GitHub Projects found. Create one at https://github.com/projects'
      );
      return;
    }

    boardTreeProvider?.setBoards(
      projects.map((p) => ({ id: p.id, name: p.title, number: p.number, url: p.url }))
    );
  } catch (error) {
    boardTreeProvider?.setLoading(false);
    vscode.window.showErrorMessage(`Failed to load projects: ${(error as Error).message}`);
  }
}

/** Select a board via quick pick (command palette only) */
async function handleSelectBoard(): Promise<void> {
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }

  try {
    const projects = await graphql.listProjects();

    if (projects.length === 0) {
      vscode.window.showInformationMessage(
        'No GitHub Projects found. Create one at https://github.com/projects'
      );
      return;
    }

    // Also populate the tree view
    boardTreeProvider?.setBoards(
      projects.map((p) => ({ id: p.id, name: p.title, number: p.number, url: p.url }))
    );

    const picks: vscode.QuickPickItem[] = projects.map((p) => ({
      label: p.title,
      description: `#${p.number}`,
      detail: p.url,
    }));

    const selected = await vscode.window.showQuickPick(picks, {
      placeHolder: 'Select a GitHub Project to open as a kanban board',
    });

    if (!selected) {
      return;
    }

    const project = projects.find((p) => p.title === selected.label);
    if (!project) {
      return;
    }

    await stateManager?.setLastBoardId(project.id);

    if (poller) {
      poller.stop();
      poller.start(graphql, project.id, (events) => {
        for (const event of events) {
          if (event.type === 'item_moved') {
            const toStatus = event.data.to as string;
            if (PollerService.isAiTriggerColumn(toStatus)) {
              agentService?.onAgentTrigger(String(event.issueId), toStatus);
            }
          } else if (event.type === 'item_added') {
            const status = event.data.status as string;
            if (PollerService.isAiTriggerColumn(status)) {
              agentService?.onAgentTrigger(String(event.issueId), status);
            }
          } else if (event.type === 'item_removed') {
            agentService?.cancelAgent(String(event.issueId));
          }
        }
        panel?.refresh();
      });
    }

    vscode.window.showInformationMessage(`Board "${project.title}" selected and polling started`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load projects: ${(error as Error).message}`);
  }
}

async function handleOpenBoardFromTree(
  context: vscode.ExtensionContext,
  boardId: string,
  boardName: string
): Promise<void> {
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }

  await stateManager?.setLastBoardId(boardId);

  // Dispose existing panel to switch boards — refresh() only reloads the same board
  if (panel) {
    panel.dispose();
    panel = undefined;
  }

  const p = KanbanPanel.createOrShow(context.extensionUri, graphql, boardId);
  panel = p;
  p.onDispose(() => {
    poller?.stop();
    logger.info('Poller stopped on panel dispose');
  });

  if (poller) {
    poller.stop();
    poller.start(graphql, boardId, (events) => {
      for (const event of events) {
        if (event.type === 'item_moved') {
          const toStatus = event.data.to as string;
          if (PollerService.isAiTriggerColumn(toStatus)) {
            agentService?.onAgentTrigger(String(event.issueId), toStatus);
          }
        } else if (event.type === 'item_added') {
          const status = event.data.status as string;
          if (PollerService.isAiTriggerColumn(status)) {
            agentService?.onAgentTrigger(String(event.issueId), status);
          }
        } else if (event.type === 'item_removed') {
          agentService?.cancelAgent(String(event.issueId));
        }
      }
      panel?.refresh();
    });
  }

  vscode.window.showInformationMessage(`Opened board "${boardName}"`);
}

export function deactivate(): void {
  poller?.stop();
  panel?.dispose();
  authServiceInstance?.clearToken();
  logger.info('Extension deactivated — poller stopped, token cleared');
  logger.dispose();
}

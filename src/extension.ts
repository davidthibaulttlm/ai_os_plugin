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

let panel: KanbanPanel | undefined;
let graphql: GraphQLClient | undefined;
let poller: PollerService | undefined;
let agentService: AgentService | undefined;
let stateManager: StateManager | undefined;
let authServiceInstance: AuthService | undefined;
let boardTreeProvider: BoardTreeProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[AI OS] Extension activating...');

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
      vscode.commands.registerCommand('aiOs.assignAgent', () => handleAssignAgent()),
      vscode.commands.registerCommand('aiOs.refreshBoard', () => {
        panel?.refresh();
        boardTreeProvider?.refresh();
      }),
      vscode.commands.registerCommand('aiOs.selectBoard', () => handleSelectBoard()),
      vscode.commands.registerCommand('aiOs.moveToAISpec', () =>
        vscode.window.showInformationMessage('Use drag-and-drop on the kanban board to move items')
      ),
      vscode.commands.registerCommand('aiOs.moveToAICode', () =>
        vscode.window.showInformationMessage('Use drag-and-drop on the kanban board to move items')
      )
    );
    console.log('[AI OS] Commands and tree view registered');

    // Init auth and services lazily
    const token = await authServiceInstance.getGitHubToken();
    if (!token) {
      console.warn('[AI OS] No GitHub token — commands will prompt for auth');
      return;
    }

    // Validate token has required scopes
    const tokenValid = await authServiceInstance.validateToken(token);
    if (!tokenValid) {
      console.warn('[AI OS] Token may have insufficient scopes');
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

    console.log('[AI OS] Extension activated successfully');
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
      console.log('[AI OS] Poller stopped on panel dispose');
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

async function handleSelectBoard(): Promise<void> {
  if (!graphql) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }

  const boardId = await vscode.window.showInputBox({
    prompt: 'Enter your GitHub Project (kanban) board ID',
    placeHolder: 'PVT_kw_DoeGm484A',
    ignoreFocusOut: true,
  });

  if (!boardId) {
    return;
  }

  stateManager?.setLastBoardId(boardId);
  boardTreeProvider?.setBoards([{ id: boardId, name: `Board ${boardId.slice(-6)}` }]);

  if (panel) {
    panel.refresh();
  }

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

  vscode.window.showInformationMessage(`Board ${boardId} selected and polling started`);
}

export function deactivate(): void {
  poller?.stop();
  panel?.dispose();
  authServiceInstance?.clearToken();
  console.log('[AI OS] Extension deactivated — poller stopped, token cleared');
}

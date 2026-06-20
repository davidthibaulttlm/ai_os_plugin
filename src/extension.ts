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
import { getStateFilePath } from './services/stateBridge';
import { ClaudeTrigger } from './services/claudeTrigger';
import { killAllClaudeProcesses, setWorkingStatusCallback } from './services/claudeSpawner';
import {
  handleConfigureClaude,
  handleDisconnectClaude,
  showOnboardingNotification,
  setAuthService,
} from './services/claudeConfig';

let panel: KanbanPanel | undefined;
let graphql: GraphQLClient | undefined;
let poller: PollerService | undefined;
let agentService: AgentService | undefined;
let stateManager: StateManager | undefined;
let authServiceInstance: AuthService | undefined;
let boardTreeProvider: BoardTreeProvider | undefined;
let globalStorageUri: string | undefined;
let claudeTrigger: ClaudeTrigger | undefined;
let mcpProviderDisposable: vscode.Disposable | undefined;

function createPollerCallback(): (events: Array<{ type: string; issueId: number; data: Record<string, unknown> }>) => void {
  return (events) => {
    void events;
    // Agent triggering is ONLY via "Start Agent" command — no reactive triggers.
    // The poller feeds board state to the agent service for prioritizer decisions.
    panel?.refresh();
  };
}

function registerCommands(context: vscode.ExtensionContext): void {
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
    ),
    vscode.commands.registerCommand('aiOs.openSettings', () => {
      if (boardTreeProvider) {
        boardTreeProvider.setMode(boardTreeProvider.mode === 'settings' ? 'boards' : 'settings');
      }
    }),
    vscode.commands.registerCommand('aiOs.configureClaude', () => handleConfigureClaude(context)),
    vscode.commands.registerCommand('aiOs.disconnectClaude', () => handleDisconnectClaude()),
    vscode.commands.registerCommand('aiOs.enableAutoWork', () => {
      vscode.workspace.getConfiguration('aiOs').update('autoWorkAssignments', true, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('Auto-work enabled. Claude will work on triggered issues.');
    }),
    vscode.commands.registerCommand('aiOs.toggleAutoWork', () => {
      const config = vscode.workspace.getConfiguration('aiOs');
      const current = config.get<boolean>('autoWorkAssignments', false);
      config.update('autoWorkAssignments', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Auto-work ${!current ? 'enabled' : 'disabled'}`);
      boardTreeProvider?.refresh();
    }),
    vscode.commands.registerCommand('aiOs.toggleConfirmFirst', () => {
      const config = vscode.workspace.getConfiguration('aiOs');
      const current = config.get<boolean>('autoWorkConfirmFirst', true);
      config.update('autoWorkConfirmFirst', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Confirm-first ${!current ? 'enabled' : 'disabled'}`);
      boardTreeProvider?.refresh();
    }),
    vscode.commands.registerCommand('aiOs.setMaxTurns', async () => {
      const current = vscode.workspace.getConfiguration('aiOs').get<number>('autoWorkMaxTurns', 25);
      const value = await vscode.window.showInputBox({
        prompt: 'Set max turns for Claude Code (1-100)',
        value: String(current),
        validateInput: (v) => {
          const n = parseInt(v, 10);
          if (isNaN(n) || n < 1 || n > 100) return 'Must be 1-100';
          return null;
        },
      });
      if (value) {
        vscode.workspace.getConfiguration('aiOs').update('autoWorkMaxTurns', parseInt(value, 10), vscode.ConfigurationTarget.Global);
        boardTreeProvider?.refresh();
      }
    }),
    vscode.commands.registerCommand('aiOs.setAllowedTools', async () => {
      const current = vscode.workspace.getConfiguration('aiOs').get<string>('autoWorkAllowedTools', '');
      const value = await vscode.window.showInputBox({
        prompt: 'Set allowed tools (comma-separated, empty = all)',
        value: current,
        placeHolder: 'fs_read,fs_write,Bash(git *)',
      });
      if (value !== undefined) {
        vscode.workspace.getConfiguration('aiOs').update('autoWorkAllowedTools', value, vscode.ConfigurationTarget.Global);
        boardTreeProvider?.refresh();
      }
    }),
    vscode.commands.registerCommand('aiOs.resetOnboarding', () => {
      vscode.workspace.getConfiguration('aiOs').update('onboardingDismissed', false, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('Onboarding reset. Reload the extension to see the connect dialog.');
      logger.info('[aiOs.resetOnboarding] Onboarding reset by user');
    }),
    vscode.commands.registerCommand('aiOs.startAgent', () => handleStartAgent()),
  );
}

async function initServices(context: vscode.ExtensionContext): Promise<void> {
  const token = await authServiceInstance!.getGitHubToken();
  if (!token) {
    logger.warn('No GitHub token — commands will prompt for auth');
    return;
  }

  const tokenValid = await authServiceInstance!.validateToken(token);
  if (!tokenValid) {
    logger.warn('Token may have insufficient scopes');
  }

  graphql = new GraphQLClient(token);
  poller = new PollerService();
  agentService = new AgentService();
  setAuthService(authServiceInstance!);

  // Wire agent service with GraphQL client
  agentService.setGraphql(graphql);

  // Wire poller with agent service for board state
  poller.setAgentService(agentService);

  claudeTrigger = new ClaudeTrigger();
  claudeTrigger.setCallback(async (event) => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      logger.warn('No workspace folder — cannot spawn Claude');
      return;
    }
    await claudeTrigger!.handleTrigger(event, token, workspaceRoot);
  });

  setWorkingStatusCallback((issueNumber, active) => {
    panel?.notifyWorkingStatus(issueNumber, active);
  });

  // Agent callback — invoked by startAgent(), calls finishAgent on completion
  agentService.setCallback(async (issueId: string, columnName: string) => {
    logger.info(`[initServices] Agent callback for #${issueId} in ${columnName}`);
    vscode.window.showInformationMessage(
      `AI Agent triggered for issue #${issueId} in column ${columnName}`
    );
    panel?.notifyAgentProgress(issueId, columnName);
    // When callback completes, signal finish and auto-trigger next
    await agentService!.finishAgent(issueId);
  });

  globalStorageUri = context.globalStorageUri.fsPath;
  registerMcpProvider(context, token);
  showOnboardingNotification();
  loadProjectsAuto(context);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info('Extension activating...');

  try {
    stateManager = new StateManager(context.globalState);
    authServiceInstance = new AuthService();

    boardTreeProvider = new BoardTreeProvider();
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('aiOs.boardSelector', boardTreeProvider)
    );

    registerCommands(context);
    logger.info('Commands and tree view registered');

    await initServices(context);
    logger.info('Extension activated successfully');
  } catch (error) {
    logger.error(`[activate] Activation error: ${(error as Error).message}`);
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
      agentService?.setProjectId(boardId);
      poller.start(graphql, boardId, createPollerCallback(), getStateFilePath(context.globalStorageUri.fsPath));
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

/** Start Agent command handler — runs prioritizer and launches agent */
async function handleStartAgent(): Promise<void> {
  logger.info('[handleStartAgent] Start Agent command invoked');

  if (!agentService) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
    return;
  }

  try {
    const result = await agentService.startAgent();
    if (result.started && result.issueId) {
      vscode.window.showInformationMessage(
        `AI Agent started for issue #${result.issueId}`
      );
    } else if (result.reason === 'busy') {
      vscode.window.showInformationMessage(
        `Agent is busy working on #${agentService.getCurrentWip()}`
      );
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

/** Auto-load projects on activation (silent, no error toast) */
async function loadProjectsAuto(ctx: vscode.ExtensionContext): Promise<void> {
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
          ctx,
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
      agentService?.setProjectId(project.id);
      poller.stop();
      poller.start(graphql, project.id, createPollerCallback(), getStateFilePath(globalStorageUri!));
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
    agentService?.setProjectId(boardId);
    poller.stop();
    poller.start(graphql, boardId, createPollerCallback(), getStateFilePath(context.globalStorageUri.fsPath));
  }

  vscode.window.showInformationMessage(`Opened board "${boardName}"`);
}

export function deactivate(): void {
  poller?.stop();
  panel?.dispose();
  authServiceInstance?.clearToken();
  mcpProviderDisposable?.dispose();
  killAllClaudeProcesses();
  logger.info('Extension deactivated — poller stopped, token cleared, Claude processes killed');
  logger.dispose();
}

function registerMcpProvider(context: vscode.ExtensionContext, token: string): void {
  const serverPath = vscode.Uri.joinPath(context.extensionUri, 'out', 'mcp', 'server.js');
  const stateFile = getStateFilePath(context.globalStorageUri.fsPath);

  // Use vscode.lm API if available (VS Code 1.93+)
  if (vscode.lm?.registerMcpServerDefinitionProvider) {
    const disposable = vscode.lm.registerMcpServerDefinitionProvider('aiOsMcpProvider', {
      provideMcpServerDefinitions: () => {
        return [{
          id: 'aiOsMcpProvider',
          label: 'AI OS Kanban Board',
          command: 'node',
          args: [serverPath.fsPath],
          env: {
            GITHUB_TOKEN: token,
            AI_OS_STATE_FILE: stateFile,
            AI_OS_MODE: 'vscode',
          },
        }];
      },
    });
    mcpProviderDisposable = disposable;
    context.subscriptions.push(disposable);
    logger.info('MCP server definition provider registered');
  } else {
    logger.info('VS Code lm API not available — MCP provider not registered (requires VS Code 1.93+)');
  }
}

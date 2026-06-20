import * as vscode from 'vscode';
import { BoardTreeProvider } from './providers/BoardTreeProvider';
import { AuthService } from './services/auth';
import { StateManager } from './services/state';
import { GraphQLClient } from './services/graphql';
import { PollerService } from './services/poller';
import { AgentService } from './services/agent';
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
import {
  handleOpenBoard,
  handleAssignAgent,
  handleStartAgent,
  handleFetchBoards,
  handleSelectBoard,
  handleOpenBoardFromTree,
  loadProjectsAuto,
  setBoardHandlerDeps,
  getPanel,
} from './commands/boardHandlers';

let graphql: GraphQLClient | undefined;
let poller: PollerService | undefined;
let agentService: AgentService | undefined;
let stateManager: StateManager | undefined;
let authServiceInstance: AuthService | undefined;
let boardTreeProvider: BoardTreeProvider | undefined;
let _globalStorageUri: string | undefined;
let claudeTrigger: ClaudeTrigger | undefined;
let mcpProviderDisposable: vscode.Disposable | undefined;

function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiOs.openBoard', () => handleOpenBoard(context)),
    vscode.commands.registerCommand('aiOs.openBoardFromTree', (boardId: string, boardName: string) =>
      handleOpenBoardFromTree(context, boardId, boardName)
    ),
    vscode.commands.registerCommand('aiOs.assignAgent', () => handleAssignAgent()),
    vscode.commands.registerCommand('aiOs.refreshBoard', () => {
      getPanel()?.refresh();
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

  agentService.setGraphql(graphql);
  poller.setAgentService(agentService);

  // Wire board handler dependencies
  setBoardHandlerDeps(getPanel(), graphql, poller, agentService, stateManager, context.globalStorageUri.fsPath, boardTreeProvider);

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
    getPanel()?.notifyWorkingStatus(issueNumber, active);
  });

  agentService.setCallback(async (issueId: string, columnName: string) => {
    logger.info(`[initServices] Agent callback for #${issueId} in ${columnName}`);
    vscode.window.showInformationMessage(
      `AI Agent triggered for issue #${issueId} in column ${columnName}`
    );
    getPanel()?.notifyAgentProgress(issueId, columnName);
    await agentService!.finishAgent(issueId);
  });

  _globalStorageUri = context.globalStorageUri.fsPath;
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

export function deactivate(): void {
  poller?.stop();
  getPanel()?.dispose();
  authServiceInstance?.clearToken();
  mcpProviderDisposable?.dispose();
  killAllClaudeProcesses();
  logger.info('Extension deactivated — poller stopped, token cleared, Claude processes killed');
  logger.dispose();
}

function registerMcpProvider(context: vscode.ExtensionContext, token: string): void {
  const serverPath = vscode.Uri.joinPath(context.extensionUri, 'out', 'mcp', 'server.js');
  const stateFile = getStateFilePath(context.globalStorageUri.fsPath);

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

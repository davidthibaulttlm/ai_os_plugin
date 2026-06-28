import * as vscode from 'vscode';
import { BoardTreeProvider, setTreeProviderDeps } from './providers/BoardTreeProvider';
import { AuthService } from './services/auth';
import { StateManager } from './services/state';
import { GraphQLClient } from './services/graphql';
import { PollerService } from './services/poller';
import { AgentService } from './services/agent';
import { RepoManager } from './services/repoManager';
import { logger } from './services/logger';
import { getStateFilePath } from './services/stateBridge';
import { ClaudeTrigger } from './services/claudeTrigger';
// claudeSpawner is deprecated — claudeHarness handles all agent spawning now.
// Import removed; stopAll() on claudeHarness replaces killAllClaudeProcesses().
import { ClaudeHarness } from './services/claudeHarness';
import { ColumnPromptService } from './services/columnPrompt';
import { RepoPromptService } from './services/repoPrompt';
import {
  handleConfigureClaude,
  handleDisconnectClaude,
  showOnboardingNotification,
  setAuthService,
} from './services/claudeConfig';
import {
  handleOpenBoard,
  handleAssignAgent,
  handleFetchBoards,
  handleSelectBoard,
  handleOpenBoardFromTree,
  loadProjectsAuto,
  setBoardHandlerDeps,
  getPanel,
} from './commands/boardHandlers';
import { handleCloneRepos } from './commands/cloneRepos';

let graphql: GraphQLClient | undefined;
let poller: PollerService | undefined;
let agentService: AgentService | undefined;
let repoManager: RepoManager | undefined;
let stateManager: StateManager | undefined;
let authServiceInstance: AuthService | undefined;
let boardTreeProvider: BoardTreeProvider | undefined;
let _globalStorageUri: string | undefined;
let claudeTrigger: ClaudeTrigger | undefined;
let claudeHarness: ClaudeHarness | undefined;
let columnPromptService: ColumnPromptService | undefined;
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
    vscode.commands.registerCommand('aiOs.openSettings', async () => {
      logger.info('[aiOs.openSettings] Open settings command invoked');
      if (boardTreeProvider) {
        const newMode = boardTreeProvider.mode === 'settings' ? 'boards' : 'settings';
        boardTreeProvider.setMode(newMode);
        await vscode.commands.executeCommand('setContext', 'aiOs.treeMode', newMode);
        logger.info(`[aiOs.openSettings] Mode set to ${newMode}`);
      }
    }),
    vscode.commands.registerCommand('aiOs.backToBoards', async () => {
      logger.info('[aiOs.backToBoards] Back to boards command invoked');
      if (boardTreeProvider) {
        boardTreeProvider.setMode('boards');
        await vscode.commands.executeCommand('setContext', 'aiOs.treeMode', 'boards');
        logger.info('[aiOs.backToBoards] Mode set to boards');
      }
    }),
    vscode.commands.registerCommand('aiOs.configureClaude', () => handleConfigureClaude(context)),
    vscode.commands.registerCommand('aiOs.disconnectClaude', () => handleDisconnectClaude()),
    vscode.commands.registerCommand('aiOs.cloneRepos', async () => {
      logger.info('[aiOs.cloneRepos] Clone repos command invoked');
      if (!repoManager || !graphql) {
        vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
        return;
      }
      const boardId = stateManager?.getLastBoardId();
      if (!boardId) {
        vscode.window.showErrorMessage('No board is currently open');
        return;
      }
      await handleCloneRepos(repoManager, graphql, boardId);
      boardTreeProvider?.refresh();
    }),
  );
  registerStartAgentCommand();
}


function registerStartAgentCommand(): void {
  vscode.commands.registerCommand('aiOs.startAgent', async () => {
    logger.info('[aiOs.startAgent] Start Agent command invoked');
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
      } else if (result.reason === 'no_assigned_issues') {
        vscode.window.showWarningMessage('No issues assigned to you. Assign yourself to an issue first.');
      } else if (result.reason === 'empty') {
        vscode.window.showInformationMessage('No issues available for AI agent');
      } else if (result.reason === 'auto_move_failed') {
        vscode.window.showWarningMessage(
          `Failed to auto-move issue #${result.issueId} from BRAIN_DUMP to AI_SPEC`
        );
      }
    } catch (error) {
      logger.error(`[aiOs.startAgent] Error: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`Failed to start agent: ${(error as Error).message}`);
    }
  });
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

  const reposDir = vscode.workspace.getConfiguration('aiOs').get<string>('reposDir', '~/ai-os-repos');
  repoManager = new RepoManager(reposDir, token);
  logger.info(`[initServices] RepoManager initialized with reposDir=${repoManager.getReposDir()}`);

  const repoPromptService = new RepoPromptService(repoManager);
  logger.info('[initServices] RepoPromptService initialized');

  // Pass RepoPromptService to ColumnPromptService
  columnPromptService = new ColumnPromptService(context.globalState, repoPromptService);
  logger.info('[initServices] ColumnPromptService initialized with RepoPromptService');

  setAuthService(authServiceInstance!);

  agentService.setGraphql(graphql);
  poller.setAgentService(agentService);
  poller.setRepoManager(repoManager);

  // Set current user for assignee filtering
  try {
    const viewerLogin = await graphql.getViewerLogin();
    agentService.setCurrentUser(viewerLogin);
    logger.info(`[initServices] setCurrentUser=${viewerLogin}`);
  } catch (error) {
    logger.error(`[initServices] Failed to get viewer login: ${(error as Error).message}`);
  }

  setBoardHandlerDeps(getPanel(), graphql, poller, agentService, stateManager, context.globalStorageUri.fsPath, boardTreeProvider, repoManager, columnPromptService, repoPromptService);
  setTreeProviderDeps(repoManager, stateManager);

  // Set GITHUB_TOKEN in environment so ClaudeHarness can pass it to spawned processes
  process.env.GITHUB_TOKEN = token;
  logger.info('[initServices] GITHUB_TOKEN set in environment');

  // Instantiate ClaudeHarness with dependencies
  const panel = getPanel();
  claudeHarness = new ClaudeHarness(repoManager, graphql, columnPromptService, panel?.webview);
  logger.info('[initServices] ClaudeHarness initialized');

  claudeTrigger = new ClaudeTrigger(columnPromptService);
  claudeTrigger.setCallback(async (event) => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      logger.warn('No workspace folder — cannot spawn Claude');
      return;
    }
    await claudeTrigger!.handleTrigger(event, token, workspaceRoot);
  });

  // claudeSpawner callbacks removed — claudeHarness handles status/finish internally.

  setupAgentCallback(token);

  _globalStorageUri = context.globalStorageUri.fsPath;
  registerMcpProvider(context, token);
  showOnboardingNotification();
  loadProjectsAuto(context);
}

async function setupAgentCallback(_token: string): Promise<void> {
  logger.info('[setupAgentCallback] Setting up agent callback');
  agentService!.setCallback(async (options) => {
    const { issueId, columnName, title, body, owner, repo } = options;
    logger.info(`[setupAgentCallback] Agent callback for #${issueId} in ${columnName} title=${title} body=${body ? String(body.length) + 'chars' : 'empty'} owner=${owner} repo=${repo}`);
    vscode.window.showInformationMessage(
      `AI Agent triggered for issue #${issueId} in column ${columnName}`
    );
    getPanel()?.notifyAgentProgress(issueId, columnName);

    // Use ClaudeHarness if available and repo context is present
    if (claudeHarness && owner && repo) {
      const issueNumber = parseInt(issueId, 10);
      const issueTitle = title ?? `Issue #${issueId}`;
      logger.info(`[setupAgentCallback] Delegating to ClaudeHarness for ${owner}/${repo} #${issueNumber}`);

      const result = await claudeHarness.run({
        issueNumber,
        owner,
        repo,
        title: issueTitle,
        body,
        column: columnName,
      });

      logger.info(`[setupAgentCallback] Harness result: success=${result.success} reason=${result.reason}`);

      // On completion, clear WIP and trigger next issue
      await agentService!.finishAgent(issueId);

      if (result.success && result.prUrl) {
        vscode.window.showInformationMessage(`Agent completed for #${issueNumber}. PR: ${result.prUrl}`);
      } else if (!result.success) {
        vscode.window.showWarningMessage(`Agent failed for #${issueNumber}: ${result.reason}`);
      }
      return;
    }

    // Fallback: legacy claudeTrigger path
    let workDir: string | undefined;
    if (owner && repo && repoManager) {
      const issueNumber = parseInt(issueId, 10);
      const issueTitle = title ?? `Issue #${issueId}`;
      logger.info(`[setupAgentCallback] Checking if repo ${owner}/${repo} is cloned`);
      const isCloned = repoManager.isRepoCloned(owner, repo);
      logger.info(`[setupAgentCallback] Repo ${owner}/${repo} cloned=${isCloned}`);
      if (!isCloned) {
        logger.warn(`[setupAgentCallback] Repo ${owner}/${repo} not cloned — attempting clone`);
        const cloneResults = await repoManager.cloneOrUpdateRepos([{ owner, repo }]);
        const cloneOk = cloneResults.length > 0 && cloneResults[0].success;
        logger.info(`[setupAgentCallback] Clone result: success=${cloneOk} error=${cloneResults[0].error ?? 'none'}`);
        if (!cloneOk) {
          logger.error(`[setupAgentCallback] Failed to clone ${owner}/${repo}: ${cloneResults[0].error}`);
          vscode.window.showWarningMessage(`Failed to clone ${owner}/${repo}: ${cloneResults[0].error}`);
          return;
        }
      }
      logger.info(`[setupAgentCallback] Creating/updating worktree for ${owner}/${repo} #${issueNumber}`);
      const worktreeResult = await repoManager.createWorktree(owner, repo, issueNumber, issueTitle);
      if (worktreeResult.success && worktreeResult.path) {
        await repoManager.updateWorktree(worktreeResult.path);
        workDir = worktreeResult.path;
        logger.info(`[setupAgentCallback] Using worktree: ${workDir}`);
      } else {
        logger.warn(`[setupAgentCallback] Failed to create worktree: ${worktreeResult.error}`);
        vscode.window.showWarningMessage(`Failed to create worktree: ${worktreeResult.error}`);
      }
    }

    if (!workDir) {
      workDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workDir) {
        logger.warn('[setupAgentCallback] No workspace folder or worktree — cannot spawn Claude');
        vscode.window.showErrorMessage('No workspace folder. Clone repos first or open a workspace.');
        return;
      }
    }

    const triggerEvent = {
      issueNumber: parseInt(issueId, 10),
      title: title ?? `Issue #${issueId}`,
      body,
      column: columnName,
      reason: 'assigned' as const,
    };
    await claudeTrigger!.handleTrigger(triggerEvent, _token, workDir);
  });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info('Extension activating...');

  // Set initial context key for tree mode
  await vscode.commands.executeCommand('setContext', 'aiOs.treeMode', 'boards');
  logger.info('[activate] Set initial treeMode context key to boards');

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
  claudeHarness?.stopAll();
  // killAllClaudeProcesses() removed — claudeHarness.stopAll() handles cleanup
  getPanel()?.dispose();
  authServiceInstance?.clearToken();
  mcpProviderDisposable?.dispose();
  logger.info('Extension deactivated — poller stopped, harness stopped, token cleared');
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

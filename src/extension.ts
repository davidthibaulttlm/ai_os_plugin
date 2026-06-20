import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KanbanPanel } from './providers/KanbanPanel';
import { BoardTreeProvider } from './providers/BoardTreeProvider';
import { SettingsPanel } from './providers/SettingsPanel';
import { AuthService } from './services/auth';
import { StateManager } from './services/state';
import { GraphQLClient } from './services/graphql';
import { PollerService } from './services/poller';
import { AgentService } from './services/agent';
import { openBoard } from './commands/openBoard';
import { assignAgent } from './commands/assignAgent';
import { logger } from './services/logger';
import { writeBoardState, getStateFilePath } from './services/stateBridge';
import { detectClaudeCode } from './services/claudeDetector';
import { ClaudeTrigger } from './services/claudeTrigger';
import { killAllClaudeProcesses, setWorkingStatusCallback } from './services/claudeSpawner';

let panel: KanbanPanel | undefined;
let graphql: GraphQLClient | undefined;
let poller: PollerService | undefined;
let agentService: AgentService | undefined;
let stateManager: StateManager | undefined;
let authServiceInstance: AuthService | undefined;
let boardTreeProvider: BoardTreeProvider | undefined;
let extensionUri: vscode.Uri | undefined;
let claudeTrigger: ClaudeTrigger | undefined;
let mcpProviderDisposable: vscode.Disposable | undefined;

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
      ),
      // MCP and Settings commands
      vscode.commands.registerCommand('aiOs.openSettings', () => {
        if (boardTreeProvider) {
          const currentMode = (boardTreeProvider as any).mode as string;
          (boardTreeProvider as any).setMode(currentMode === 'settings' ? 'boards' : 'settings');
        }
      }),
      vscode.commands.registerCommand('aiOs.configureClaude', () => handleConfigureClaude(context)),
      vscode.commands.registerCommand('aiOs.disconnectClaude', () => handleDisconnectClaude()),
      vscode.commands.registerCommand('aiOs.enableAutoWork', () => {
        vscode.workspace.getConfiguration('aiOs').update('autoWorkAssignments', true, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Auto-work enabled. Claude will work on triggered issues.');
      }),
      // Settings tree item commands
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
      // Reset onboarding to show the connect dialog again
      vscode.commands.registerCommand('aiOs.resetOnboarding', () => {
        vscode.workspace.getConfiguration('aiOs').update('onboardingDismissed', false, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Onboarding reset. Reload the extension to see the connect dialog.');
        logger.info('[aiOs.resetOnboarding] Onboarding reset by user');
      }),
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

    // Setup Claude trigger
    claudeTrigger = new ClaudeTrigger();
    claudeTrigger.setCallback(async (event) => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        logger.warn('No workspace folder — cannot spawn Claude');
        return;
      }
      await claudeTrigger!.handleTrigger(event, token, workspaceRoot);
    });

    // Setup working status callback for webview spinner
    setWorkingStatusCallback((issueNumber, active) => {
      panel?.notifyWorkingStatus(issueNumber, active);
    });

    agentService.setCallback(async (issueId: string, columnName: string) => {
      vscode.window.showInformationMessage(
        `AI Agent triggered for issue #${issueId} in column ${columnName}`
      );
      panel?.notifyAgentProgress(issueId, columnName);
    });

    // Store extension URI for auto-load
    extensionUri = context.extensionUri;

    // Register MCP server definition provider
    registerMcpProvider(context, token);

    // Show onboarding notification if Claude not configured
    showOnboardingNotification();

    // Auto-load projects on activation
    loadProjectsAuto(context);

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
      }, getStateFilePath(context.globalStorageUri.fsPath));
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
      }, getStateFilePath(extensionUri!.fsPath));
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
    }, getStateFilePath(context.globalStorageUri.fsPath));
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

// ===== MCP Provider =====

function registerMcpProvider(context: vscode.ExtensionContext, token: string): void {
  const serverPath = vscode.Uri.joinPath(context.extensionUri, 'out', 'mcp', 'server.js');
  const stateFile = getStateFilePath(context.globalStorageUri.fsPath);

  // Use vscode.lm API if available (VS Code 1.93+)
  if ((vscode as any).lm?.registerMcpServerDefinitionProvider) {
    const disposable = (vscode as any).lm.registerMcpServerDefinitionProvider('aiOsMcpProvider', {
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

// ===== Claude Configuration Commands =====

/**
 * All Claude config file paths that may contain MCP server definitions.
 * Claude Code reads from multiple locations depending on how it's invoked.
 */
/**
 * Detect the platform where Claude Code runs.
 * VS Code Server on WSL reports os.platform() as 'linux'.
 * The Claude Code VS Code extension runs inside the VS Code Server environment.
 */
function getClaudePlatform(): 'linux' | 'win32' | 'darwin' {
  return os.platform() as 'linux' | 'win32' | 'darwin';
}

/**
 * Get the node command for the current platform.
 * Claude Code VS Code extension runs inside VS Code Server, so on WSL it uses native Linux node.
 */
function getNodeCommand(): string {
  const platform = getClaudePlatform();
  if (platform === 'win32') {
    return 'node';
  }
  // Linux (including WSL) and macOS use /usr/bin/node or 'node'
  return 'node';
}

/**
 * Get ALL Claude Code config file paths where MCP servers are read.
 * Claude Code VS Code extension reads from:
 * - ~/.claude.json (global mcpServers section)
 * - ~/.claude/.mcp.json (MCP-specific config)
 * - ~/.claude/settings.json (general settings, some versions read MCP here)
 * - .mcp.json in workspace root (project-scoped)
 */
function getClaudeConfigPaths(): string[] {
  const home = os.homedir();
  const claudeDir = path.join(home, '.claude');
  const paths: string[] = [
    path.join(home, '.claude.json'),             // Global MCP config (PRIMARY)
    path.join(claudeDir, '.mcp.json'),           // MCP-specific config
    path.join(claudeDir, 'settings.json'),       // General settings
  ];

  // Add workspace-level .mcp.json if workspace is open
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    const projectMcp = path.join(workspaceFolder.uri.fsPath, '.mcp.json');
    paths.push(projectMcp);
    logger.info(`[getClaudeConfigPaths] Added project .mcp.json: ${projectMcp}`);
  }

  return paths;
}

/**
 * Build the MCP server entry for the current platform.
 */
function buildMcpEntry(serverPath: string, stateFile: string, token: string): any {
  return {
    command: getNodeCommand(),
    args: [serverPath],
    env: {
      GITHUB_TOKEN: token,
      AI_OS_STATE_FILE: stateFile,
      AI_OS_MODE: 'claude',
    },
  };
}

/**
 * Write the ai-os MCP entry to ALL Claude config files.
 * Handles both ~/.claude.json (has projects + global mcpServers) and flat config files.
 */
function writeMcpToAllConfigs(
  configPaths: string[],
  serverPath: string,
  stateFile: string,
  token: string
): void {
  const mcpEntry = buildMcpEntry(serverPath, stateFile, token);
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  for (const configFile of configPaths) {
    const dir = path.dirname(configFile);
    if (!fs.existsSync(dir)) {
      logger.info(`[writeMcpToAllConfigs] Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }

    let data: any = {};
    if (fs.existsSync(configFile)) {
      try {
        data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        logger.info(`[writeMcpToAllConfigs] Read existing ${configFile}`);
      } catch (error) {
        logger.error(`[writeMcpToAllConfigs] Failed to parse ${configFile}: ${(error as Error).message}`);
        data = {};
      }
    }

    // ~/.claude.json has both global mcpServers AND projects
    if (configFile.endsWith('.claude.json')) {
      // Write to global mcpServers
      data.mcpServers = data.mcpServers || {};
      data.mcpServers['ai-os'] = mcpEntry;

      // Also write to current workspace project entry to prevent empty override
      if (workspaceFolder && data.projects) {
        if (!data.projects[workspaceFolder]) {
          data.projects[workspaceFolder] = {
            allowedTools: [],
            mcpContextUris: [],
            mcpServers: {},
            enabledMcpjsonServers: [],
            disabledMcpjsonServers: [],
            hasTrustDialogAccepted: false,
            projectOnboardingSeenCount: 0,
          };
        }
        data.projects[workspaceFolder].mcpServers = data.projects[workspaceFolder].mcpServers || {};
        data.projects[workspaceFolder].mcpServers['ai-os'] = mcpEntry;
        logger.info(`[writeMcpToAllConfigs] Wrote to project entry: ${workspaceFolder}`);
      }
    } else {
      // Flat config files: settings.json, .mcp.json
      data.mcpServers = data.mcpServers || {};
      data.mcpServers['ai-os'] = mcpEntry;
    }

    fs.writeFileSync(configFile, JSON.stringify(data, null, 2), 'utf-8');
    try {
      fs.chmodSync(configFile, 0o600);
    } catch {
      // Windows doesn't support chmod
    }
    logger.info(`[writeMcpToAllConfigs] Wrote ai-os MCP to ${configFile}`);
  }
}

/**
 * Check if ai-os MCP is configured in ANY Claude config file.
 */
function isMcpConfigured(configPaths: string[]): boolean {
  for (const configFile of configPaths) {
    if (!fs.existsSync(configFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      // Check global mcpServers
      if (data.mcpServers?.['ai-os']) {
        logger.info(`[isMcpConfigured] Found ai-os in ${configFile}`);
        return true;
      }
      // Check project entries in .claude.json
      if (data.projects) {
        for (const projectPath of Object.keys(data.projects)) {
          if (data.projects[projectPath]?.mcpServers?.['ai-os']) {
            logger.info(`[isMcpConfigured] Found ai-os in project ${projectPath} of ${configFile}`);
            return true;
          }
        }
      }
    } catch (error) {
      logger.warn(`[isMcpConfigured] Failed to parse ${configFile}: ${(error as Error).message}`);
    }
  }
  return false;
}

/**
 * Remove ai-os MCP from ALL Claude config files.
 */
function removeMcpFromAllConfigs(configPaths: string[]): void {
  for (const configFile of configPaths) {
    if (!fs.existsSync(configFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

      // Remove from global mcpServers
      if (data.mcpServers?.['ai-os']) {
        delete data.mcpServers['ai-os'];
      }

      // Remove from all project entries
      if (data.projects) {
        for (const projectPath of Object.keys(data.projects)) {
          if (data.projects[projectPath]?.mcpServers?.['ai-os']) {
            delete data.projects[projectPath].mcpServers['ai-os'];
          }
        }
      }

      fs.writeFileSync(configFile, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`[removeMcpFromAllConfigs] Removed ai-os from ${configFile}`);
    } catch (error) {
      logger.error(`[removeMcpFromAllConfigs] Failed to update ${configFile}: ${(error as Error).message}`);
    }
  }
}

async function handleConfigureClaude(context: vscode.ExtensionContext): Promise<void> {
  logger.info('[handleConfigureClaude] Starting Claude configuration...');

  const token = await authServiceInstance?.getGitHubToken();
  if (!token) {
    logger.warn('[handleConfigureClaude] No GitHub token found');
    vscode.window.showErrorMessage('Not authenticated. Sign in with GitHub first.');
    return;
  }
  logger.info(`[handleConfigureClaude] Got GitHub token (length=${token.length})`);

  // Check Claude installation
  const claude = detectClaudeCode();
  logger.info(`[handleConfigureClaude] Claude detection: cliInstalled=${claude.cliInstalled}, extensionInstalled=${claude.extensionInstalled}`);
  if (!claude.cliInstalled) {
    const selection = await vscode.window.showWarningMessage(
      'Claude Code CLI not found. Auto-work will not work. Install from https://claude.ai/download?',
      'Install',
      'Configure Anyway'
    );
    logger.info(`[handleConfigureClaude] User selected: ${selection}`);
    if (selection === 'Install') {
      vscode.env.openExternal(vscode.Uri.parse('https://claude.ai/download'));
      return;
    }
  }

  const serverPath = vscode.Uri.joinPath(context.extensionUri, 'out', 'mcp', 'server.js');
  const stateFile = getStateFilePath(context.globalStorageUri.fsPath);
  const configPaths = getClaudeConfigPaths();
  logger.info(`[handleConfigureClaude] serverPath=${serverPath.fsPath}`);
  logger.info(`[handleConfigureClaude] stateFile=${stateFile}`);
  logger.info(`[handleConfigureClaude] configPaths=${JSON.stringify(configPaths)}`);

  // Write to ALL Claude config files
  writeMcpToAllConfigs(configPaths, serverPath.fsPath, stateFile, token);

  const result = vscode.window.showInformationMessage(
    'AI OS tools configured for Claude Code! Restart Claude Code for changes to take effect.',
    'Restart Claude Code',
    'Open Output',
    'Dismiss'
  );
  result.then((selection) => {
    logger.info(`[handleConfigureClaude] User clicked: ${selection}`);
    if (selection === 'Restart Claude Code') {
      // Show instructions for restarting Claude Code
      const restartMsg = vscode.window.showInformationMessage(
        [
          'To restart Claude Code:',
          '',
          '• If using Claude Code CLI: press Ctrl+C to stop, then run `claude` again',
          '• If using Claude VS Code extension: reload the VS Code window with Ctrl+Shift+P → "Developer: Reload Window"',
          '',
          'Claude will load the AI OS MCP tools on next startup.'
        ].join('\n'),
        'Reload VS Code Window',
        'Got it'
      );
      restartMsg.then((sel) => {
        logger.info(`[handleConfigureClaude] Restart instruction click: ${sel}`);
        if (sel === 'Reload VS Code Window') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
    } else if (selection === 'Open Output') {
      vscode.commands.executeCommand('ai-os.showOutput');
    }
  });
}

async function handleDisconnectClaude(): Promise<void> {
  logger.info('[handleDisconnectClaude] Starting Claude disconnect...');

  const configPaths = getClaudeConfigPaths();
  logger.info(`[handleDisconnectClaude] configPaths=${JSON.stringify(configPaths)}`);

  if (!isMcpConfigured(configPaths)) {
    logger.info('[handleDisconnectClaude] ai-os not configured in any Claude config');
    vscode.window.showInformationMessage('AI OS was not configured in Claude Code.');
    return;
  }

  removeMcpFromAllConfigs(configPaths);

  vscode.window.showInformationMessage('AI OS disconnected from Claude Code.');
}

function showOnboardingNotification(): void {
  logger.info('[showOnboardingNotification] Checking if onboarding needed...');

  const configPaths = getClaudeConfigPaths();
  logger.info(`[showOnboardingNotification] configPaths=${JSON.stringify(configPaths)}`);

  if (isMcpConfigured(configPaths)) {
    logger.info('[showOnboardingNotification] Already configured, skipping onboarding');
    return;
  }

  // Check if user dismissed onboarding
  const dismissed = vscode.workspace.getConfiguration('aiOs').get<boolean>('onboardingDismissed', false);
  if (dismissed) {
    logger.info('[showOnboardingNotification] Onboarding dismissed by user, skipping');
    return;
  }

  logger.info('[showOnboardingNotification] Showing onboarding notification');
  vscode.window.showInformationMessage(
    'AI OS installed! Connect to Claude Code?',
    'Connect Now',
    'Later',
    "Don't ask again"
  ).then((selection) => {
    logger.info(`[showOnboardingNotification] User selected: ${selection}`);
    if (selection === 'Connect Now') {
      vscode.commands.executeCommand('aiOs.configureClaude');
    } else if (selection === "Don't ask again") {
      vscode.workspace.getConfiguration('aiOs').update('onboardingDismissed', true, vscode.ConfigurationTarget.Global);
      logger.info('[showOnboardingNotification] User dismissed onboarding permanently');
    }
  });
}

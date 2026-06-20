import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from './logger';
import { detectClaudeCode } from './claudeDetector';
import { getStateFilePath } from './stateBridge';

let authServiceInstance: { getGitHubToken: () => Promise<string | undefined> } | undefined;

export function setAuthService(auth: typeof authServiceInstance): void {
  authServiceInstance = auth;
}

function getClaudePlatform(): 'linux' | 'win32' | 'darwin' {
  return os.platform() as 'linux' | 'win32' | 'darwin';
}

function getNodeCommand(): string {
  const platform = getClaudePlatform();
  if (platform === 'win32') {
    return 'node';
  }
  return 'node';
}

export function getClaudeConfigPaths(): string[] {
  const home = os.homedir();
  const claudeDir = path.join(home, '.claude');
  const paths: string[] = [
    path.join(home, '.claude.json'),
    path.join(claudeDir, '.mcp.json'),
    path.join(claudeDir, 'settings.json'),
  ];

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    const projectMcp = path.join(workspaceFolder.uri.fsPath, '.mcp.json');
    paths.push(projectMcp);
    logger.info(`[getClaudeConfigPaths] Added project .mcp.json: ${projectMcp}`);
  }

  return paths;
}

function buildMcpEntry(serverPath: string, stateFile: string, token: string): Record<string, unknown> {
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

    let data: Record<string, unknown> = {};
    if (fs.existsSync(configFile)) {
      try {
        data = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as Record<string, unknown>;
        logger.info(`[writeMcpToAllConfigs] Read existing ${configFile}`);
      } catch (error) {
        logger.error(`[writeMcpToAllConfigs] Failed to parse ${configFile}: ${(error as Error).message}`);
        data = {};
      }
    }

    if (configFile.endsWith('.claude.json')) {
      const mcpServers = (data.mcpServers as Record<string, unknown>) || {};
      mcpServers['ai-os'] = mcpEntry;
      data.mcpServers = mcpServers;

      if (workspaceFolder && data.projects) {
        const projects = data.projects as Record<string, Record<string, unknown>>;
        if (!projects[workspaceFolder]) {
          projects[workspaceFolder] = {
            allowedTools: [],
            mcpContextUris: [],
            mcpServers: {},
            enabledMcpjsonServers: [],
            disabledMcpjsonServers: [],
            hasTrustDialogAccepted: false,
            projectOnboardingSeenCount: 0,
          };
        }
        const projMcpServers = (projects[workspaceFolder].mcpServers as Record<string, unknown>) || {};
        projMcpServers['ai-os'] = mcpEntry;
        projects[workspaceFolder].mcpServers = projMcpServers;
        logger.info(`[writeMcpToAllConfigs] Wrote to project entry: ${workspaceFolder}`);
      }
    } else {
      const mcpServers = (data.mcpServers as Record<string, unknown>) || {};
      mcpServers['ai-os'] = mcpEntry;
      data.mcpServers = mcpServers;
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

function isMcpConfigured(configPaths: string[]): boolean {
  for (const configFile of configPaths) {
    if (!fs.existsSync(configFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as Record<string, unknown>;
      const mcpServers = data.mcpServers as Record<string, unknown> | undefined;
      if (mcpServers?.['ai-os']) {
        logger.info(`[isMcpConfigured] Found ai-os in ${configFile}`);
        return true;
      }
      const projects = data.projects as Record<string, Record<string, unknown>> | undefined;
      if (projects) {
        for (const projectPath of Object.keys(projects)) {
          const projMcpServers = projects[projectPath]?.mcpServers as Record<string, unknown> | undefined;
          if (projMcpServers?.['ai-os']) {
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

function removeMcpFromAllConfigs(configPaths: string[]): void {
  for (const configFile of configPaths) {
    if (!fs.existsSync(configFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as Record<string, unknown>;

      const mcpServers = data.mcpServers as Record<string, unknown> | undefined;
      if (mcpServers?.['ai-os']) {
        delete mcpServers['ai-os'];
      }

      const projects = data.projects as Record<string, Record<string, unknown>> | undefined;
      if (projects) {
        for (const projectPath of Object.keys(projects)) {
          const projMcpServers = projects[projectPath]?.mcpServers as Record<string, unknown> | undefined;
          if (projMcpServers?.['ai-os']) {
            delete projMcpServers['ai-os'];
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

export async function handleConfigureClaude(context: vscode.ExtensionContext): Promise<void> {
  logger.info('[handleConfigureClaude] Starting Claude configuration...');

  const token = await authServiceInstance?.getGitHubToken();
  if (!token) {
    logger.warn('[handleConfigureClaude] No GitHub token found');
    vscode.window.showErrorMessage('Not authenticated. Sign in with GitHub first.');
    return;
  }
  logger.info(`[handleConfigureClaude] Got GitHub token (length=${token.length})`);

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
      const restartMsg = vscode.window.showInformationMessage(
        [
          'To restart Claude Code:',
          '',
          '• If using Claude Code CLI: press Ctrl+C to stop, then run `claude` again',
          '• If using Claude VS Code extension: reload the VS Code window with Ctrl+Shift+P → "Developer: Reload Window"',
          '',
          'Claude will load the AI OS MCP tools on next startup.',
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

export async function handleDisconnectClaude(): Promise<void> {
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

export function showOnboardingNotification(): void {
  logger.info('[showOnboardingNotification] Checking if onboarding needed...');

  const configPaths = getClaudeConfigPaths();
  logger.info(`[showOnboardingNotification] configPaths=${JSON.stringify(configPaths)}`);

  if (isMcpConfigured(configPaths)) {
    logger.info('[showOnboardingNotification] Already configured, skipping onboarding');
    return;
  }

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

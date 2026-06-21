/**
 * Settings Panel — Webview panel for AI OS configuration.
 * Singleton pattern: only one settings panel at a time.
 */

import * as vscode from 'vscode';
import { detectClaudeCode } from '../services/claudeDetector';
import { logger } from '../services/logger';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class SettingsPanel {
  public static currentPanel: SettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      this.disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Reuse existing panel
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'aiOsSettings',
      'AI OS Settings',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
  }

  public updateSettings(): void {
    logger.info('[SettingsPanel.updateSettings] Updating settings');
    const claude = detectClaudeCode();
    const mcpConnected = this.checkMcpConnected();

    this.panel.webview.postMessage({
      type: 'updateSettings',
      data: {
        claudeExtensionInstalled: claude.extensionInstalled,
        claudeCliInstalled: claude.cliInstalled,
        mcpConnected,
      },
    });
    logger.info('[SettingsPanel.updateSettings] Result: settings sent');
  }

  private dispose(): void {
    SettingsPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  private getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI OS Settings</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }
    .section { margin-bottom: 24px; }
    .section h3 { margin-bottom: 8px; color: var(--vscode-sideBarSectionHeader-foreground); background: var(--vscode-sideBarSectionHeader-background); padding: 4px 8px; border-radius: 4px; }
    .row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    label { min-width: 160px; }
    input[type="text"], input[type="number"] { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 4px 8px; border-radius: 2px; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 12px; border-radius: 2px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    .status-dot.green { background: #3fb950; }
    .status-dot.red { background: #f85149; }
    .error { color: #f85149; font-size: 12px; }
  </style>
</head>
<body>
  <h2>AI OS Settings</h2>

  <div class="section">
    <h3>Claude Code Installation</h3>
    <div class="row">
      <span id="extensionStatus"></span>
    </div>
    <div class="row">
      <span id="cliStatus"></span>
    </div>
    <div class="row" id="installRow" style="display:none;">
      <button id="installBtn">Install Claude Code</button>
    </div>
  </div>

  <div class="section">
    <h3>MCP Connection</h3>
    <div class="row">
      <span id="mcpStatus"></span>
    </div>
    <div class="row">
      <button id="connectBtn">Connect</button>
      <button id="disconnectBtn">Disconnect</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function setStatus(id, connected, label) {
      const el = document.getElementById(id);
      el.innerHTML = '<span class="status-dot ' + (connected ? 'green' : 'red') + '"></span>' + label;
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'updateSettings') {
        const d = msg.data;

        // Claude status
        setStatus('extensionStatus', d.claudeExtensionInstalled, 'VS Code Extension: ' + (d.claudeExtensionInstalled ? 'Installed' : 'Not found'));
        setStatus('cliStatus', d.claudeCliInstalled, 'CLI: ' + (d.claudeCliInstalled ? 'Installed' : 'Not found'));
        document.getElementById('installRow').style.display = (!d.claudeExtensionInstalled && !d.claudeCliInstalled) ? 'flex' : 'none';

        // MCP status
        setStatus('mcpStatus', d.mcpConnected, 'MCP Connection: ' + (d.mcpConnected ? 'Connected' : 'Disconnected'));
        document.getElementById('connectBtn').style.display = d.mcpConnected ? 'none' : 'inline-block';
        document.getElementById('disconnectBtn').style.display = d.mcpConnected ? 'inline-block' : 'none';

      }
    });

    // Event handlers
    document.getElementById('installBtn').onclick = () => {
      vscode.postMessage({ type: 'installClaude' });
    };
    document.getElementById('connectBtn').onclick = () => {
      vscode.postMessage({ type: 'connectMcp' });
    };
    document.getElementById('disconnectBtn').onclick = () => {
      vscode.postMessage({ type: 'disconnectMcp' });
    };

    // Request initial settings
    vscode.postMessage({ type: 'loadSettings' });
  </script>
</body>
</html>`;
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      logger.warn('Invalid IPC message — missing type');
      return;
    }

    const msg = message as Record<string, unknown>;
    const allowedTypes = ['loadSettings', 'updateSetting', 'installClaude', 'connectMcp', 'disconnectMcp'];

    if (!allowedTypes.includes(msg.type as string)) {
      logger.warn(`Unknown IPC message type: ${msg.type}`);
      return;
    }

    switch (msg.type) {
      case 'loadSettings':
        this.updateSettings();
        break;

      case 'updateSetting': {
        const data = msg.data as { key: string; value: unknown };
        if (!data?.key || data.value === undefined) {
          logger.warn('updateSetting: missing key or value');
          return;
        }
        const config = vscode.workspace.getConfiguration('aiOs');
        config.update(data.key, data.value, vscode.ConfigurationTarget.Global).then(() => {
          logger.info(`Setting updated: ${data.key} = ${JSON.stringify(data.value)}`);
          this.updateSettings();
        });
        break;
      }

      case 'installClaude':
        vscode.env.openExternal(vscode.Uri.parse('https://claude.ai/download'));
        break;

      case 'connectMcp':
        vscode.commands.executeCommand('aiOs.configureClaude');
        break;

      case 'disconnectMcp':
        vscode.commands.executeCommand('aiOs.disconnectClaude');
        break;
    }
  }

  private checkMcpConnected(): boolean {
    const claudeDir = path.join(os.homedir(), '.claude');
    const configFiles = [
      path.join(claudeDir, 'settings.json'),
      path.join(claudeDir, '.mcp.json'),
    ];

    for (const configFile of configFiles) {
      if (!fs.existsSync(configFile)) continue;
      try {
        const settings = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        if (settings?.mcpServers?.['ai-os'] !== undefined) return true;
      } catch {
        // Try next file
      }
    }
    return false;
  }
}

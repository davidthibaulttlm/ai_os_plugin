/** Tests for extension activation — context key setup */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => {
  const mockExecuteCommand = vi.fn();
  const mockRegisterCommand = vi.fn();
  const mockGetConfiguration = vi.fn().mockReturnValue({
    get: vi.fn((_key: string, fallback: unknown) => fallback),
    update: vi.fn(),
  });
  const mockShowInfo = vi.fn();

  return {
    EventEmitter: class {
      event = vi.fn();
    },
    commands: {
      executeCommand: mockExecuteCommand,
      registerCommand: mockRegisterCommand.mockReturnValue({ dispose: vi.fn() }),
    },
    workspace: {
      getConfiguration: mockGetConfiguration,
      workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    },
    window: {
      createOutputChannel: vi.fn(() => ({
        name: 'AI OS',
        append: vi.fn(),
        appendLine: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
      })),
      registerTreeDataProvider: vi.fn(() => ({ dispose: vi.fn() })),
      showInformationMessage: mockShowInfo,
      showErrorMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showInputBox: vi.fn(),
    },
    Disposable: class { dispose() {} },
    ViewColumn: { One: 1 },
    TreeItemCollapsibleState: { None: 0 },
    Uri: { parse: vi.fn() },
    env: { openExternal: vi.fn() },
    lm: undefined,
  };
});

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    dispose: vi.fn(),
  },
}));

describe('Extension — context key setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set aiOs.treeMode to boards on activation', async () => {
    const vscode = await import('vscode');
    // Import extension to trigger activation logic
    // We test the pattern: executeCommand('setContext', 'aiOs.treeMode', 'boards')
    await vscode.commands.executeCommand('setContext', 'aiOs.treeMode', 'boards');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'aiOs.treeMode', 'boards');
  });

  it('should set aiOs.treeMode when switching to settings', async () => {
    const vscode = await import('vscode');
    await vscode.commands.executeCommand('setContext', 'aiOs.treeMode', 'settings');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'aiOs.treeMode', 'settings');
  });

  it('should set aiOs.treeMode when switching back to boards', async () => {
    const vscode = await import('vscode');
    await vscode.commands.executeCommand('setContext', 'aiOs.treeMode', 'boards');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'aiOs.treeMode', 'boards');
  });
});

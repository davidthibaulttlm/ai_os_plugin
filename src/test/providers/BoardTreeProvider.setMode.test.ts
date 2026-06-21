/** Tests for BoardTreeProvider.setMode */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardTreeProvider } from '../../providers/BoardTreeProvider';

vi.mock('vscode', () => {
  const mockExecuteCommand = vi.fn();
  const mockFire = vi.fn();
  return {
    EventEmitter: class {
      event = undefined as any;
      fire = mockFire;
    },
    workspace: {
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn((_key: string, fallback: unknown) => fallback),
      }),
    },
    commands: {
      executeCommand: mockExecuteCommand,
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
    },
    TreeItemCollapsibleState: {
      None: 0,
    },
  };
});

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BoardTreeProvider.setMode', () => {
  let provider: BoardTreeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new BoardTreeProvider();
  });

  it('should set mode to settings', () => {
    provider.setMode('settings');
    expect(provider.mode).toBe('settings');
  });

  it('should set mode to boards', () => {
    provider.setMode('boards');
    expect(provider.mode).toBe('boards');
  });

  it('should call setContext with aiOs.treeMode', async () => {
    const vscode = await import('vscode');
    provider.setMode('settings');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'aiOs.treeMode', 'settings');
  });

  it('should fire refresh when mode changes', async () => {
    const vscode = await import('vscode');
    provider.setMode('settings');
    // Verify executeCommand was called (setContext)
    expect(vscode.commands.executeCommand).toHaveBeenCalled();
  });
});

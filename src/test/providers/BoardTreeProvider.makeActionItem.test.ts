/** Tests for BoardTreeProvider._makeActionItem */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardTreeProvider } from '../../providers/BoardTreeProvider';
import { isMcpConfigured } from '../../services/claudeConfig';

vi.mock('vscode', () => ({
  EventEmitter: class {
    event = undefined as any;
    fire = vi.fn();
  },
  ThemeIcon: class ThemeIcon {
    public readonly id: string;
    public readonly color: unknown | undefined;
    constructor(id: string, color?: unknown) {
      this.id = id;
      this.color = color;
    }
  },
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
    }),
  },
  commands: {
    executeCommand: vi.fn(),
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
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../services/claudeConfig', () => ({
  getClaudeConfigPaths: vi.fn(() => ['/tmp/.claude.json']),
  isMcpConfigured: vi.fn(() => false),
}));

describe('BoardTreeProvider._makeActionItem', () => {
  let provider: BoardTreeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new BoardTreeProvider();
  });

  it('should create an action item with correct label and command', async () => {
    provider.setMode('settings');
    const items = await provider.getChildren();
    const connectItem = items.find((i: any) => i.label === 'Connect to Claude Code');
    expect(connectItem).toBeDefined();
    expect(connectItem!.command!.command).toBe('aiOs.configureClaude');
    expect(connectItem!.contextValue).toBe('settingAction');
  });

  it('should set ThemeIcon for action items', async () => {
    provider.setMode('settings');
    const items = await provider.getChildren();
    const connectItem = items.find((i: any) => i.label === 'Connect to Claude Code');
    expect(connectItem).toBeDefined();
    expect(connectItem!.iconPath).toBeDefined();
    expect((connectItem!.iconPath as any).id).toBe('plug');
  });

  it('should create disconnect action item when MCP configured', async () => {
    vi.mocked(isMcpConfigured).mockReturnValue(true);
    provider.setMode('settings');
    const items = await provider.getChildren();
    const disconnectItem = items.find((i: any) => i.label === 'Disconnect from Claude Code');
    const connectItem = items.find((i: any) => i.label === 'Connect to Claude Code');
    expect(disconnectItem).toBeDefined();
    expect(connectItem).toBeUndefined();
    expect(disconnectItem!.command!.command).toBe('aiOs.disconnectClaude');
    expect((disconnectItem!.iconPath as any).id).toBe('cancel');
  });
});

/** Tests for BoardTreeProvider._buildSettingsItems */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardTreeProvider, setTreeProviderDeps } from '../../providers/BoardTreeProvider';

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

describe('BoardTreeProvider._buildSettingsItems', () => {
  let provider: BoardTreeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    setTreeProviderDeps(null, null);
    provider = new BoardTreeProvider();
  });

  it('should return card sections with correct structure', () => {
    provider.setMode('settings');
    const children = provider.getChildren();
    expect(children).resolves.toBeInstanceOf(Array);
  });

  it('should include section headers', async () => {
    provider.setMode('settings');
    const items = await provider.getChildren();
    const sectionHeaders = items.filter((i: any) => i.contextValue === 'sectionHeader');
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(2);
  });

  it('should include Clone Repos item', async () => {
    provider.setMode('settings');
    const items = await provider.getChildren();
    const cloneItems = items.filter((i: any) => i.label && i.label.includes('Clone Repos'));
    expect(cloneItems.length).toBe(1);
  });

  it('should show no board open when no state manager', async () => {
    provider.setMode('settings');
    const items = await provider.getChildren();
    const cloneItem = items.find((i: any) => i.label && i.label.includes('Clone Repos'));
    expect(cloneItem).toBeDefined();
    expect(cloneItem!.description).toBe('No board open');
  });

  it('should include Repos Directory item', async () => {
    provider.setMode('settings');
    const items = await provider.getChildren();
    const reposDir = items.find((i: any) => i.label && i.label.includes('Repos Directory'));
    expect(reposDir).toBeDefined();
  });

  it('should show Connect when MCP not configured', async () => {
    provider.setMode('settings');
    const items = await provider.getChildren();
    const connectItem = items.find((i: any) => i.label && i.label.includes('Connect to Claude Code'));
    const disconnectItem = items.find((i: any) => i.label && i.label.includes('Disconnect from Claude Code'));
    expect(connectItem).toBeDefined();
    expect(disconnectItem).toBeUndefined();
  });

  it('should not include auto-work items', async () => {
    provider.setMode('settings');
    const items = await provider.getChildren();
    const labels = items.map((i: any) => i.label || '');
    expect(labels).not.toContain(expect.stringContaining('Auto-Work'));
    expect(labels).not.toContain(expect.stringContaining('Max Turns'));
    expect(labels).not.toContain(expect.stringContaining('Allowed Tools'));
    expect(labels).not.toContain(expect.stringContaining('Confirm Before'));
  });
});

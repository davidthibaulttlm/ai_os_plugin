/**
 * Integration tests for the Start Agent command flow.
 *
 * These tests verify the full command flow in a VS Code-like environment.
 * Run with: npx vitest run src/test/integration/
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentService } from '../../services/agent';

// Track registered callbacks so executeCommand can invoke them
const registeredCommands = new Map<string, (...args: any[]) => any>();

// Mock vscode
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: () => ({
      name: 'AI OS',
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
  },
  commands: {
    registerCommand: vi.fn((cmd: string, cb: (...args: any[]) => any) => {
      registeredCommands.set(cmd, cb);
      return { dispose: vi.fn() };
    }),
    executeCommand: vi.fn(async (cmd: string, ...args: any[]) => {
      const handler = registeredCommands.get(cmd);
      if (handler) {
        return handler(...args);
      }
      return undefined;
    }),
  },
  Disposable: {
    create: vi.fn((dispose: () => void) => ({ dispose })),
  },
}));

import * as vscode from 'vscode';

/**
 * Simulates command registration from extension.ts
 */
function registerStartAgentCommand(
  agentService: AgentService
): any {
  return vscode.commands.registerCommand('aiOs.startAgent', async () => {
    if (!agentService) {
      vscode.window.showErrorMessage('AI OS not initialized');
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
      vscode.window.showErrorMessage(`Failed to start agent: ${(error as Error).message}`);
    }
  });
}

describe('Start Agent Integration', () => {
  let agentService: AgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredCommands.clear();
    agentService = new AgentService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('command registration: vscode.commands.executeCommand("aiOs.startAgent") executes without error', async () => {
    agentService.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Test', status: 'AI_SPEC', labels: [] },
    ]);
    agentService.setCallback(async () => {});

    const disposable = registerStartAgentCommand(agentService);

    // Simulate command execution
    await vscode.commands.executeCommand('aiOs.startAgent');

    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    disposable.dispose();
  });

  it('notification appears in VS Code window after command execution', async () => {
    agentService.setBoardState([
      { id: 42, projectItemId: 'PVTI_test42', title: 'Fix bug', status: 'AI_CODE', labels: ['bug'] },
    ]);
    agentService.setCallback(async () => {});

    registerStartAgentCommand(agentService);

    await vscode.commands.executeCommand('aiOs.startAgent');

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'AI Agent started for issue #42'
    );
  });

  it('full flow: select → start → finish → auto-trigger next', async () => {
    agentService.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'First', status: 'AI_SPEC', labels: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Second', status: 'AI_SPEC', labels: [] },
    ]);

    const launched: string[] = [];
    agentService.setCallback(async (issueId) => {
      launched.push(issueId);
    });

    registerStartAgentCommand(agentService);

    // First execution
    await vscode.commands.executeCommand('aiOs.startAgent');
    expect(launched).toContain('1');

    // Simulate agent moving issue #1 to HUMAN column (agent completed work)
    agentService.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'First', status: 'HUMAN_SPEC_REVIEW', labels: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Second', status: 'AI_SPEC', labels: [] },
    ]);

    // Simulate finishing — should auto-trigger #2
    await agentService.finishAgent('1');
    expect(launched).toContain('2');
  });

  it('WIP prevents duplicate agent starts', async () => {
    agentService.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Feature', status: 'AI_SPEC', labels: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Another', status: 'AI_SPEC', labels: [] },
    ]);
    agentService.setCallback(async () => {});

    registerStartAgentCommand(agentService);

    // First start
    await vscode.commands.executeCommand('aiOs.startAgent');
    vi.clearAllMocks();

    // Second start should show busy
    await vscode.commands.executeCommand('aiOs.startAgent');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Agent is busy working on #1'
    );
  });
});

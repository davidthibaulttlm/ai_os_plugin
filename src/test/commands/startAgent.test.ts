/** Unit tests for handleStartAgent command logic */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent';

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
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
  },
}));

import * as vscode from 'vscode';

/**
 * Simulates handleStartAgent logic extracted from extension.ts
 * for isolated unit testing.
 */
async function simulateHandleStartAgent(
  agentService: AgentService | null
): Promise<void> {
  if (!agentService) {
    vscode.window.showErrorMessage('AI OS not initialized — please authenticate with GitHub first');
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
    vscode.window.showErrorMessage(`Failed to start agent: ${(error as Error).message}`);
  }
}

describe('handleStartAgent command', () => {
  let agentService: AgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    agentService = new AgentService();
  });

  it('calls selectNextIssue() and launches agent', async () => {
    agentService.setBoardState([
      { id: 42, projectItemId: 'PVTI_test42', title: 'Test issue', status: 'AI_SPEC', labels: [], assignees: [] },
    ]);

    let launchedIssue: string | undefined;
    agentService.setCallback(async (options) => {
      launchedIssue = options.issueId;
    });

    await simulateHandleStartAgent(agentService);

    expect(launchedIssue).toBe('42');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'AI Agent started for issue #42'
    );
  });

  it('shows success notification with issue number and title', async () => {
    agentService.setBoardState([
      { id: 99, projectItemId: 'PVTI_test99', title: 'Fix critical bug', status: 'AI_CODE', labels: ['bug'], assignees: [] },
    ]);

    agentService.setCallback(async () => {});

    await simulateHandleStartAgent(agentService);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'AI Agent started for issue #99'
    );
  });

  it('shows busy notification when WIP limit reached', async () => {
    // Set up a non-bug issue first to occupy WIP
    agentService.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Feature', status: 'AI_SPEC', labels: [], assignees: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Another', status: 'AI_SPEC', labels: [], assignees: [] },
    ]);

    agentService.setCallback(async () => {});

    // First call starts agent
    await simulateHandleStartAgent(agentService);
    vi.clearAllMocks();

    // Second call should be busy
    await simulateHandleStartAgent(agentService);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Agent is busy working on #1'
    );
  });

  it('shows empty notification when no AI-eligible issues', async () => {
    agentService.setBoardState([]);

    await simulateHandleStartAgent(agentService);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'No issues available for AI agent'
    );
  });

  it('shows error when agentService is null', async () => {
    await simulateHandleStartAgent(null);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'AI OS not initialized — please authenticate with GitHub first'
    );
  });

  it('shows auto_move_failed warning when move fails', async () => {
    agentService.setBoardState([
      { id: 5, projectItemId: 'PVTI_test5', title: 'Brain dump item', status: 'BRAIN_DUMP', labels: [], assignees: [] },
    ]);

    // No graphql client set, so autoMoveFromBrainDump will fail
    agentService.setCallback(async () => {});

    await simulateHandleStartAgent(agentService);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Failed to auto-move issue #5 from BRAIN_DUMP to AI_SPEC'
    );
  });

  it('allows bug even when busy', async () => {
    // Set WIP with a non-bug
    agentService.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Feature', status: 'AI_SPEC', labels: [], assignees: [] },
    ]);
    agentService.setCallback(async () => {});

    await simulateHandleStartAgent(agentService);
    vi.clearAllMocks();

    // Now add a bug
    agentService.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Feature', status: 'AI_SPEC', labels: [], assignees: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Critical bug', status: 'AI_SPEC', labels: ['bug'], assignees: [] },
    ]);

    await simulateHandleStartAgent(agentService);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'AI Agent started for issue #2'
    );
  });
});

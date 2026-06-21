import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('AgentService callback with repo context', () => {
  let agent: AgentService;
  let callback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new AgentService();
    callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);
  });

  it('passes owner and repo to callback', async () => {
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Test Issue',
        status: 'AI_SPEC',
        labels: [],
        owner: 'myowner',
        repo: 'myrepo',
      },
    ]);
    await agent.startAgent();
    expect(callback).toHaveBeenCalledWith({ issueId: '1', columnName: 'AI_SPEC', title: 'Test Issue', body: undefined, owner: 'myowner', repo: 'myrepo' });
  });

  it('passes undefined owner/repo when not available', async () => {
    agent.setBoardState([
      {
        id: 2,
        projectItemId: 'PVTI_test2',
        title: 'No Repo Issue',
        status: 'AI_CODE',
        labels: [],
      },
    ]);
    await agent.startAgent();
    expect(callback).toHaveBeenCalledWith({ issueId: '2', columnName: 'AI_CODE', title: 'No Repo Issue', body: undefined, owner: undefined, repo: undefined });
  });

  it('onAgentTrigger passes owner/repo from board items', async () => {
    agent.setBoardState([
      {
        id: 10,
        projectItemId: 'PVTI_test10',
        title: 'Trigger Issue',
        status: 'AI_SPEC',
        labels: [],
        owner: 'trigger-owner',
        repo: 'trigger-repo',
      },
    ]);
    await agent.onAgentTrigger('10', 'AI_SPEC');
    expect(callback).toHaveBeenCalledWith({ issueId: '10', columnName: 'AI_SPEC', title: 'Trigger Issue', body: undefined, owner: 'trigger-owner', repo: 'trigger-repo' });
  });
});

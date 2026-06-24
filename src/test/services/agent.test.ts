import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent';
import type { GraphQLClient } from '../../services/graphql';

describe('AgentService.isBusy', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  it('returns false when no WIP', () => {
    expect(agent.isBusy()).toBe(false);
  });

  it('returns true after startAgent sets WIP', async () => {
    agent.setBoardState([{ id: 1, projectItemId: 'PVTI_test1', title: 'Test', status: 'AI_SPEC', labels: [], assignees: [] }]);
    agent.setCallback(vi.fn().mockResolvedValue(undefined));
    await agent.startAgent();
    expect(agent.isBusy()).toBe(true);
  });

  it('returns false after WIP cleared', async () => {
    agent.setBoardState([{ id: 1, projectItemId: 'PVTI_test1', title: 'Test', status: 'AI_SPEC', labels: [], assignees: [] }]);
    agent.setCallback(vi.fn().mockResolvedValue(undefined));
    await agent.startAgent();
    expect(agent.isBusy()).toBe(true);
    agent['currentWip'] = null;
    expect(agent.isBusy()).toBe(false);
  });
});

describe('AgentService.setBoardState', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  it('stores board items', () => {
    const items = [
      { id: 1, projectItemId: 'PVTI_test1', title: 'Issue 1', status: 'AI_SPEC', labels: [], assignees: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Issue 2', status: 'AI_CODE', labels: ['bug'], assignees: [] },
    ];
    agent.setBoardState(items);
    expect(agent.selectNextIssue()).not.toBeNull();
  });
});

describe('AgentService.finishAgent', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  it('clears WIP when issue matches', async () => {
    agent['currentWip'] = '42';
    expect(agent.isBusy()).toBe(true);
    await agent.finishAgent('42');
    expect(agent.isBusy()).toBe(false);
  });

  it('auto-triggers next issue after finishing', async () => {
    agent['currentWip'] = '1';
    agent.setBoardState([{ id: 2, projectItemId: 'PVTI_test2', title: 'Next', status: 'AI_SPEC', labels: [], assignees: [] }]);
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);

    await agent.finishAgent('1');
    expect(callback).toHaveBeenCalledWith({ issueId: '2', columnName: 'AI_SPEC', title: 'Next', body: undefined, owner: undefined, repo: undefined });
  });

  it('does NOT auto-trigger when next is same issue', async () => {
    agent['currentWip'] = '1';
    agent.setBoardState([{ id: 1, projectItemId: 'PVTI_test1', title: 'Same', status: 'AI_SPEC', labels: [], assignees: [] }]);
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);

    await agent.finishAgent('1');
    expect(callback).not.toHaveBeenCalled();
  });

  it('auto-triggers when next is different issue', async () => {
    agent['currentWip'] = '1';
    agent.setBoardState([{ id: 2, projectItemId: 'PVTI_test2', title: 'Different', status: 'AI_SPEC', labels: [], assignees: [] }]);
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);

    await agent.finishAgent('1');
    expect(callback).toHaveBeenCalledWith({ issueId: '2', columnName: 'AI_SPEC', title: 'Different', body: undefined, owner: undefined, repo: undefined });
  });

  it('does nothing when no next issue available', async () => {
    agent['currentWip'] = '1';
    agent.setBoardState([]);
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);

    await agent.finishAgent('1');
    expect(callback).not.toHaveBeenCalled();
  });

  it('catches errors from startAgent during auto-trigger', async () => {
    agent['currentWip'] = '1';
    vi.spyOn(agent, 'startAgent').mockRejectedValue(new Error('test error'));
    const result = await agent.finishAgent('1');
    expect(result).toBeDefined();
  });
});

describe('AgentService.onAgentTrigger', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  it('triggers callback for AI-eligible columns', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);
    await agent.onAgentTrigger('42', 'AI_SPEC');
    expect(callback).toHaveBeenCalledWith({ issueId: '42', columnName: 'AI_SPEC', title: undefined, body: undefined, owner: undefined, repo: undefined });
  });

  it('triggers for AI_CODE', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);
    await agent.onAgentTrigger('42', 'AI_CODE');
    expect(callback).toHaveBeenCalledWith({ issueId: '42', columnName: 'AI_CODE', title: undefined, body: undefined, owner: undefined, repo: undefined });
  });

  it('triggers for BRAIN_DUMP', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);
    await agent.onAgentTrigger('42', 'BRAIN_DUMP');
    expect(callback).toHaveBeenCalledWith({ issueId: '42', columnName: 'BRAIN_DUMP', title: undefined, body: undefined, owner: undefined, repo: undefined });
  });

  it('does NOT trigger for HUMAN columns', async () => {
    const callback = vi.fn();
    agent.setCallback(callback);
    await agent.onAgentTrigger('42', 'HUMAN_SPEC_REVIEW');
    expect(callback).not.toHaveBeenCalled();
    await agent.onAgentTrigger('42', 'HUMAN_CODE_REVIEW');
    expect(callback).not.toHaveBeenCalled();
    await agent.onAgentTrigger('42', 'PR_DONE');
    expect(callback).not.toHaveBeenCalled();
  });

  it('handles callback errors without throwing', async () => {
    const callback = vi.fn().mockRejectedValue(new Error('Agent failed'));
    agent.setCallback(callback);
    await expect(agent.onAgentTrigger('42', 'AI_SPEC')).resolves.toBeUndefined();
  });

  it('does nothing when no callback registered', async () => {
    await expect(agent.onAgentTrigger('42', 'AI_SPEC')).resolves.toBeUndefined();
  });
});

describe('AgentService.autoMoveFromBrainDump', () => {
  it('returns false when no GraphQL client', async () => {
    const agent = new AgentService();
    agent.setBoardState([{ id: 1, projectItemId: 'PVTI_test1', title: 'Test', status: 'BRAIN_DUMP', labels: [], assignees: [] }]);
    expect(await agent.autoMoveFromBrainDump(1)).toBe(false);
  });

  it('returns false when no projectId', async () => {
    const agent = new AgentService();
    agent.setBoardState([{ id: 1, projectItemId: 'PVTI_test1', title: 'Test', status: 'BRAIN_DUMP', labels: [], assignees: [] }]);
    agent.setGraphql({ moveToColumn: vi.fn() } as any);
    expect(await agent.autoMoveFromBrainDump(1)).toBe(false);
  });

  it('returns false when issue not in BRAIN_DUMP', async () => {
    const agent = new AgentService();
    agent.setBoardState([{ id: 1, projectItemId: 'PVTI_test1', title: 'Test', status: 'AI_SPEC', labels: [], assignees: [] }]);
    agent.setGraphql({ moveToColumn: vi.fn() } as any);
    agent.setProjectId('project-1');
    expect(await agent.autoMoveFromBrainDump(1)).toBe(false);
  });
});

describe('AgentService.assignAgent', () => {
  it('does not throw', async () => {
    const agent = new AgentService();
    await expect(agent.assignAgent({} as any, '42')).resolves.toBeUndefined();
  });
});

describe('AgentService.getCurrentWip', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  it('returns null initially', () => {
    expect(agent.getCurrentWip()).toBeNull();
  });

  it('returns issue ID after startAgent', async () => {
    agent.setBoardState([{ id: 42, projectItemId: 'PVTI_test42', title: 'Test', status: 'AI_SPEC', labels: [], assignees: [] }]);
    agent.setCallback(vi.fn().mockResolvedValue(undefined));
    await agent.startAgent();
    expect(agent.getCurrentWip()).toBe('42');
  });
});

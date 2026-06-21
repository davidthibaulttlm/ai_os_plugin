import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent';
import type { GraphQLClient } from '../../services/graphql';

describe('AgentService.startAgent', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  it('starts agent for top issue', async () => {
    agent.setBoardState([{ id: 42, title: 'Feature', status: 'AI_SPEC', labels: [] }]);
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);

    const result = await agent.startAgent();
    expect(result.started).toBe(true);
    expect(result.issueId).toBe(42);
    expect(callback).toHaveBeenCalledWith('42', 'AI_SPEC');
  });

  it('returns busy when agent already working', async () => {
    agent.setBoardState([{ id: 1, title: 'Test', status: 'AI_SPEC', labels: [] }]);
    agent.setCallback(vi.fn().mockResolvedValue(undefined));
    await agent.startAgent();

    const result = await agent.startAgent();
    expect(result.started).toBe(false);
    expect(result.reason).toBe('busy');
  });

  it('returns empty when no issues', async () => {
    agent.setBoardState([]);
    const result = await agent.startAgent();
    expect(result.started).toBe(false);
    expect(result.reason).toBe('empty');
  });

  it('auto-moves from BRAIN_DUMP to AI_SPEC', async () => {
    const mockGraphql = { moveToColumn: vi.fn().mockResolvedValue(true) } as unknown as GraphQLClient;
    agent.setGraphql(mockGraphql);
    agent.setProjectId('project-123');
    agent.setBoardState([{ id: 5, title: 'Idea', status: 'BRAIN_DUMP', labels: [] }]);
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);

    const result = await agent.startAgent();
    expect(result.started).toBe(true);
    expect(result.issueId).toBe(5);
    expect(mockGraphql.moveToColumn).toHaveBeenCalledWith('project-123', '5', 'AI_SPEC');
    expect(callback).toHaveBeenCalledWith('5', 'AI_SPEC');
  });

  it('aborts when auto-move fails', async () => {
    const mockGraphql = { moveToColumn: vi.fn().mockResolvedValue(false) } as unknown as GraphQLClient;
    agent.setGraphql(mockGraphql);
    agent.setProjectId('project-123');
    agent.setBoardState([{ id: 5, title: 'Idea', status: 'BRAIN_DUMP', labels: [] }]);
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);

    const result = await agent.startAgent();
    expect(result.started).toBe(false);
    expect(result.reason).toBe('auto_move_failed');
    expect(callback).not.toHaveBeenCalled();
  });

  it('bug bypasses WIP limit', async () => {
    agent.setBoardState([{ id: 1, title: 'Normal', status: 'AI_SPEC', labels: [] }]);
    const callback = vi.fn().mockResolvedValue(undefined);
    agent.setCallback(callback);
    await agent.startAgent();
    expect(agent.isBusy()).toBe(true);

    agent.setBoardState([
      { id: 1, title: 'Normal', status: 'AI_SPEC', labels: [] },
      { id: 2, title: 'Bug', status: 'AI_CODE', labels: ['bug'] },
    ]);
    const result = await agent.startAgent();
    expect(result.started).toBe(true);
    expect(result.issueId).toBe(2);
  });

  it('does nothing when no callback registered', async () => {
    agent.setBoardState([{ id: 1, title: 'Test', status: 'AI_SPEC', labels: [] }]);
    const result = await agent.startAgent();
    expect(result.started).toBe(true);
    expect(result.issueId).toBe(1);
  });
});

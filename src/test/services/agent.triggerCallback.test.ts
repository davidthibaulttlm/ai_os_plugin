/** Tests for AgentTriggerOptions callback signature */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService, type AgentTriggerOptions } from '../../services/agent';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AgentService.triggerCallback', () => {
  let agent: AgentService;
  let callbackSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new AgentService();
    callbackSpy = vi.fn();
    agent.setCallback(callbackSpy);
  });

  it('should call callback with AgentTriggerOptions object', async () => {
    agent.setBoardState([{
      id: 42,
      projectItemId: 'proj_42',
      title: 'Test issue',
      status: 'AI_CODE',
      labels: [],
      assignees: [],
      owner: 'testowner',
      repo: 'testrepo',
    }]);

    await agent.onAgentTrigger('42', 'AI_CODE');

    expect(callbackSpy).toHaveBeenCalledTimes(1);
    const options = callbackSpy.mock.calls[0][0] as AgentTriggerOptions;
    expect(options.issueId).toBe('42');
    expect(options.columnName).toBe('AI_CODE');
    expect(options.title).toBe('Test issue');
    expect(options.owner).toBe('testowner');
    expect(options.repo).toBe('testrepo');
  });

  it('should include body in options when present', async () => {
    agent.setBoardState([{
      id: 1,
      projectItemId: 'proj_1',
      title: 'Issue with body',
      status: 'AI_SPEC',
      labels: [],
      assignees: [],
      body: 'This is the body',
    }]);

    await agent.onAgentTrigger('1', 'AI_SPEC');

    const options = callbackSpy.mock.calls[0][0] as AgentTriggerOptions;
    expect(options.body).toBe('This is the body');
  });

  it('should not call callback for non-eligible columns', async () => {
    await agent.onAgentTrigger('1', 'HUMAN_CODE_REVIEW');
    expect(callbackSpy).not.toHaveBeenCalled();
  });
});

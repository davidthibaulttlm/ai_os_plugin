import { describe, it, expect, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent';

describe('AgentService.setCurrentUser', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  it('sets current user login', () => {
    agent.setCurrentUser('alice');
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'My Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(1);
  });

  it('filters by new user after setCurrentUser change', () => {
    agent.setCurrentUser('alice');
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Alices Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
      {
        id: 2,
        projectItemId: 'PVTI_test2',
        title: 'Bobs Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'bob', avatarUrl: 'https://example.com/bob.png' }],
      },
    ]);
    expect(agent.selectNextIssue()!.issueId).toBe(1);

    agent.setCurrentUser('bob');
    expect(agent.selectNextIssue()!.issueId).toBe(2);
  });
});

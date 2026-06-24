import { describe, it, expect, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent';

describe('AgentService.selectNextIssue - assignee filter', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
    agent.setCurrentUser('alice');
  });

  it('selects issue assigned to current user', () => {
    agent.setBoardState([
      {
        id: 42,
        projectItemId: 'PVTI_test42',
        title: 'My Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(42);
  });

  it('returns null when no issues assigned to current user', () => {
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Teammate Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'bob', avatarUrl: 'https://example.com/bob.png' }],
      },
    ]);
    expect(agent.selectNextIssue()).toBeNull();
  });

  it('returns null when issue has no assignees', () => {
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Unassigned Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [],
      },
    ]);
    expect(agent.selectNextIssue()).toBeNull();
  });

  it('selects only users issues from mixed assignees', () => {
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Bobs Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'bob', avatarUrl: 'https://example.com/bob.png' }],
      },
      {
        id: 2,
        projectItemId: 'PVTI_test2',
        title: 'My Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
      {
        id: 3,
        projectItemId: 'PVTI_test3',
        title: 'Unassigned',
        status: 'AI_SPEC',
        labels: [],
        assignees: [],
      },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(2);
  });

  it('selects issue when user is one of multiple assignees', () => {
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Shared Issue',
        status: 'AI_SPEC',
        labels: [],
        assignees: [
          { login: 'bob', avatarUrl: 'https://example.com/bob.png' },
          { login: 'alice', avatarUrl: 'https://example.com/alice.png' },
        ],
      },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(1);
  });

  it('bug assigned to user breaks WIP limit', async () => {
    // Start a non-bug WIP
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Feature',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
    ]);
    await agent.startAgent();
    expect(agent.isBusy()).toBe(true);

    // Add a bug assigned to same user
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Feature',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
      {
        id: 2,
        projectItemId: 'PVTI_test2',
        title: 'Bug',
        status: 'AI_CODE',
        labels: ['bug'],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(2);
  });

  it('does not select bug assigned to other user when busy', async () => {
    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Feature',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
    ]);
    await agent.startAgent();

    agent.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Feature',
        status: 'AI_SPEC',
        labels: [],
        assignees: [{ login: 'alice', avatarUrl: 'https://example.com/alice.png' }],
      },
      {
        id: 2,
        projectItemId: 'PVTI_test2',
        title: 'Bug',
        status: 'AI_CODE',
        labels: ['bug'],
        assignees: [{ login: 'bob', avatarUrl: 'https://example.com/bob.png' }],
      },
    ]);
    expect(agent.selectNextIssue()).toBeNull();
  });

  it('skips assignee filter when currentUser not set', () => {
    const agentNoUser = new AgentService();
    agentNoUser.setBoardState([
      {
        id: 1,
        projectItemId: 'PVTI_test1',
        title: 'Unfiltered',
        status: 'AI_SPEC',
        labels: [],
        assignees: [],
      },
    ]);
    const result = agentNoUser.selectNextIssue();
    expect(result!.issueId).toBe(1);
  });
});

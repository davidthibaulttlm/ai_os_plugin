import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent';

describe('AgentService.selectNextIssue', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  it('returns null when board is empty', () => {
    agent.setBoardState([]);
    expect(agent.selectNextIssue()).toBeNull();
  });

  it('selects top card from AI_CODE first', () => {
    agent.setBoardState([
      { id: 3, projectItemId: 'PVTI_test3', title: 'In AI_SPEC', status: 'AI_SPEC', labels: [] },
      { id: 1, projectItemId: 'PVTI_test1', title: 'In AI_CODE', status: 'AI_CODE', labels: [] },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(1);
    expect(result!.column).toBe('AI_CODE');
  });

  it('selects from AI_SPEC when AI_CODE is empty', () => {
    agent.setBoardState([
      { id: 3, projectItemId: 'PVTI_test3', title: 'In AI_SPEC', status: 'AI_SPEC', labels: [] },
      { id: 4, projectItemId: 'PVTI_test4', title: 'In BRAIN_DUMP', status: 'BRAIN_DUMP', labels: [] },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(3);
    expect(result!.column).toBe('AI_SPEC');
  });

  it('selects from BRAIN_DUMP when AI_CODE and AI_SPEC empty', () => {
    agent.setBoardState([
      { id: 4, projectItemId: 'PVTI_test4', title: 'In BRAIN_DUMP', status: 'BRAIN_DUMP', labels: [] },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(4);
    expect(result!.column).toBe('BRAIN_DUMP');
  });

  it('selects top card within column (first item)', () => {
    agent.setBoardState([
      { id: 30, projectItemId: 'PVTI_test30', title: 'Top', status: 'AI_SPEC', labels: [] },
      { id: 3, projectItemId: 'PVTI_test3', title: 'Middle', status: 'AI_SPEC', labels: [] },
      { id: 15, projectItemId: 'PVTI_test15', title: 'Bottom', status: 'AI_SPEC', labels: [] },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(30);
  });

  it('never selects from HUMAN columns', () => {
    agent.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Human Spec', status: 'HUMAN_SPEC_REVIEW', labels: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Human Code', status: 'HUMAN_CODE_REVIEW', labels: [] },
      { id: 3, projectItemId: 'PVTI_test3', title: 'PR Done', status: 'PR_DONE', labels: [] },
    ]);
    expect(agent.selectNextIssue()).toBeNull();
  });

  it('bug in BRAIN_DUMP overrides non-bug in AI_SPEC', () => {
    agent.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Normal', status: 'AI_SPEC', labels: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Bug', status: 'BRAIN_DUMP', labels: ['bug'] },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(2);
  });

  it('bug in AI_CODE overrides AI_SPEC items', () => {
    agent.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Normal', status: 'AI_SPEC', labels: [] },
      { id: 3, projectItemId: 'PVTI_test3', title: 'Bug', status: 'AI_CODE', labels: ['type/bug'] },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(3);
  });

  it('bug in higher-priority column wins', () => {
    agent.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'Bug AI_SPEC', status: 'AI_SPEC', labels: ['bug'] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Bug BRAIN', status: 'BRAIN_DUMP', labels: ['bug'] },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(1);
  });

  it('returns null when busy and no bugs', async () => {
    agent.setBoardState([{ id: 1, projectItemId: 'PVTI_test1', title: 'Test', status: 'AI_SPEC', labels: [] }]);
    agent.setCallback(vi.fn().mockResolvedValue(undefined));
    await agent.startAgent();
    expect(agent.selectNextIssue()).toBeNull();
  });

  it('returns bug even when busy', async () => {
    agent.setBoardState([{ id: 1, projectItemId: 'PVTI_test1', title: 'WIP', status: 'AI_SPEC', labels: [] }]);
    agent.setCallback(vi.fn().mockResolvedValue(undefined));
    await agent.startAgent();
    agent.setBoardState([
      { id: 1, projectItemId: 'PVTI_test1', title: 'WIP', status: 'AI_SPEC', labels: [] },
      { id: 2, projectItemId: 'PVTI_test2', title: 'Bug', status: 'AI_CODE', labels: ['bug'] },
    ]);
    const result = agent.selectNextIssue();
    expect(result!.issueId).toBe(2);
  });
});

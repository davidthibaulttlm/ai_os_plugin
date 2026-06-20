import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService, AI_ELIGIBLE_COLUMNS, HUMAN_COLUMNS } from '../../services/agent';
import type { GraphQLClient } from '../../services/graphql';

describe('AgentService', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  describe('AI_ELIGIBLE_COLUMNS constant', () => {
    it('contains AI_CODE, AI_SPEC, and BRAIN_DUMP', () => {
      expect(AI_ELIGIBLE_COLUMNS).toContain('AI_CODE');
      expect(AI_ELIGIBLE_COLUMNS).toContain('AI_SPEC');
      expect(AI_ELIGIBLE_COLUMNS).toContain('BRAIN_DUMP');
    });

    it('does not contain human columns', () => {
      for (const col of HUMAN_COLUMNS) {
        expect(AI_ELIGIBLE_COLUMNS).not.toContain(col as typeof AI_ELIGIBLE_COLUMNS[number]);
      }
    });
  });

  describe('HUMAN_COLUMNS constant', () => {
    it('contains HUMAN_SPEC_REVIEW, HUMAN_CODE_REVIEW, and PR_DONE', () => {
      expect(HUMAN_COLUMNS).toContain('HUMAN_SPEC_REVIEW');
      expect(HUMAN_COLUMNS).toContain('HUMAN_CODE_REVIEW');
      expect(HUMAN_COLUMNS).toContain('PR_DONE');
    });
  });

  describe('isBusy', () => {
    it('returns false when no WIP', () => {
      expect(agent.isBusy()).toBe(false);
    });

    it('returns true after startAgent sets WIP', async () => {
      agent.setBoardState([
        { id: 1, title: 'Test', status: 'AI_SPEC', labels: [] },
      ]);
      agent.setCallback(vi.fn().mockResolvedValue(undefined));
      await agent.startAgent();
      expect(agent.isBusy()).toBe(true);
    });

    it('returns false after finishAgent clears WIP', async () => {
      agent.setBoardState([
        { id: 1, title: 'Test', status: 'AI_SPEC', labels: [] },
      ]);
      agent.setCallback(vi.fn().mockResolvedValue(undefined));
      await agent.startAgent();
      expect(agent.isBusy()).toBe(true);
      // Manually clear WIP to test (finishAgent would auto-trigger)
      agent['currentWip'] = null;
      expect(agent.isBusy()).toBe(false);
    });
  });

  describe('isBug', () => {
    it('detects "bug" label', () => {
      expect(AgentService.isBug(['bug'])).toBe(true);
    });

    it('detects "Bug" label (case-insensitive)', () => {
      expect(AgentService.isBug(['Bug'])).toBe(true);
    });

    it('detects "BUG" label', () => {
      expect(AgentService.isBug(['BUG'])).toBe(true);
    });

    it('detects "type/bug" label', () => {
      expect(AgentService.isBug(['type/bug'])).toBe(true);
    });

    it('returns false for non-bug labels', () => {
      expect(AgentService.isBug(['feature', 'enhancement'])).toBe(false);
    });

    it('returns false for empty labels', () => {
      expect(AgentService.isBug([])).toBe(false);
    });
  });

  describe('setBoardState', () => {
    it('stores board items', () => {
      const items = [
        { id: 1, title: 'Issue 1', status: 'AI_SPEC', labels: [] },
        { id: 2, title: 'Issue 2', status: 'AI_CODE', labels: ['bug'] },
      ];
      agent.setBoardState(items);
      expect(agent.selectNextIssue()).not.toBeNull();
    });
  });

  describe('selectNextIssue', () => {
    it('returns null when board is empty', () => {
      agent.setBoardState([]);
      expect(agent.selectNextIssue()).toBeNull();
    });

    it('selects top card from AI_CODE first', () => {
      agent.setBoardState([
        { id: 3, title: 'In AI_SPEC', status: 'AI_SPEC', labels: [] },
        { id: 1, title: 'In AI_CODE', status: 'AI_CODE', labels: [] },
      ]);
      const result = agent.selectNextIssue();
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe(1);
      expect(result!.column).toBe('AI_CODE');
    });

    it('selects from AI_SPEC when AI_CODE is empty', () => {
      agent.setBoardState([
        { id: 3, title: 'In AI_SPEC', status: 'AI_SPEC', labels: [] },
        { id: 4, title: 'In BRAIN_DUMP', status: 'BRAIN_DUMP', labels: [] },
      ]);
      const result = agent.selectNextIssue();
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe(3);
      expect(result!.column).toBe('AI_SPEC');
    });

    it('selects from BRAIN_DUMP when AI_CODE and AI_SPEC are empty', () => {
      agent.setBoardState([
        { id: 4, title: 'In BRAIN_DUMP', status: 'BRAIN_DUMP', labels: [] },
      ]);
      const result = agent.selectNextIssue();
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe(4);
      expect(result!.column).toBe('BRAIN_DUMP');
    });

    it('selects top card within column (first item)', () => {
      agent.setBoardState([
        { id: 30, title: 'Top', status: 'AI_SPEC', labels: [] },
        { id: 3, title: 'Middle', status: 'AI_SPEC', labels: [] },
        { id: 15, title: 'Bottom', status: 'AI_SPEC', labels: [] },
      ]);
      const result = agent.selectNextIssue();
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe(30);
    });

    it('never selects from HUMAN columns', () => {
      agent.setBoardState([
        { id: 1, title: 'Human Spec', status: 'HUMAN_SPEC_REVIEW', labels: [] },
        { id: 2, title: 'Human Code', status: 'HUMAN_CODE_REVIEW', labels: [] },
        { id: 3, title: 'PR Done', status: 'PR_DONE', labels: [] },
      ]);
      expect(agent.selectNextIssue()).toBeNull();
    });

    it('bug in BRAIN_DUMP overrides non-bug in AI_SPEC', () => {
      agent.setBoardState([
        { id: 1, title: 'Normal in AI_SPEC', status: 'AI_SPEC', labels: [] },
        { id: 2, title: 'Bug in BRAIN_DUMP', status: 'BRAIN_DUMP', labels: ['bug'] },
      ]);
      const result = agent.selectNextIssue();
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe(2);
    });

    it('bug in AI_CODE overrides AI_SPEC items', () => {
      agent.setBoardState([
        { id: 1, title: 'Normal in AI_SPEC', status: 'AI_SPEC', labels: [] },
        { id: 2, title: 'Normal in AI_SPEC 2', status: 'AI_SPEC', labels: [] },
        { id: 3, title: 'Bug in AI_CODE', status: 'AI_CODE', labels: ['type/bug'] },
      ]);
      const result = agent.selectNextIssue();
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe(3);
    });

    it('bug in higher-priority column wins over bug in lower', () => {
      agent.setBoardState([
        { id: 1, title: 'Bug in AI_SPEC', status: 'AI_SPEC', labels: ['bug'] },
        { id: 2, title: 'Bug in BRAIN_DUMP', status: 'BRAIN_DUMP', labels: ['bug'] },
      ]);
      const result = agent.selectNextIssue();
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe(1);
    });

    it('returns null when busy and no bugs', async () => {
      agent.setBoardState([
        { id: 1, title: 'Test', status: 'AI_SPEC', labels: [] },
      ]);
      agent.setCallback(vi.fn().mockResolvedValue(undefined));
      await agent.startAgent();
      // Now busy
      const result = agent.selectNextIssue();
      expect(result).toBeNull();
    });

    it('returns bug even when busy', async () => {
      agent.setBoardState([
        { id: 1, title: 'Current WIP', status: 'AI_SPEC', labels: [] },
      ]);
      agent.setCallback(vi.fn().mockResolvedValue(undefined));
      await agent.startAgent();
      // Add a bug
      agent.setBoardState([
        { id: 1, title: 'Current WIP', status: 'AI_SPEC', labels: [] },
        { id: 2, title: 'Bug!', status: 'AI_CODE', labels: ['bug'] },
      ]);
      const result = agent.selectNextIssue();
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe(2);
    });
  });

  describe('startAgent', () => {
    it('starts agent for top issue', async () => {
      agent.setBoardState([
        { id: 42, title: 'Feature', status: 'AI_SPEC', labels: [] },
      ]);
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      const result = await agent.startAgent();
      expect(result.started).toBe(true);
      expect(result.issueId).toBe(42);
      expect(callback).toHaveBeenCalledWith('42', 'AI_SPEC');
    });

    it('returns busy when agent already working', async () => {
      agent.setBoardState([
        { id: 1, title: 'Test', status: 'AI_SPEC', labels: [] },
      ]);
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
      const mockGraphql = {
        moveToColumn: vi.fn().mockResolvedValue(true),
      } as unknown as GraphQLClient;
      agent.setGraphql(mockGraphql);
      agent.setProjectId('project-123');
      agent.setBoardState([
        { id: 5, title: 'Idea', status: 'BRAIN_DUMP', labels: [] },
      ]);
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      const result = await agent.startAgent();
      expect(result.started).toBe(true);
      expect(result.issueId).toBe(5);
      expect(mockGraphql.moveToColumn).toHaveBeenCalledWith('project-123', '5', 'AI_SPEC');
      expect(callback).toHaveBeenCalledWith('5', 'AI_SPEC');
    });

    it('aborts when auto-move fails', async () => {
      const mockGraphql = {
        moveToColumn: vi.fn().mockResolvedValue(false),
      } as unknown as GraphQLClient;
      agent.setGraphql(mockGraphql);
      agent.setProjectId('project-123');
      agent.setBoardState([
        { id: 5, title: 'Idea', status: 'BRAIN_DUMP', labels: [] },
      ]);
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      const result = await agent.startAgent();
      expect(result.started).toBe(false);
      expect(result.reason).toBe('auto_move_failed');
      expect(callback).not.toHaveBeenCalled();
    });

    it('bug bypasses WIP limit', async () => {
      // First start normal issue
      agent.setBoardState([
        { id: 1, title: 'Normal', status: 'AI_SPEC', labels: [] },
      ]);
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);
      await agent.startAgent();
      expect(agent.isBusy()).toBe(true);

      // Now add a bug
      agent.setBoardState([
        { id: 1, title: 'Normal', status: 'AI_SPEC', labels: [] },
        { id: 2, title: 'Bug!', status: 'AI_CODE', labels: ['bug'] },
      ]);
      const result = await agent.startAgent();
      expect(result.started).toBe(true);
      expect(result.issueId).toBe(2);
    });

    it('does nothing when no callback registered', async () => {
      agent.setBoardState([
        { id: 1, title: 'Test', status: 'AI_SPEC', labels: [] },
      ]);
      const result = await agent.startAgent();
      expect(result.started).toBe(true);
      expect(result.issueId).toBe(1);
    });
  });

  describe('finishAgent', () => {
    it('clears WIP when issue matches', async () => {
      agent['currentWip'] = '42';
      expect(agent.isBusy()).toBe(true);

      // No callback, so finishAgent won't auto-trigger
      await agent.finishAgent('42');
      expect(agent.isBusy()).toBe(false);
    });

    it('auto-triggers next issue after finishing', async () => {
      agent['currentWip'] = '1';
      agent.setBoardState([
        { id: 2, title: 'Next', status: 'AI_SPEC', labels: [] },
      ]);
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      await agent.finishAgent('1');
      // Callback should have been called for issue #2
      expect(callback).toHaveBeenCalledWith('2', 'AI_SPEC');
    });
  });

  describe('onAgentTrigger (legacy)', () => {
    it('triggers callback for AI-eligible columns', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'AI_SPEC');
      expect(callback).toHaveBeenCalledWith('42', 'AI_SPEC');
    });

    it('triggers for AI_CODE', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'AI_CODE');
      expect(callback).toHaveBeenCalledWith('42', 'AI_CODE');
    });

    it('triggers for BRAIN_DUMP', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'BRAIN_DUMP');
      expect(callback).toHaveBeenCalledWith('42', 'BRAIN_DUMP');
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

  describe('autoMoveFromBrainDump edge cases', () => {
    it('returns false when no GraphQL client', async () => {
      const agent = new AgentService();
      agent.setBoardState([
        { id: 1, title: 'Test', status: 'BRAIN_DUMP', labels: [] },
      ]);
      // No graphql set
      const result = await agent.autoMoveFromBrainDump(1);
      expect(result).toBe(false);
    });

    it('returns false when no projectId', async () => {
      const agent = new AgentService();
      agent.setBoardState([
        { id: 1, title: 'Test', status: 'BRAIN_DUMP', labels: [] },
      ]);
      agent.setGraphql({ moveToColumn: vi.fn() } as any);
      // No projectId set
      const result = await agent.autoMoveFromBrainDump(1);
      expect(result).toBe(false);
    });

    it('returns false when issue not in BRAIN_DUMP', async () => {
      const agent = new AgentService();
      agent.setBoardState([
        { id: 1, title: 'Test', status: 'AI_SPEC', labels: [] },
      ]);
      agent.setGraphql({ moveToColumn: vi.fn() } as any);
      agent.setProjectId('project-1');
      const result = await agent.autoMoveFromBrainDump(1);
      expect(result).toBe(false);
    });
  });

  describe('finishAgent error handling', () => {
    it('catches errors from startAgent during auto-trigger', async () => {
      const agent = new AgentService();
      agent.currentWip = '1';
      // Force startAgent to throw by setting up broken state
      vi.spyOn(agent, 'startAgent').mockRejectedValue(new Error('test error'));
      await expect(agent.finishAgent('1')).resolves.toBeUndefined();
    });
  });

  describe('assignAgent legacy', () => {
    it('does not throw', async () => {
      const agent = new AgentService();
      await expect(agent.assignAgent({} as any, '42')).resolves.toBeUndefined();
    });
  });

  describe('getCurrentWip', () => {
    it('returns null initially', () => {
      expect(agent.getCurrentWip()).toBeNull();
    });

    it('returns issue ID after startAgent', async () => {
      agent.setBoardState([
        { id: 42, title: 'Test', status: 'AI_SPEC', labels: [] },
      ]);
      agent.setCallback(vi.fn().mockResolvedValue(undefined));
      await agent.startAgent();
      expect(agent.getCurrentWip()).toBe('42');
    });
  });
});

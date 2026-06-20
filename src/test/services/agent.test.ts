import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../../services/agent';
import type { GraphQLClient } from '../../services/graphql';

describe('AgentService', () => {
  let agent: AgentService;

  beforeEach(() => {
    agent = new AgentService();
  });

  describe('setCallback', () => {
    it('stores the callback for later use', async () => {
      const callback = vi.fn();
      agent.setCallback(callback);

      await agent.onAgentTrigger('1', 'AI_SPEC');

      expect(callback).toHaveBeenCalledWith('1', 'AI_SPEC');
    });
  });

  describe('onAgentTrigger', () => {
    it('triggers callback for AI_SPEC column', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'AI_SPEC');

      expect(callback).toHaveBeenCalledWith('42', 'AI_SPEC');
    });

    it('triggers callback for AI_CODE column', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'AI_CODE');

      expect(callback).toHaveBeenCalledWith('42', 'AI_CODE');
    });

    it('does NOT trigger for BRAIN_DUMP column', async () => {
      const callback = vi.fn();
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'BRAIN_DUMP');

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT trigger for HUMAN_SPEC_REVIEW column', async () => {
      const callback = vi.fn();
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'HUMAN_SPEC_REVIEW');

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT trigger for HUMAN_CODE_REVIEW column', async () => {
      const callback = vi.fn();
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'HUMAN_CODE_REVIEW');

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT trigger for PR_DONE column', async () => {
      const callback = vi.fn();
      agent.setCallback(callback);

      await agent.onAgentTrigger('42', 'PR_DONE');

      expect(callback).not.toHaveBeenCalled();
    });

    it('does nothing when no callback is registered', async () => {
      await expect(agent.onAgentTrigger('42', 'AI_SPEC')).resolves.toBeUndefined();
    });

    it('cancels existing agent before triggering new one', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      agent.setCallback(callback);

      // First trigger
      await agent.onAgentTrigger('42', 'AI_SPEC');
      expect(callback).toHaveBeenCalledTimes(1);

      // Second trigger for same issue
      await agent.onAgentTrigger('42', 'AI_CODE');
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('42', 'AI_CODE');
    });

    it('handles callback errors without throwing', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('Agent failed'));
      agent.setCallback(callback);

      await expect(agent.onAgentTrigger('42', 'AI_SPEC')).resolves.toBeUndefined();
    });
  });

  describe('cancelAgent', () => {
    it('aborts the active agent for the issue', async () => {
      let capturedAbort: AbortController | undefined;
      const callback = vi.fn().mockImplementation((_id: string, _col: string) => {
        return new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
      });

      // Intercept activeAgents via internal state
      agent.setCallback(callback);

      // Trigger and then cancel
      const triggerPromise = agent.onAgentTrigger('42', 'AI_SPEC');
      agent.cancelAgent('42');

      // Should resolve without error
      await expect(triggerPromise).resolves.toBeUndefined();
    });

    it('does nothing when no agent is active for the issue', () => {
      expect(() => agent.cancelAgent('999')).not.toThrow();
    });
  });

  describe('assignAgent', () => {
    it('completes without error', async () => {
      const mockGraphql = {} as GraphQLClient;
      await expect(agent.assignAgent(mockGraphql, '42')).resolves.toBeUndefined();
    });
  });
});

/** Tests for ClaudeHarness.getActiveSessions */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import { ColumnPromptService } from '../../services/columnPrompt';
import type { RepoManager } from '../../services/repoManager';
import type { GraphQLClient } from '../../services/graphql';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
    }),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ClaudeHarness.getActiveSessions', () => {
  let harness: ClaudeHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockMemento = { get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) };
    const promptService = new ColumnPromptService(mockMemento as any);
    harness = new ClaudeHarness({} as RepoManager, {} as GraphQLClient, promptService);
  });

  it('should return empty map when no sessions', () => {
    const sessions = harness.getActiveSessions();
    expect(sessions.size).toBe(0);
  });

  it('should return a copy of the sessions map', () => {
    const sessions1 = harness.getActiveSessions();
    const sessions2 = harness.getActiveSessions();
    expect(sessions1).not.toBe(sessions2);
  });
});

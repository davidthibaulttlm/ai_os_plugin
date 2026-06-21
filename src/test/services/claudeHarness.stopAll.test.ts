/** Tests for ClaudeHarness.stopAll */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
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

describe('ClaudeHarness.stopAll', () => {
  let harness: ClaudeHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    harness = new ClaudeHarness({} as RepoManager, {} as GraphQLClient);
  });

  it('should not throw when no sessions exist', () => {
    expect(() => harness.stopAll()).not.toThrow();
  });

  it('should clear all sessions', () => {
    harness.stopAll();
    const sessions = harness.getActiveSessions();
    expect(sessions.size).toBe(0);
  });
});

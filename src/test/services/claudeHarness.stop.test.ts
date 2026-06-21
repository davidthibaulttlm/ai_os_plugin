/** Tests for ClaudeHarness.stop */

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

describe('ClaudeHarness.stop', () => {
  let harness: ClaudeHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    harness = new ClaudeHarness({} as RepoManager, {} as GraphQLClient);
  });

  it('should not throw when session does not exist', () => {
    expect(() => harness.stop('nonexistent:key:1')).not.toThrow();
  });

  it('should remove session from active sessions', () => {
    harness.stop('owner:repo:1');
    const sessions = harness.getActiveSessions();
    expect(sessions.has('owner:repo:1')).toBe(false);
  });
});

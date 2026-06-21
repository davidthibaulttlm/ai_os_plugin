/** Tests for ClaudeHarness.constructor */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import type { RepoManager } from '../../services/repoManager';
import type { GraphQLClient } from '../../services/graphql';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((key: string, fallback: unknown) => {
        if (key === 'maxConcurrentAgents') return 3;
        if (key === 'autoWorkTimeoutSeconds') return 1800;
        return fallback;
      }),
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

describe('ClaudeHarness.constructor', () => {
  let mockRepoManager: RepoManager;
  let mockGraphql: GraphQLClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoManager = {} as RepoManager;
    mockGraphql = {} as GraphQLClient;
  });

  it('should initialize with default settings', () => {
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql);
    expect(harness).toBeDefined();
  });

  it('should initialize without webview', () => {
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql, undefined);
    expect(harness).toBeDefined();
  });

  it('should initialize with webview', () => {
    const mockWebview = { postMessage: vi.fn().mockResolvedValue(true) };
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql, mockWebview);
    expect(harness).toBeDefined();
  });
});

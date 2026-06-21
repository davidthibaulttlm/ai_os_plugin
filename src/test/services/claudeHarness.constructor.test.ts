/** Tests for ClaudeHarness.constructor */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import { ColumnPromptService } from '../../services/columnPrompt';
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
  let promptService: ColumnPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoManager = {} as RepoManager;
    mockGraphql = {} as GraphQLClient;
    const mockMemento = { get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) };
    promptService = new ColumnPromptService(mockMemento as any);
  });

  it('should initialize with default settings', () => {
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql, promptService);
    expect(harness).toBeDefined();
  });

  it('should initialize without webview', () => {
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql, promptService, undefined);
    expect(harness).toBeDefined();
  });

  it('should initialize with webview', () => {
    const mockWebview = { postMessage: vi.fn().mockResolvedValue(true) };
    const harness = new ClaudeHarness(mockRepoManager, mockGraphql, promptService, mockWebview);
    expect(harness).toBeDefined();
  });
});

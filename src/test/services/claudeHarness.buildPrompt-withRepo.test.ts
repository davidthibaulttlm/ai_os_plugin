import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import { ColumnPromptService } from '../../services/columnPrompt';
import type { RepoManager } from '../../services/repoManager';
import type { GraphQLClient } from '../../services/graphql';
import type { WebviewPoster } from '../../services/claudeHarness.types';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
    })),
  },
}));

describe('ClaudeHarness.buildPrompt() with repo context', () => {
  let harness: ClaudeHarness;
  let promptService: ColumnPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    const repoManager = {} as RepoManager;
    const graphql = {} as GraphQLClient;
    promptService = new ColumnPromptService({
      get: vi.fn(() => undefined),
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as import('vscode').Memento);

    harness = new ClaudeHarness(repoManager, graphql, promptService, undefined as unknown as WebviewPoster);
  });

  it('passes repo context to prompt assembly', () => {
    const assembleSpy = vi.spyOn(promptService, 'assemblePromptChain').mockReturnValue('test prompt');
    harness.buildPrompt({
      issueNumber: 1,
      owner: 'test',
      repo: 'repo',
      title: 'Fix bug',
      body: 'Description',
      column: 'AI_SPEC',
    });
    expect(assembleSpy).toHaveBeenCalledWith('AI_SPEC', expect.any(String), 'test', 'repo');
  });
});

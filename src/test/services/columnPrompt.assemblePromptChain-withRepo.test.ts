import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService } from '../../services/columnPrompt';
import { RepoPromptService } from '../../services/repoPrompt';
import type { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('ColumnPromptService.assemblePromptChain() with repo context', () => {
  let memento: vscode.Memento;
  let repoManager: RepoManager;
  let repoPromptService: RepoPromptService;
  let service: ColumnPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    memento = {
      get: vi.fn(() => undefined),
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as vscode.Memento;

    repoManager = {
      isRepoCloned: vi.fn(() => true),
      getRepoPath: vi.fn(() => '/tmp/repos/test/repo'),
    } as unknown as RepoManager;

    repoPromptService = new RepoPromptService(repoManager);
    service = new ColumnPromptService(memento, repoPromptService);
  });

  it('uses minimal prompt when CLAUDE.md exists', () => {
    vi.spyOn(repoPromptService, 'hasCLAUDEmd').mockReturnValue(true);
    const result = service.assemblePromptChain('AI_SPEC', 'Issue #1: Fix bug', 'test', 'repo');
    expect(result).toContain('You are an expert software architect');
    expect(result).toContain('Issue #1: Fix bug');
  });

  it('falls back to AGENTS.md when CLAUDE.md missing', () => {
    vi.spyOn(repoPromptService, 'hasCLAUDEmd').mockReturnValue(false);
    vi.spyOn(repoPromptService, 'hasAGENTSmd').mockReturnValue(true);
    vi.spyOn(repoPromptService, 'getAGENTSmd').mockReturnValue('# AGENTS.md\nRules here');
    const result = service.assemblePromptChain('AI_SPEC', 'Issue #1: Fix bug', 'test', 'repo');
    expect(result).toContain('# AGENTS.md');
    expect(result).toContain('Issue #1: Fix bug');
  });

  it('uses full prompt when no context files exist', () => {
    vi.spyOn(repoPromptService, 'hasCLAUDEmd').mockReturnValue(false);
    vi.spyOn(repoPromptService, 'hasAGENTSmd').mockReturnValue(false);
    const result = service.assemblePromptChain('AI_SPEC', 'Issue #1: Fix bug', 'test', 'repo');
    expect(result).toContain('You are an expert software architect');
    expect(result).toContain('Write a technical specification');
  });

  it('uses full prompt when no repo context provided', () => {
    const result = service.assemblePromptChain('AI_SPEC', 'Issue #1: Fix bug');
    expect(result).toContain('You are an expert software architect');
    expect(result).toContain('Write a technical specification');
  });
});

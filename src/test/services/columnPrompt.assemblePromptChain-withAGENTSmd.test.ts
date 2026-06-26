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

describe('ColumnPromptService.assemblePromptChain() with AGENTS.md', () => {
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

  it('injects AGENTS.md as system context with minimal column prompt', () => {
    vi.spyOn(repoPromptService, 'hasCLAUDEmd').mockReturnValue(false);
    vi.spyOn(repoPromptService, 'hasAGENTSmd').mockReturnValue(true);
    vi.spyOn(repoPromptService, 'getAGENTSmd').mockReturnValue('# AGENTS.md\nProject rules');
    const result = service.assemblePromptChain('AI_CODE', 'Issue #2: Implement feature', 'test', 'repo');
    expect(result).toContain('# AGENTS.md');
    expect(result).toContain('---');
    expect(result).toContain('Issue #2: Implement feature');
  });

  it('truncates AGENTS.md when exceeding limit', () => {
    vi.spyOn(repoPromptService, 'hasCLAUDEmd').mockReturnValue(false);
    vi.spyOn(repoPromptService, 'hasAGENTSmd').mockReturnValue(true);
    const longContent = 'A'.repeat(5000);
    vi.spyOn(repoPromptService, 'getAGENTSmd').mockReturnValue(longContent);
    const result = service.assemblePromptChain('AI_SPEC', 'Issue #1', 'test', 'repo');
    expect(result).toContain('[truncated]');
  });
});

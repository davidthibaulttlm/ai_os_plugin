import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService, AI_COLUMNS } from '../../services/columnPrompt';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('ColumnPromptService BRAIN_DUMP prompts', () => {
  let memento: vscode.Memento;
  let service: ColumnPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    memento = {
      get: vi.fn(() => undefined),
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as vscode.Memento;
    service = new ColumnPromptService(memento);
  });

  it('BRAIN_DUMP is in AI_COLUMNS', () => {
    expect(AI_COLUMNS).toContain('BRAIN_DUMP');
  });

  it('returns non-empty system prompt for BRAIN_DUMP', () => {
    const result = service.getSystemPrompt('BRAIN_DUMP');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('ideation');
  });

  it('returns non-empty developer prompt for BRAIN_DUMP', () => {
    const result = service.getDeveloperPrompt('BRAIN_DUMP');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('assembles prompt chain for BRAIN_DUMP', () => {
    const result = service.assemblePromptChain('BRAIN_DUMP', 'Idea: Add dark mode');
    expect(result).toContain('ideation');
    expect(result).toContain('Idea: Add dark mode');
  });
});

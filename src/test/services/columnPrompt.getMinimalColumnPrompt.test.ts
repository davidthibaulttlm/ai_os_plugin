import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService } from '../../services/columnPrompt';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('ColumnPromptService.getMinimalColumnPrompt()', () => {
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

  it('returns minimal prompt for AI_SPEC', () => {
    const result = service.getMinimalColumnPrompt('AI_SPEC');
    expect(result).toContain('software architect');
  });

  it('returns minimal prompt for AI_CODE', () => {
    const result = service.getMinimalColumnPrompt('AI_CODE');
    expect(result).toContain('software engineer');
  });

  it('returns minimal prompt for BRAIN_DUMP', () => {
    const result = service.getMinimalColumnPrompt('BRAIN_DUMP');
    expect(result).toContain('ideation');
  });

  it('returns empty string for unknown column', () => {
    const result = service.getMinimalColumnPrompt('UNKNOWN' as string);
    expect(result).toBe('');
  });
});

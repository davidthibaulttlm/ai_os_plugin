import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService } from '../../services/columnPrompt';

describe('ColumnPromptService.resetPrompt()', () => {
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

  it('clears Memento override for system prompt', () => {
    service.resetPrompt('AI_SPEC', 'system');
    expect(memento.update).toHaveBeenCalledWith('columnPrompts.AI_SPEC.system', undefined);
  });

  it('clears Memento override for developer prompt', () => {
    service.resetPrompt('AI_CODE', 'developer');
    expect(memento.update).toHaveBeenCalledWith('columnPrompts.AI_CODE.developer', undefined);
  });

  it('restores default on next get after reset', () => {
    vi.spyOn(memento, 'get').mockReturnValue('Custom prompt');
    service.resetPrompt('AI_SPEC', 'system');
    vi.spyOn(memento, 'get').mockReturnValue(undefined);
    const result = service.getSystemPrompt('AI_SPEC');
    expect(result).toContain('expert software architect');
  });

  it('does not reset for unknown column', () => {
    service.resetPrompt('UNKNOWN_COLUMN', 'system');
    expect(memento.update).not.toHaveBeenCalled();
  });
});

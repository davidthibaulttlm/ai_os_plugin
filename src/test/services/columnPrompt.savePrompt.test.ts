import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService } from '../../services/columnPrompt';

describe('ColumnPromptService.savePrompt()', () => {
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

  it('saves system prompt to Memento', () => {
    service.savePrompt('AI_SPEC', 'system', 'Custom prompt');
    expect(memento.update).toHaveBeenCalledWith('columnPrompts.AI_SPEC.system', 'Custom prompt');
  });

  it('saves developer prompt to Memento', () => {
    service.savePrompt('AI_CODE', 'developer', 'Custom dev prompt');
    expect(memento.update).toHaveBeenCalledWith('columnPrompts.AI_CODE.developer', 'Custom dev prompt');
  });

  it('clears override when empty string is saved', () => {
    service.savePrompt('AI_SPEC', 'system', '');
    expect(memento.update).toHaveBeenCalledWith('columnPrompts.AI_SPEC.system', undefined);
  });

  it('does not save for unknown column', () => {
    service.savePrompt('UNKNOWN_COLUMN', 'system', 'text');
    expect(memento.update).not.toHaveBeenCalled();
  });

  it('saves for human columns (they are known columns)', () => {
    service.savePrompt('BRAIN_DUMP', 'system', 'text');
    expect(memento.update).toHaveBeenCalledWith('columnPrompts.BRAIN_DUMP.system', 'text');
  });
});

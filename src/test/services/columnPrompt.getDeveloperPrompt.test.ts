import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService } from '../../services/columnPrompt';

describe('ColumnPromptService.getDeveloperPrompt()', () => {
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

  it('returns default developer prompt for AI_SPEC', () => {
    const result = service.getDeveloperPrompt('AI_SPEC');
    expect(result).toContain('Write a technical specification with these sections');
    expect(result).toContain('1. Overview');
    expect(result).toContain('2. Architecture');
  });

  it('returns default developer prompt for AI_CODE', () => {
    const result = service.getDeveloperPrompt('AI_CODE');
    expect(result).toContain('Implement the code for this issue');
    expect(result).toContain('Stage your changes');
  });

  it('returns empty string for human columns', () => {
    expect(service.getDeveloperPrompt('HUMAN_SPEC_REVIEW')).toBe('');
    expect(service.getDeveloperPrompt('HUMAN_CODE_REVIEW')).toBe('');
    expect(service.getDeveloperPrompt('BRAIN_DUMP')).toBe('');
    expect(service.getDeveloperPrompt('PR_DONE')).toBe('');
  });

  it('returns Memento override when set', () => {
    vi.spyOn(memento, 'get').mockReturnValue('Custom developer prompt');
    const result = service.getDeveloperPrompt('AI_SPEC');
    expect(result).toBe('Custom developer prompt');
  });

  it('returns empty string for unknown column', () => {
    const result = service.getDeveloperPrompt('UNKNOWN_COLUMN');
    expect(result).toBe('');
  });
});

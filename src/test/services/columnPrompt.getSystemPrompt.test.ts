import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService } from '../../services/columnPrompt';

describe('ColumnPromptService.getSystemPrompt()', () => {
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

  it('returns default system prompt for AI_SPEC', () => {
    const result = service.getSystemPrompt('AI_SPEC');
    expect(result).toBe('You are an expert software architect and technical writer. Your task is to write detailed technical specifications for software issues. You produce clear, actionable specs that a developer can implement from.');
  });

  it('returns default system prompt for AI_CODE', () => {
    const result = service.getSystemPrompt('AI_CODE');
    expect(result).toBe("You are a senior software engineer implementing code changes. You write clean, tested, production-ready code that follows the project's existing patterns and conventions.");
  });

  it('returns empty string for human columns', () => {
    expect(service.getSystemPrompt('HUMAN_SPEC_REVIEW')).toBe('');
    expect(service.getSystemPrompt('HUMAN_CODE_REVIEW')).toBe('');
    expect(service.getSystemPrompt('BRAIN_DUMP')).toBe('');
    expect(service.getSystemPrompt('PR_DONE')).toBe('');
  });

  it('returns Memento override when set', () => {
    vi.spyOn(memento, 'get').mockReturnValue('Custom system prompt');
    const result = service.getSystemPrompt('AI_SPEC');
    expect(result).toBe('Custom system prompt');
  });

  it('returns empty string for unknown column', () => {
    const result = service.getSystemPrompt('UNKNOWN_COLUMN');
    expect(result).toBe('');
  });
});

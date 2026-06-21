import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService } from '../../services/columnPrompt';

describe('ColumnPromptService.assemblePromptChain()', () => {
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

  it('assembles prompt chain for AI_SPEC column', () => {
    const userContent = 'Issue #1: Fix the bug';
    const result = service.assemblePromptChain('AI_SPEC', userContent);
    expect(result).toContain('You are an expert software architect');
    expect(result).toContain('Write a technical specification');
    expect(result).toContain(userContent);
  });

  it('assembles prompt chain for AI_CODE column', () => {
    const userContent = 'Issue #2: Implement feature';
    const result = service.assemblePromptChain('AI_CODE', userContent);
    expect(result).toContain('You are a senior software engineer');
    expect(result).toContain('Implement the code for this issue');
    expect(result).toContain(userContent);
  });

  it('returns only user content for human columns', () => {
    const userContent = 'Issue #3: Review spec';
    const result = service.assemblePromptChain('HUMAN_SPEC_REVIEW', userContent);
    expect(result).toBe(userContent);
  });

  it('handles empty user content', () => {
    const result = service.assemblePromptChain('AI_SPEC', '');
    expect(result).toContain('You are an expert software architect');
    expect(result).toContain('Write a technical specification');
  });

  it('never truncates large user content', () => {
    const largeContent = 'A'.repeat(50000);
    const result = service.assemblePromptChain('AI_SPEC', largeContent);
    expect(result).toContain(largeContent);
  });
});

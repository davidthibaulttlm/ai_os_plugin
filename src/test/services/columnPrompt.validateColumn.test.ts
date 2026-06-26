import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ColumnPromptService, KNOWN_COLUMNS, AI_COLUMNS } from '../../services/columnPrompt';

describe('ColumnPromptService column validation', () => {
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

  it('accepts all known columns', () => {
    for (const column of KNOWN_COLUMNS) {
      expect(service.getSystemPrompt(column)).toBeDefined();
    }
  });

  it('returns empty for unknown columns', () => {
    expect(service.getSystemPrompt('NOT_A_COLUMN')).toBe('');
    expect(service.getDeveloperPrompt('NOT_A_COLUMN')).toBe('');
  });

  it('KNOWN_COLUMNS has 6 entries', () => {
    expect(KNOWN_COLUMNS).toHaveLength(6);
  });

  it('AI_COLUMNS has 3 entries including BRAIN_DUMP', () => {
    expect(AI_COLUMNS).toEqual(['BRAIN_DUMP', 'AI_SPEC', 'AI_CODE']);
  });

  it('AI_COLUMNS are subset of KNOWN_COLUMNS', () => {
    for (const aiCol of AI_COLUMNS) {
      expect(KNOWN_COLUMNS).toContain(aiCol);
    }
  });
});

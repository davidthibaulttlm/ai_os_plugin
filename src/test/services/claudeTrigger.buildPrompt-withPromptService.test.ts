import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeTrigger } from '../../services/claudeTrigger';
import { ColumnPromptService } from '../../services/columnPrompt';
import * as vscode from 'vscode';

describe('ClaudeTrigger with ColumnPromptService', () => {
  let memento: vscode.Memento;
  let promptService: ColumnPromptService;
  let trigger: ClaudeTrigger;

  beforeEach(() => {
    vi.clearAllMocks();
    memento = {
      get: vi.fn(() => undefined),
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as vscode.Memento;
    promptService = new ColumnPromptService(memento);
    trigger = new ClaudeTrigger(promptService);
  });

  it('accepts prompt service in constructor', () => {
    expect(trigger).toBeDefined();
  });

  it('works without prompt service (fallback)', () => {
    const triggerNoService = new ClaudeTrigger();
    triggerNoService.setCallback(() => {});
    const event = {
      issueNumber: 4,
      title: 'Fallback Issue',
      body: 'Fallback body',
      column: 'AI_SPEC',
      reason: 'assigned' as const,
    };
    triggerNoService.checkTrigger(event);
  });

  it('triggers callback for AI_SPEC column', () => {
    let callbackCalled = false;
    trigger.setCallback(() => { callbackCalled = true; });
    const event = {
      issueNumber: 1,
      title: 'Test Issue',
      body: 'Test body',
      column: 'AI_SPEC',
      reason: 'assigned' as const,
    };
    trigger.checkTrigger(event);
    expect(callbackCalled).toBe(true);
  });

  it('triggers callback for AI_CODE column', () => {
    let callbackCalled = false;
    trigger.setCallback(() => { callbackCalled = true; });
    const event = {
      issueNumber: 2,
      title: 'Code Issue',
      body: 'Code body',
      column: 'AI_CODE',
      reason: 'column_move' as const,
    };
    trigger.checkTrigger(event);
    expect(callbackCalled).toBe(true);
  });
});

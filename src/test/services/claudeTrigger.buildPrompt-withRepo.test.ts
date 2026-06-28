import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeTrigger, TriggerEvent } from '../../services/claudeTrigger';
import { ColumnPromptService } from '../../services/columnPrompt';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('ClaudeTrigger.buildPrompt() with repo context', () => {
  let trigger: ClaudeTrigger;
  let promptService: ColumnPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    promptService = new ColumnPromptService({
      get: vi.fn(() => undefined),
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as import('vscode').Memento);
    trigger = new ClaudeTrigger(promptService);
  });

  it('passes repo context to prompt assembly', () => {
    const assembleSpy = vi.spyOn(promptService, 'assemblePromptChain').mockReturnValue('test prompt');
    const event: TriggerEvent = {
      issueNumber: 1,
      title: 'Fix bug',
      body: 'Description',
      column: 'AI_SPEC',
      reason: 'assigned',
      owner: 'test',
      repo: 'repo',
    };
    (trigger as any).buildPrompt(event);
    expect(assembleSpy).toHaveBeenCalledWith('AI_SPEC', expect.any(String), 'test', 'repo');
  });

  it('works without repo context', () => {
    const assembleSpy = vi.spyOn(promptService, 'assemblePromptChain').mockReturnValue('test prompt');
    const event: TriggerEvent = {
      issueNumber: 1,
      title: 'Fix bug',
      body: 'Description',
      column: 'AI_SPEC',
      reason: 'assigned',
    };
    (trigger as any).buildPrompt(event);
    expect(assembleSpy).toHaveBeenCalledWith('AI_SPEC', expect.any(String), undefined, undefined);
  });
});

/** Tests for ClaudeTrigger — always auto-works without restrictions */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeTrigger } from '../../services/claudeTrigger';
import { spawnClaude, getWorkingIssues } from '../../services/claudeSpawner';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
    }),
  },
  window: {
    showInformationMessage: vi.fn(),
  },
}));

vi.mock('../../services/claudeSpawner', () => ({
  spawnClaude: vi.fn(),
  getWorkingIssues: vi.fn().mockReturnValue(new Set()),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ClaudeTrigger — always auto-works', () => {
  let trigger: ClaudeTrigger;
  let callback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    trigger = new ClaudeTrigger();
    callback = vi.fn();
    trigger.setCallback(callback);
  });

  it('should trigger without checking autoWorkAssignments config', () => {
    trigger.checkTrigger({
      issueNumber: 42,
      title: 'Test issue',
      column: 'AI_SPEC',
      reason: 'assigned',
    });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      issueNumber: 42,
    }));
  });

  it('should skip when already working on the issue', () => {
    vi.mocked(getWorkingIssues).mockReturnValue(new Set([99]));
    trigger.checkTrigger({
      issueNumber: 99,
      title: 'Working issue',
      column: 'AI_SPEC',
      reason: 'assigned',
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not show confirmation dialog', async () => {
    vi.mocked(spawnClaude).mockReturnValue(true);
    await trigger.handleTrigger(
      { issueNumber: 42, title: 'Test', column: 'AI_SPEC', reason: 'assigned' },
      'token',
      '/workspace'
    );
    // spawnClaude should be called without any confirmation
    expect(spawnClaude).toHaveBeenCalledWith(42, expect.any(String), expect.objectContaining({
      cwd: '/workspace',
      githubToken: 'token',
    }));
  });

  it('should not pass maxTurns or allowedTools to spawnClaude', async () => {
    vi.mocked(spawnClaude).mockReturnValue(true);
    await trigger.handleTrigger(
      { issueNumber: 42, title: 'Test', column: 'AI_SPEC', reason: 'assigned' },
      'token',
      '/workspace'
    );
    const options = vi.mocked(spawnClaude).mock.calls[0][2];
    expect(options).not.toHaveProperty('maxTurns');
    expect(options).not.toHaveProperty('allowedTools');
  });
});

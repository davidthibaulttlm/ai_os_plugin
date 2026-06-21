/** Tests for ClaudeSpawner — no maxTurns/allowedTools in options or CLI */

import { describe, it, expect, vi } from 'vitest';
import { spawnClaude } from '../../services/claudeSpawner';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  })),
}));

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      append: vi.fn(),
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    })),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import * as child_process from 'child_process';

describe('ClaudeSpawner — spawn without restrictions', () => {
  it('should accept options without maxTurns or allowedTools', () => {
    vi.mocked(child_process.spawn).mockClear();
    const result = spawnClaude(42, 'test prompt', {
      cwd: '/workspace',
      githubToken: 'token',
    });
    expect(result).toBe(true);
  });

  it('should not include --max-turns in CLI args', () => {
    vi.mocked(child_process.spawn).mockClear();
    spawnClaude(100, 'test prompt', {
      cwd: '/workspace',
      githubToken: 'token',
    });
    expect(child_process.spawn).toHaveBeenCalled();
    const args = vi.mocked(child_process.spawn).mock.calls[0][1];
    expect(args).not.toContain('--max-turns');
  });

  it('should not include --allowedTools in CLI args', () => {
    vi.mocked(child_process.spawn).mockClear();
    spawnClaude(101, 'test prompt', {
      cwd: '/workspace',
      githubToken: 'token',
    });
    expect(child_process.spawn).toHaveBeenCalled();
    const args = vi.mocked(child_process.spawn).mock.calls[0][1];
    expect(args).not.toContain('--allowedTools');
  });

  it('should only include -p and prompt in args', () => {
    vi.mocked(child_process.spawn).mockClear();
    spawnClaude(102, 'my prompt', {
      cwd: '/workspace',
      githubToken: 'token',
    });
    expect(child_process.spawn).toHaveBeenCalled();
    const args = vi.mocked(child_process.spawn).mock.calls[0][1];
    expect(args).toEqual(['-p', 'my prompt']);
  });
});

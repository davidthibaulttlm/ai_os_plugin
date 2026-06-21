import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('RepoManager.constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores reposDir as-is when no tilde', () => {
    const mgr = new RepoManager('/tmp/repos', 'token123');
    expect(mgr.getReposDir()).toBe('/tmp/repos');
  });

  it('expands tilde to home directory', () => {
    const home = os.homedir();
    const mgr = new RepoManager('~/ai-os-repos', 'token123');
    expect(mgr.getReposDir()).toBe(`${home}/ai-os-repos`);
  });

  it('handles partial tilde path', () => {
    const home = os.homedir();
    const mgr = new RepoManager('~/projects/repos', 'token123');
    expect(mgr.getReposDir()).toBe(`${home}/projects/repos`);
  });

  it('does not expand tilde in middle of path', () => {
    const mgr = new RepoManager('/tmp/~repos', 'token123');
    expect(mgr.getReposDir()).toBe('/tmp/~repos');
  });
});

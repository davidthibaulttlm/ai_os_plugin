import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

describe('RepoManager.getReposDir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the resolved repos directory', () => {
    const mgr = new RepoManager('/tmp/repos', 'token123');
    expect(mgr.getReposDir()).toBe('/tmp/repos');
  });

  it('returns expanded home directory path', () => {
    const home = os.homedir();
    const mgr = new RepoManager('~/repos', 'token123');
    expect(mgr.getReposDir()).toBe(`${home}/repos`);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { RepoPromptService } from '../../services/repoPrompt';
import type { RepoManager } from '../../services/repoManager';

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(),
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(),
  })) },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    statSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn(),
}));

describe('RepoPromptService cache behavior', () => {
  let repoManager: RepoManager;
  let service: RepoPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReset();
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReset();
    (fs.statSync as ReturnType<typeof vi.fn>).mockReset();
    repoManager = {
      isRepoCloned: vi.fn(() => true),
      getRepoPath: vi.fn(() => '/tmp/repos/test/repo'),
    } as unknown as RepoManager;
    service = new RepoPromptService(repoManager);
  });

  it('caches CLAUDE.md content on first read', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('# Project');
    (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ mtimeMs: 12345 } as fs.Stats);

    const first = service.getCLAUDEmd('test', 'repo');
    expect(first).toBe('# Project');
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);

    const second = service.getCLAUDEmd('test', 'repo');
    expect(second).toBe('# Project');
    expect(fs.readFileSync).toHaveBeenCalledTimes(1); // Cache hit, no second read
  });

  it('invalidates cache when file mtime changes', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('# Project');
    let callCount = 0;
    (fs.statSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      return { mtimeMs: 12345 + callCount } as fs.Stats;
    });

    service.getCLAUDEmd('test', 'repo');
    service.getCLAUDEmd('test', 'repo');
    expect(fs.readFileSync).toHaveBeenCalledTimes(2); // Both reads due to mtime change
  });
});

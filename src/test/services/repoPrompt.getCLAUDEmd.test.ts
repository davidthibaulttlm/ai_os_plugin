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

describe('RepoPromptService.getCLAUDEmd()', () => {
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

  it('returns content when CLAUDE.md exists', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('# Project\nContent here');
    (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ mtimeMs: 12345 } as fs.Stats);
    expect(service.getCLAUDEmd('test', 'repo')).toBe('# Project\nContent here');
  });

  it('returns null when repo is not cloned', () => {
    (repoManager.isRepoCloned as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(service.getCLAUDEmd('test', 'repo')).toBeNull();
  });

  it('returns null when file is empty', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('');
    expect(service.getCLAUDEmd('test', 'repo')).toBeNull();
  });
});

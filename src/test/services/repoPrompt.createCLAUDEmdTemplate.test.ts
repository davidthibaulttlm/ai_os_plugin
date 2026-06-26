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

describe('RepoPromptService.createCLAUDEmdTemplate()', () => {
  let repoManager: RepoManager;
  let service: RepoPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReset();
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockReset();
    repoManager = {
      isRepoCloned: vi.fn(() => true),
      getRepoPath: vi.fn(() => '/tmp/repos/test/repo'),
    } as unknown as RepoManager;
    service = new RepoPromptService(repoManager);
  });

  it('returns true when template is created', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(service.createCLAUDEmdTemplate('test', 'repo')).toBe(true);
  });

  it('returns false when file already exists', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(service.createCLAUDEmdTemplate('test', 'repo')).toBe(false);
  });

  it('returns false when repo is not cloned', () => {
    (repoManager.isRepoCloned as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(service.createCLAUDEmdTemplate('test', 'repo')).toBe(false);
  });
});

/** Tests for ClaudeHarness.buildPrompt */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeHarness } from '../../services/claudeHarness';
import type { RepoManager } from '../../services/repoManager';
import type { GraphQLClient } from '../../services/graphql';
import type { IssueContext } from '../../services/claudeHarness';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
    }),
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

describe('ClaudeHarness.buildPrompt', () => {
  let harness: ClaudeHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    harness = new ClaudeHarness({} as RepoManager, {} as GraphQLClient);
  });

  it('should include title and issue number', () => {
    const ctx: IssueContext = {
      issueNumber: 42,
      owner: 'test',
      repo: 'repo',
      title: 'Test issue',
      column: 'AI_CODE',
    };
    const prompt = harness.buildPrompt(ctx);
    expect(prompt).toContain('#42');
    expect(prompt).toContain('Test issue');
  });

  it('should include body when present', () => {
    const ctx: IssueContext = {
      issueNumber: 1,
      owner: 'test',
      repo: 'repo',
      title: 'Title',
      body: 'This is the body',
      column: 'AI_CODE',
    };
    const prompt = harness.buildPrompt(ctx);
    expect(prompt).toContain('This is the body');
  });

  it('should omit body section when empty', () => {
    const ctx: IssueContext = {
      issueNumber: 1,
      owner: 'test',
      repo: 'repo',
      title: 'Title',
      body: '',
      column: 'AI_CODE',
    };
    const prompt = harness.buildPrompt(ctx);
    expect(prompt).not.toContain('## Description');
  });

  it('should include labels when present', () => {
    const ctx: IssueContext = {
      issueNumber: 1,
      owner: 'test',
      repo: 'repo',
      title: 'Title',
      labels: ['bug', 'priority/high'],
      column: 'AI_CODE',
    };
    const prompt = harness.buildPrompt(ctx);
    expect(prompt).toContain('bug');
    expect(prompt).toContain('priority/high');
  });

  it('should include column name', () => {
    const ctx: IssueContext = {
      issueNumber: 1,
      owner: 'test',
      repo: 'repo',
      title: 'Title',
      column: 'AI_SPEC',
    };
    const prompt = harness.buildPrompt(ctx);
    expect(prompt).toContain('AI_SPEC');
  });

  it('should truncate body at newline boundary', () => {
    const longBody = 'A'.repeat(4200) + '\n' + 'B'.repeat(500);
    const ctx: IssueContext = {
      issueNumber: 1,
      owner: 'test',
      repo: 'repo',
      title: 'Title',
      body: longBody,
      column: 'AI_CODE',
    };
    const prompt = harness.buildPrompt(ctx);
    expect(prompt).toContain('[TRUNCATED]');
  });

  it('should include column-specific instructions for AI_SPEC', () => {
    const ctx: IssueContext = {
      issueNumber: 1,
      owner: 'test',
      repo: 'repo',
      title: 'Title',
      column: 'AI_SPEC',
    };
    const prompt = harness.buildPrompt(ctx);
    expect(prompt).toContain('technical specification');
  });

  it('should include column-specific instructions for AI_CODE', () => {
    const ctx: IssueContext = {
      issueNumber: 1,
      owner: 'test',
      repo: 'repo',
      title: 'Title',
      column: 'AI_CODE',
    };
    const prompt = harness.buildPrompt(ctx);
    expect(prompt).toContain('Implement the code');
  });
});

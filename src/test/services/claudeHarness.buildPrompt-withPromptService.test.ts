import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ClaudeHarness } from '../../services/claudeHarness';
import { ColumnPromptService } from '../../services/columnPrompt';
import type { RepoManager } from '../../services/repoManager';
import type { GraphQLClient } from '../../services/graphql';

describe('ClaudeHarness.buildPrompt() with ColumnPromptService', () => {
  let repoManager: RepoManager;
  let graphql: GraphQLClient;
  let memento: vscode.Memento;
  let promptService: ColumnPromptService;
  let harness: ClaudeHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    memento = {
      get: vi.fn(() => undefined),
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as vscode.Memento;
    promptService = new ColumnPromptService(memento);
    repoManager = {} as RepoManager;
    graphql = {} as GraphQLClient;
    harness = new ClaudeHarness(repoManager, graphql, promptService);
  });

  it('uses ColumnPromptService for AI_SPEC column', () => {
    const prompt = harness.buildPrompt({
      issueNumber: 1,
      title: 'Test Issue',
      body: 'Test body',
      column: 'AI_SPEC',
      owner: 'test',
      repo: 'test',
    });
    expect(prompt).toContain('expert software architect');
    expect(prompt).toContain('Test Issue');
    expect(prompt).toContain('Test body');
  });

  it('uses ColumnPromptService for AI_CODE column', () => {
    const prompt = harness.buildPrompt({
      issueNumber: 2,
      title: 'Code Issue',
      body: 'Code body',
      column: 'AI_CODE',
      owner: 'test',
      repo: 'test',
    });
    expect(prompt).toContain('senior software engineer');
    expect(prompt).toContain('Code Issue');
    expect(prompt).toContain('Code body');
  });

  it('preserves issue metadata in prompt', () => {
    const prompt = harness.buildPrompt({
      issueNumber: 3,
      title: 'Meta Issue',
      body: 'Meta body',
      labels: ['bug', 'priority'],
      column: 'AI_SPEC',
      owner: 'owner',
      repo: 'repo',
    });
    expect(prompt).toContain('#3');
    expect(prompt).toContain('Meta Issue');
    expect(prompt).toContain('bug, priority');
    expect(prompt).toContain('owner/repo');
  });

  it('does not truncate large issue body', () => {
    const largeBody = 'A'.repeat(50000);
    const prompt = harness.buildPrompt({
      issueNumber: 4,
      title: 'Large Issue',
      body: largeBody,
      column: 'AI_SPEC',
      owner: 'test',
      repo: 'test',
    });
    expect(prompt).toContain(largeBody);
  });

  it('returns only user content for human columns', () => {
    const prompt = harness.buildPrompt({
      issueNumber: 5,
      title: 'Human Review Issue',
      body: 'Review this',
      column: 'HUMAN_SPEC_REVIEW',
      owner: 'test',
      repo: 'test',
    });
    expect(prompt).toContain('#5');
    expect(prompt).toContain('Human Review Issue');
    expect(prompt).not.toContain('expert software architect');
    expect(prompt).not.toContain('senior software engineer');
  });
});

/**
 * ColumnPromptService — manages per-column system and developer prompts.
 * Stores default prompts for AI-eligible columns (AI_SPEC, AI_CODE, BRAIN_DUMP) and
 * allows user overrides persisted via VS Code Memento.
 * Supports repo-aware prompt resolution via CLAUDE.md and AGENTS.md.
 */

import * as vscode from 'vscode';
import type { RepoPromptService } from './repoPrompt';
import { logger } from './logger';

/** Known kanban column names */
export const KNOWN_COLUMNS = [
  'BRAIN_DUMP',
  'AI_SPEC',
  'HUMAN_SPEC_REVIEW',
  'AI_CODE',
  'HUMAN_CODE_REVIEW',
  'PR_DONE',
] as const;

export type KnownColumn = (typeof KNOWN_COLUMNS)[number];

/** AI-eligible columns that trigger agent work */
export const AI_COLUMNS = ['BRAIN_DUMP', 'AI_SPEC', 'AI_CODE'] as const;

export type AIColumn = (typeof AI_COLUMNS)[number];

/** Default system prompts for each AI column */
const DEFAULT_SYSTEM_PROMPTS: Record<AIColumn, string> = {
  BRAIN_DUMP:
    'You are an ideation assistant. Expand rough ideas into structured analysis with options, tradeoffs, and recommendations.',
  AI_SPEC:
    'You are an expert software architect and technical writer. Your task is to write detailed technical specifications for software issues. You produce clear, actionable specs that a developer can implement from.',
  AI_CODE:
    "You are a senior software engineer implementing code changes. You write clean, tested, production-ready code that follows the project's existing patterns and conventions.",
};

/** Default developer prompts for each AI column */
const DEFAULT_DEVELOPER_PROMPTS: Record<AIColumn, string> = {
  BRAIN_DUMP: [
    'Take the issue idea and produce:',
    '1. Problem Statement — clear definition of what needs solving',
    '2. Options Analysis — 2-3 approaches with pros/cons',
    '3. Recommendation — suggested path forward with reasoning',
    '4. Next Steps — actionable items for the AI_SPEC column',
  ].join('\n'),
  AI_SPEC: [
    'Write a technical specification with these sections:',
    '1. Overview — brief summary of the feature/fix',
    '2. Architecture — high-level design decisions and approach',
    '3. API Contracts — interfaces, endpoints, data models (if applicable)',
    '4. Implementation Plan — step-by-step implementation order',
    '5. Testing Strategy — how to verify the implementation',
    '',
    'Follow the existing codebase conventions. Reference existing files and patterns. Keep the spec focused and actionable.',
  ].join('\n'),
  AI_CODE: [
    'Implement the code for this issue. Follow these rules:',
    '1. Read the specification if one exists in the issue body',
    '2. Follow existing code patterns, naming conventions, and architecture',
    '3. Write tests for new functionality',
    '4. Stage your changes with \'git add\' when done',
    '5. Do NOT commit — the harness will commit after you finish',
    '6. Do NOT push — the harness will push after you finish',
    '7. Keep changes minimal and scoped to the issue',
    '8. Log all method entries with the project logger',
  ].join('\n'),
};

/** Minimal column role prompts used when CLAUDE.md or AGENTS.md provides system context */
const MINIMAL_COLUMN_PROMPTS: Record<AIColumn, string> = {
  BRAIN_DUMP: 'You are an ideation assistant. Expand the following issue idea into structured analysis.',
  AI_SPEC: 'You are an expert software architect. Write a technical specification for the following issue.',
  AI_CODE: 'You are a senior software engineer. Implement the code for the following issue.',
};

/** Memento key prefix for prompt overrides */
const MEMENTO_PREFIX = 'columnPrompts';

function mementoKey(column: string, type: 'system' | 'developer'): string {
  return `${MEMENTO_PREFIX}.${column}.${type}`;
}

/**
 * ColumnPromptService — centralizes prompt management for kanban columns.
 */
export class ColumnPromptService {
  private memento: vscode.Memento;
  private repoPromptService?: RepoPromptService;

  /**
   * Create a ColumnPromptService instance.
   * @param memento - VS Code Memento (context.globalState) for persistence
   * @param repoPromptService - Optional RepoPromptService for repo-aware prompt resolution
   */
  public constructor(memento: vscode.Memento, repoPromptService?: RepoPromptService) {
    logger.info('[ColumnPromptService.constructor] Initializing ColumnPromptService');
    this.memento = memento;
    this.repoPromptService = repoPromptService;
    logger.info('[ColumnPromptService.constructor] Result: initialized');
  }

  /**
   * Set or update the RepoPromptService dependency.
   */
  public setRepoPromptService(service: RepoPromptService): void {
    logger.info('[ColumnPromptService.setRepoPromptService] Setting RepoPromptService');
    this.repoPromptService = service;
    logger.info('[ColumnPromptService.setRepoPromptService] Result: set');
  }

  /**
   * Validate that a column name is known. Logs warning for unknown columns.
   */
  private validateColumn(column: string): boolean {
    logger.info(`[ColumnPromptService.validateColumn] column=${column}`);
    if (!KNOWN_COLUMNS.includes(column as KnownColumn)) {
      logger.warn(`[ColumnPromptService.validateColumn] Unknown column: ${column}`);
      return false;
    }
    logger.info(`[ColumnPromptService.validateColumn] Result: valid column ${column}`);
    return true;
  }

  /**
   * Get the default system prompt for a column.
   * Returns empty string for human columns.
   */
  public getDefaultSystemPrompt(column: string): string {
    logger.info(`[ColumnPromptService.getDefaultSystemPrompt] column=${column}`);
    if (!this.validateColumn(column)) {
      return '';
    }
    const prompt = DEFAULT_SYSTEM_PROMPTS[column as AIColumn];
    const result = prompt ?? '';
    logger.info(`[ColumnPromptService.getDefaultSystemPrompt] Result: length=${result.length}`);
    return result;
  }

  /**
   * Get the default developer prompt for a column.
   * Returns empty string for human columns.
   */
  public getDefaultDeveloperPrompt(column: string): string {
    logger.info(`[ColumnPromptService.getDefaultDeveloperPrompt] column=${column}`);
    if (!this.validateColumn(column)) {
      return '';
    }
    const prompt = DEFAULT_DEVELOPER_PROMPTS[column as AIColumn];
    const result = prompt ?? '';
    logger.info(`[ColumnPromptService.getDefaultDeveloperPrompt] Result: length=${result.length}`);
    return result;
  }

  /**
   * Get the minimal column prompt for a column.
   * Used when CLAUDE.md or AGENTS.md provides system context.
   */
  public getMinimalColumnPrompt(column: string): string {
    logger.info(`[ColumnPromptService.getMinimalColumnPrompt] column=${column}`);
    if (!this.validateColumn(column)) {
      return '';
    }
    const prompt = MINIMAL_COLUMN_PROMPTS[column as AIColumn];
    const result = prompt ?? '';
    logger.info(`[ColumnPromptService.getMinimalColumnPrompt] Result: length=${result.length}`);
    return result;
  }

  /**
   * Get the system prompt for a column.
   * Returns Memento override if set, otherwise default.
   * Returns empty string for human columns or unknown columns.
   */
  public getSystemPrompt(column: string): string {
    logger.info(`[ColumnPromptService.getSystemPrompt] column=${column}`);
    if (!this.validateColumn(column)) {
      return '';
    }
    const override = this.memento.get<string>(mementoKey(column, 'system'));
    if (override !== undefined && override !== '') {
      logger.info(`[ColumnPromptService.getSystemPrompt] Result: using Memento override length=${override.length}`);
      return override;
    }
    const result = DEFAULT_SYSTEM_PROMPTS[column as AIColumn] ?? '';
    logger.info(`[ColumnPromptService.getSystemPrompt] Result: using default length=${result.length}`);
    return result;
  }

  /**
   * Get the developer prompt for a column.
   * Returns Memento override if set, otherwise default.
   * Returns empty string for human columns or unknown columns.
   */
  public getDeveloperPrompt(column: string): string {
    logger.info(`[ColumnPromptService.getDeveloperPrompt] column=${column}`);
    if (!this.validateColumn(column)) {
      return '';
    }
    const override = this.memento.get<string>(mementoKey(column, 'developer'));
    if (override !== undefined && override !== '') {
      logger.info(`[ColumnPromptService.getDeveloperPrompt] Result: using Memento override length=${override.length}`);
      return override;
    }
    const result = DEFAULT_DEVELOPER_PROMPTS[column as AIColumn] ?? '';
    logger.info(`[ColumnPromptService.getDeveloperPrompt] Result: using default length=${result.length}`);
    return result;
  }

  /**
   * Assemble the full prompt chain: system → developer → user content.
   * For human columns, returns just the user content.
   * When repo context is provided, uses three-tier resolution:
   *   1. CLAUDE.md → minimal prompt (Claude reads it automatically)
   *   2. AGENTS.md → AGENTS.md as system context + minimal prompt
   *   3. Neither → full column defaults
   */
  public assemblePromptChain(
    column: string,
    userContent: string,
    owner?: string,
    repo?: string
  ): string {
    logger.info(`[ColumnPromptService.assemblePromptChain] column=${column} userContentLength=${userContent.length} owner=${owner} repo=${repo}`);
    if (!this.validateColumn(column)) {
      logger.info(`[ColumnPromptService.assemblePromptChain] Result: unknown column, returning user content only`);
      return userContent;
    }

    // Three-tier resolution when repo context is provided
    if (owner && repo && this.repoPromptService) {
      // Tier 1: CLAUDE.md exists — minimal prompt (Claude reads it automatically)
      if (this.repoPromptService.hasCLAUDEmd(owner, repo)) {
        logger.info(`[ColumnPromptService.assemblePromptChain] Using CLAUDE.md path for ${owner}/${repo}`);
        return this.buildMinimalPrompt(column, userContent);
      }

      // Tier 2: AGENTS.md exists — AGENTS.md as system context + minimal prompt
      if (this.repoPromptService.hasAGENTSmd(owner, repo)) {
        logger.info(`[ColumnPromptService.assemblePromptChain] Using AGENTS.md path for ${owner}/${repo}`);
        return this.buildAGENTSmdPrompt(column, userContent, owner, repo);
      }
    }

    // Tier 3: No context file — full column defaults
    logger.info(`[ColumnPromptService.assemblePromptChain] Using full column defaults`);
    return this.buildFullPrompt(column, userContent);
  }

  /**
   * Build minimal prompt: column role + user content.
   * Used when CLAUDE.md exists (Claude reads it automatically).
   */
  private buildMinimalPrompt(column: string, userContent: string): string {
    logger.info(`[ColumnPromptService.buildMinimalPrompt] column=${column}`);
    const minimal = this.getMinimalColumnPrompt(column);
    const parts: string[] = [];
    if (minimal) {
      parts.push(minimal);
    }
    if (userContent) {
      parts.push(userContent);
    }
    const result = parts.join('\n\n');
    logger.info(`[ColumnPromptService.buildMinimalPrompt] Result: length=${result.length}`);
    return result;
  }

  /**
   * Build AGENTS.md prompt: AGENTS.md content + minimal column prompt + user content.
   * AGENTS.md REPLACES column defaults — it IS the system prompt.
   */
  private buildAGENTSmdPrompt(column: string, userContent: string, owner: string, repo: string): string {
    logger.info(`[ColumnPromptService.buildAGENTSmdPrompt] column=${column} owner=${owner} repo=${repo}`);
    const agentsMd = this.repoPromptService!.getAGENTSmd(owner, repo);
    if (!agentsMd) {
      logger.warn('[ColumnPromptService.buildAGENTSmdPrompt] AGENTS.md read failed, falling back to full prompt');
      return this.buildFullPrompt(column, userContent);
    }
    const truncated = this.repoPromptService!.truncateForPrompt(agentsMd);
    const minimal = this.getMinimalColumnPrompt(column);
    const parts: string[] = [];
    parts.push(truncated);
    parts.push('---');
    if (minimal) {
      parts.push(minimal);
    }
    if (userContent) {
      parts.push(userContent);
    }
    const result = parts.join('\n\n');
    logger.info(`[ColumnPromptService.buildAGENTSmdPrompt] Result: length=${result.length}`);
    return result;
  }

  /**
   * Build full prompt: system + developer + user content.
   * Used when no context file exists.
   */
  private buildFullPrompt(column: string, userContent: string): string {
    logger.info(`[ColumnPromptService.buildFullPrompt] column=${column}`);
    const system = this.getSystemPrompt(column);
    const developer = this.getDeveloperPrompt(column);
    const parts: string[] = [];
    if (system) {
      parts.push(system);
    }
    if (developer) {
      parts.push(developer);
    }
    if (userContent) {
      parts.push(userContent);
    }
    const result = parts.join('\n\n');
    logger.info(`[ColumnPromptService.buildFullPrompt] Result: length=${result.length}`);
    return result;
  }

  /**
   * Save a prompt override to Memento.
   * Empty string clears the override (restores default on next read).
   */
  public savePrompt(column: string, type: 'system' | 'developer', value: string): void {
    logger.info(`[ColumnPromptService.savePrompt] column=${column} type=${type} valueLength=${value.length}`);
    if (!this.validateColumn(column)) {
      logger.warn(`[ColumnPromptService.savePrompt] Skipping save for unknown column: ${column}`);
      return;
    }
    const key = mementoKey(column, type);
    try {
      if (value === '') {
        this.memento.update(key, undefined);
        logger.info(`[ColumnPromptService.savePrompt] Result: cleared override for ${key}`);
      } else {
        this.memento.update(key, value);
        logger.info(`[ColumnPromptService.savePrompt] Result: saved override to ${key}`);
      }
    } catch (error) {
      logger.error(`[ColumnPromptService.savePrompt] Error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Reset a prompt by clearing the Memento override.
   * Next read will return the default prompt.
   */
  public resetPrompt(column: string, type: 'system' | 'developer'): void {
    logger.info(`[ColumnPromptService.resetPrompt] column=${column} type=${type}`);
    if (!this.validateColumn(column)) {
      logger.warn(`[ColumnPromptService.resetPrompt] Skipping reset for unknown column: ${column}`);
      return;
    }
    const key = mementoKey(column, type);
    try {
      this.memento.update(key, undefined);
      logger.info(`[ColumnPromptService.resetPrompt] Result: cleared override for ${key}`);
    } catch (error) {
      logger.error(`[ColumnPromptService.resetPrompt] Error: ${(error as Error).message}`);
      throw error;
    }
  }
}

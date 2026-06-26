/**
 * RepoPromptService — reads CLAUDE.md and AGENTS.md from cloned repos.
 * Provides existence checks, content reading with caching, and template generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RepoManager } from './repoManager';
import { logger } from './logger';

/** Cache entry for file content with staleness tracking */
interface CacheEntry {
  content: string;
  mtimeMs: number;
}

/** Default CLAUDE.md template content */
const CLAUDE_MD_TEMPLATE = `# Project

<!-- Describe what this project does and its purpose -->

## Tech Stack

<!-- List the technologies, frameworks, and languages used -->

## Coding Conventions

<!-- Document coding standards, naming conventions, and style guidelines -->

## Commands

<!-- List common development commands (build, test, lint, etc.) -->
`;

/** Maximum characters for AGENTS.md injection into prompts */
const MAX_AGENTS_MD_CHARS = 4000;

/**
 * RepoPromptService — thin file reader for CLAUDE.md and AGENTS.md.
 * Handles existence checks, content caching, and template generation.
 */
export class RepoPromptService {
  private repoManager: RepoManager;
  private claudeMdCache = new Map<string, CacheEntry>();
  private agentsMdCache = new Map<string, CacheEntry>();

  /**
   * Create a RepoPromptService instance.
   * @param repoManager - RepoManager for resolving repo paths
   */
  public constructor(repoManager: RepoManager) {
    logger.info('[RepoPromptService.constructor] Initializing RepoPromptService');
    this.repoManager = repoManager;
    logger.info('[RepoPromptService.constructor] Result: initialized');
  }

  /**
   * Get the cache key for a repo.
   */
  private getCacheKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }

  /**
   * Get the file path for a context file in a repo.
   */
  private getFilePath(owner: string, repo: string, filename: string): string {
    const repoPath = this.repoManager.getRepoPath(owner, repo);
    return path.join(repoPath, filename);
  }


  /**
   * Check if a file exists and has non-whitespace content.
   */
  private fileHasContent(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.trim().length > 0;
    } catch (error) {
      logger.error(`[RepoPromptService.fileHasContent] Error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Check if a cloned repo contains a specific markdown file with non-whitespace content.
   */
  private hasContextFile(owner: string, repo: string, filename: string): boolean {
    try {
      if (!this.repoManager.isRepoCloned(owner, repo)) {
        return false;
      }
      return this.fileHasContent(this.getFilePath(owner, repo, filename));
    } catch (error) {
      logger.error(`[RepoPromptService.hasContextFile] ${filename}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Check if a cloned repo contains a CLAUDE.md file with non-whitespace content.
   */
  public hasCLAUDEmd(owner: string, repo: string): boolean {
    logger.info(`[RepoPromptService.hasCLAUDEmd] owner=${owner} repo=${repo}`);
    const result = this.hasContextFile(owner, repo, 'CLAUDE.md');
    logger.info(`[RepoPromptService.hasCLAUDEmd] Result: ${result}`);
    return result;
  }

  /**
   * Check if a cloned repo contains an AGENTS.md file with non-whitespace content.
   */
  public hasAGENTSmd(owner: string, repo: string): boolean {
    logger.info(`[RepoPromptService.hasAGENTSmd] owner=${owner} repo=${repo}`);
    const result = this.hasContextFile(owner, repo, 'AGENTS.md');
    logger.info(`[RepoPromptService.hasAGENTSmd] Result: ${result}`);
    return result;
  }

  /**
   * Read and return CLAUDE.md content with in-memory caching.
   * Returns null if file doesn't exist, is empty, or cannot be read.
   */
  public getCLAUDEmd(owner: string, repo: string): string | null {
    logger.info(`[RepoPromptService.getCLAUDEmd] owner=${owner} repo=${repo}`);
    try {
      if (!this.repoManager.isRepoCloned(owner, repo)) {
        logger.info('[RepoPromptService.getCLAUDEmd] Result: null (not cloned)');
        return null;
      }
      const filePath = this.getFilePath(owner, repo, 'CLAUDE.md');
      const cacheKey = this.getCacheKey(owner, repo);

      const cached = this.claudeMdCache.get(cacheKey);
      if (cached) {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs === cached.mtimeMs) {
          logger.info(`[RepoPromptService.getCLAUDEmd] Result: cache hit length=${cached.content.length}`);
          return cached.content;
        }
      }

      // Read file
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim().length === 0) {
        logger.info('[RepoPromptService.getCLAUDEmd] Result: null (empty)');
        return null;
      }

      const stat = fs.statSync(filePath);
      this.claudeMdCache.set(cacheKey, { content, mtimeMs: stat.mtimeMs });
      logger.info(`[RepoPromptService.getCLAUDEmd] Result: length=${content.length}`);
      return content;
    } catch (error) {
      logger.error(`[RepoPromptService.getCLAUDEmd] Error: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Read and return AGENTS.md content with in-memory caching.
   * Returns null if file doesn't exist, is empty, or cannot be read.
   * Content is truncated to MAX_AGENTS_MD_CHARS for prompt injection.
   */
  public getAGENTSmd(owner: string, repo: string): string | null {
    logger.info(`[RepoPromptService.getAGENTSmd] owner=${owner} repo=${repo}`);
    try {
      if (!this.repoManager.isRepoCloned(owner, repo)) {
        logger.info('[RepoPromptService.getAGENTSmd] Result: null (not cloned)');
        return null;
      }
      const filePath = this.getFilePath(owner, repo, 'AGENTS.md');
      const cacheKey = this.getCacheKey(owner, repo);

      const cached = this.agentsMdCache.get(cacheKey);
      if (cached) {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs === cached.mtimeMs) {
          logger.info(`[RepoPromptService.getAGENTSmd] Result: cache hit length=${cached.content.length}`);
          return cached.content;
        }
      }

      // Read file
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim().length === 0) {
        logger.info('[RepoPromptService.getAGENTSmd] Result: null (empty)');
        return null;
      }

      const stat = fs.statSync(filePath);
      this.agentsMdCache.set(cacheKey, { content, mtimeMs: stat.mtimeMs });
      logger.info(`[RepoPromptService.getAGENTSmd] Result: length=${content.length}`);
      return content;
    } catch (error) {
      logger.error(`[RepoPromptService.getAGENTSmd] Error: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Truncate AGENTS.md content for prompt injection.
   */
  public truncateForPrompt(content: string): string {
    logger.info(`[RepoPromptService.truncateForPrompt] originalLength=${content.length}`);
    if (content.length <= MAX_AGENTS_MD_CHARS) {
      logger.info('[RepoPromptService.truncateForPrompt] Result: no truncation needed');
      return content;
    }
    const truncated = content.substring(0, MAX_AGENTS_MD_CHARS) + '\n\n[truncated]';
    logger.info(`[RepoPromptService.truncateForPrompt] Result: truncated to ${truncated.length}`);
    return truncated;
  }

  /**
   * Create a CLAUDE.md template file for a cloned repo.
   * Returns false if file already exists or repo is not cloned.
   */
  public createCLAUDEmdTemplate(owner: string, repo: string): boolean {
    logger.info(`[RepoPromptService.createCLAUDEmdTemplate] owner=${owner} repo=${repo}`);
    try {
      if (!this.repoManager.isRepoCloned(owner, repo)) {
        logger.warn('[RepoPromptService.createCLAUDEmdTemplate] Repo not cloned');
        return false;
      }
      const filePath = this.getFilePath(owner, repo, 'CLAUDE.md');
      if (fs.existsSync(filePath)) {
        logger.info('[RepoPromptService.createCLAUDEmdTemplate] Result: false (already exists)');
        return false;
      }
      fs.writeFileSync(filePath, CLAUDE_MD_TEMPLATE, 'utf-8');
      // Invalidate cache
      const cacheKey = this.getCacheKey(owner, repo);
      this.claudeMdCache.delete(cacheKey);
      logger.info(`[RepoPromptService.createCLAUDEmdTemplate] Result: true (created at ${filePath})`);
      return true;
    } catch (error) {
      logger.error(`[RepoPromptService.createCLAUDEmdTemplate] Error: ${(error as Error).message}`);
      return false;
    }
  }
}

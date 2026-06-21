/** RepoManager type definitions */

/** Result of a git operation */
export interface GitResult {
  success: boolean;
  error?: string;
}

/** Result of worktree creation */
export interface WorktreeResult extends GitResult {
  path?: string;
}

/** Repo identifier */
export interface RepoRef {
  owner: string;
  repo: string;
}

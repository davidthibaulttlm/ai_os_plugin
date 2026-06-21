/** ClaudeHarness type definitions */

import { ChildProcess } from 'child_process';

/** Active agent session tracking */
export interface AgentSession {
  key: string;
  issueNumber: number;
  owner: string;
  repo: string;
  worktreePath: string;
  process: ChildProcess;
  status: 'running' | 'success' | 'failed';
  outputBuffer: string[];
  outputBufferLength: number;
  startTime: number;
  timeoutId?: ReturnType<typeof setTimeout>;
  reason?: string;
}

/** Result returned after an agent run completes */
export interface AgentResult {
  success: boolean;
  issueNumber: number;
  reason: string;
  prUrl?: string;
  error?: string;
}

/** Known error reasons for agent runs */
export type AgentError =
  | 'ALREADY_RUNNING'
  | 'WORKTREE_FAILED'
  | 'SPAWN_FAILED'
  | 'TIMEOUT'
  | 'MAX_TURNS_REACHED'
  | 'COMMIT_FAILED'
  | 'PUSH_FAILED'
  | 'CONCURRENT_LIMIT_REACHED';

/** Context passed to the harness for a single issue */
export interface IssueContext {
  issueNumber: number;
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  column: string;
}

/** Minimal interface for posting messages to a webview */
export interface WebviewPoster {
  postMessage(message: unknown): Thenable<boolean | undefined>;
}

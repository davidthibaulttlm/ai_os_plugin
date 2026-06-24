import { create } from 'zustand';
import { getVsCodeApi } from '../vscodeApi';
import { logger } from '../logger';

/** HTML-escape a string to prevent XSS */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}


/** Kanban column definition */
export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
}

// Webview-local copy of IssueItem (mirrors src/types/ipc.ts for webview isolation)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type IssueItem = {
  id: string;
  type: 'ISSUE' | 'PULL_REQUEST';
  title: string;
  number: number;
  status: string;
  url: string;
  repo: string;
  priority?: string;
  labels?: string[];
  assignees?: { login: string; avatarUrl: string }[];
}

/** Board state shape */
interface BoardState {
  columns: KanbanColumn[];
  items: IssueItem[];
  loading: boolean;
  error: string | null;
  selectedItemId: string | null;
  workingIssues: Set<number>;
  // Agent output state
  agentOutputs: Map<number, string[]>;
  agentStatuses: Map<number, 'running' | 'success' | 'failed'>;
  setBoardData: (columns: KanbanColumn[], items: IssueItem[]) => void;
  updateItem: (id: string, updates: Partial<IssueItem>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedItem: (id: string | null) => void;
  setWorkingIssue: (issueNumber: number, active: boolean) => void;
  optimisticMove: (itemId: string, newStatus: string) => void;
  revertMove: (itemId: string, originalStatus: string) => void;
  reorderItems: (items: IssueItem[]) => void;
  // Agent output actions
  addAgentOutput: (issueNumber: number, line: string) => void;
  setAgentStatus: (issueNumber: number, status: 'running' | 'success' | 'failed', reason?: string) => void;
  replayAgentOutputs: (outputs: Map<number, string[]>) => void;
}

/**
 * Persist board state to VS Code's acquireVsCodeApi().setState()
 * Returns an unsubscribe function to clean up the subscription.
 */
export function persistBoardState(): () => void {
  const api = getVsCodeApi();
  if (!api) {
    // No VS Code API available (e.g. Storybook/dev mode) — return no-op unsubscribe
    return function noOpUnsubscribe() {
      // Nothing to clean up when VS Code API is unavailable
      void 0;
    };
  }

  // Restore saved state on mount
  const saved = api.getState() as { columns?: KanbanColumn[]; items?: IssueItem[] } | null;
  if (saved) {
    useBoardStore.setState((state) => ({
      ...state,
      ...(saved.columns ? { columns: saved.columns } : {}),
      ...(saved.items ? { items: saved.items } : {}),
    }));
  }

  // Subscribe to changes and persist
  const unsubscribe = useBoardStore.subscribe((state) => {
    api.setState({
      columns: state.columns,
      items: state.items,
    });
  });

  return unsubscribe;
}

/** Zustand store for board state */
export const useBoardStore = create<BoardState>()((set) => ({
  columns: [],
  items: [],
  loading: false,
  error: null,
  selectedItemId: null,
  workingIssues: new Set(),
  agentOutputs: new Map(),
  agentStatuses: new Map(),

  setBoardData: (columns: KanbanColumn[], items: IssueItem[]) =>
    set({ columns, items, loading: false, error: null }),

  updateItem: (id: string, updates: Partial<IssueItem>) =>
    set((state: BoardState) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  setLoading: (loading: boolean) => set({ loading }),

  setError: (error: string | null) => set({ error }),

  setSelectedItem: (id: string | null) => set({ selectedItemId: id }),

  setWorkingIssue: (issueNumber: number, active: boolean) =>
    set((state) => {
      const next = new Set(state.workingIssues);
      if (active) {
        next.add(issueNumber);
      } else {
        next.delete(issueNumber);
      }
      return { workingIssues: next };
    }),

  /** Optimistically move an item to a new column */
  optimisticMove: (itemId: string, newStatus: string) =>
    set((state: BoardState) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, status: newStatus } : item
      ),
    })),

  /** Revert an optimistic move on error */
  revertMove: (itemId: string, originalStatus: string) =>
    set((state: BoardState) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, status: originalStatus } : item
      ),
    })),

  /** Replace the items array with a new ordering */
  reorderItems: (items: IssueItem[]) => set({ items }),

  // Agent output actions
  addAgentOutput: (issueNumber: number, line: string) => {
    logger.debug(`[useBoardStore.addAgentOutput] issueNumber=${issueNumber}`);
    set((state) => {
      const outputs = new Map(state.agentOutputs);
      const existing = outputs.get(issueNumber) ?? [];
      existing.push(escapeHtml(line));
      outputs.set(issueNumber, existing);
      return { agentOutputs: outputs };
    });
  },

  setAgentStatus: (issueNumber: number, status: 'running' | 'success' | 'failed', reason?: string) => {
    logger.info(`[useBoardStore.setAgentStatus] issueNumber=${issueNumber} status=${status} reason=${reason}`);
    set((state) => {
      const statuses = new Map(state.agentStatuses);
      statuses.set(issueNumber, status);
      return { agentStatuses: statuses };
    });
  },

  replayAgentOutputs: (outputs: Map<number, string[]>) => {
    logger.info(`[useBoardStore.replayAgentOutputs] Replaying ${outputs.size} issue outputs`);
    set({ agentOutputs: outputs });
  },
}));

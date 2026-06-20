import { create } from 'zustand';
import { getVsCodeApi } from '../vscodeApi';

/** Kanban column definition */
export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
}

/** Issue/PR item on the board */
export interface IssueItem {
  id: string;
  type: 'ISSUE' | 'PULL_REQUEST';
  title: string;
  number: number;
  status: string;
  url: string;
  repo: string;
  priority?: string;
  labels?: string[];
}

/** Board state shape */
interface BoardState {
  columns: KanbanColumn[];
  items: IssueItem[];
  loading: boolean;
  error: string | null;
  selectedItemId: string | null;
  setBoardData: (columns: KanbanColumn[], items: IssueItem[]) => void;
  updateItem: (id: string, updates: Partial<IssueItem>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedItem: (id: string | null) => void;
  optimisticMove: (itemId: string, newStatus: string) => void;
  revertMove: (itemId: string, originalStatus: string) => void;
}

/**
 * Persist board state to VS Code's acquireVsCodeApi().setState()
 * Returns an unsubscribe function to clean up the subscription.
 */
export function persistBoardState(): () => void {
  const api = getVsCodeApi();
  if (!api) {
    return () => {};
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
}));

import { useEffect } from 'react';
import { useVsCode, onMessage, offMessage } from './hooks/useVsCode';
import { useBoardStore, persistBoardState } from './store/boardStore';
import type { KanbanColumn, IssueItem } from './store/boardStore';
import KanbanBoard from './components/KanbanBoard';
import Header from './components/Header';

export default function App() {
  // Persist board state to VS Code's acquireVsCodeApi().setState()
  useEffect(() => {
    const unsubscribe = persistBoardState();
    return () => unsubscribe();
  }, []);

  const { postMessage } = useVsCode();
  const { setBoardData, setLoading, setError, optimisticMove, revertMove } = useBoardStore();

  useEffect(() => {
    // Register message handlers
    onMessage<{ columns: KanbanColumn[]; items: IssueItem[] }>('boardData', (data) => {
      setBoardData(data.columns, data.items);
      setLoading(false);
    });

    onMessage<{ id: string; status: string }>('itemMoved', () => {
      // Server confirmed the move - state is already updated optimistically
      setBoardData(
        useBoardStore.getState().columns,
        useBoardStore.getState().items
      );
    });

    onMessage<{ message: string }>('error', (data) => {
      setError(data.message);
      setLoading(false);
    });

    // Set loading — the extension will send boardData when ready
    setLoading(true);

    return () => {
      // Cleanup: remove message handlers to prevent duplicates on remount
      offMessage('boardData');
      offMessage('itemMoved');
      offMessage('error');
    };
  }, [postMessage, setBoardData, setLoading, setError]);

  const handleMoveItem = (itemId: string, columnId: string) => {
    const item = useBoardStore.getState().items.find((i) => i.id === itemId);
    if (!item) {
      return;
    }

    const originalStatus = item.status;

    // Optimistic update
    optimisticMove(itemId, columnId);

    // Send to extension host
    postMessage('moveItem', { itemId, columnId });

    // Listen for error to revert — with timeout to prevent memory leak
    const revertHandler = (event: MessageEvent) => {
      const message = event.data as { type: string; data?: { message?: string } };
      if (message?.type === 'error') {
        revertMove(itemId, originalStatus);
      }
      // Always clean up after processing any message
      window.removeEventListener('message', revertHandler);
    };
    window.addEventListener('message', revertHandler);

    // Auto-remove listener after 5s to prevent memory leak if no response
    setTimeout(() => {
      window.removeEventListener('message', revertHandler);
    }, 5000);
  };

  const handleRefresh = () => {
    postMessage('refresh');
  };

  return (
    <div className="h-screen flex flex-col">
      <Header onRefresh={handleRefresh} />
      <KanbanBoard onMoveItem={handleMoveItem} />
    </div>
  );
}

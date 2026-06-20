import { useEffect, useState } from 'react';
import { useVsCode, onMessage, offMessage } from './hooks/useVsCode';
import { useBoardStore, persistBoardState } from './store/boardStore';
import type { KanbanColumn, IssueItem } from './store/boardStore';
import KanbanBoard from './components/KanbanBoard';
import Header from './components/Header';

export default function App() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success' | null>(null);

  // Persist board state to VS Code's acquireVsCodeApi().setState()
  useEffect(() => {
    const unsubscribe = persistBoardState();
    return () => unsubscribe();
  }, []);

  const { postMessage } = useVsCode();
  const { setBoardData, setLoading, setError, optimisticMove, revertMove } = useBoardStore();

  // Auto-clear status messages after 5 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
        setStatusType(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

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

  const handleMoveItem = (itemId: string, columnId: string, columnName: string) => {
    const item = useBoardStore.getState().items.find((i) => i.id === itemId);
    if (!item) {
      setStatusMessage(`ERROR: Item ${itemId} not found in store`);
      setStatusType('error');
      console.error('[AI OS Webview] Item not found in store', { itemId, availableIds: useBoardStore.getState().items.map(i => i.id) });
      return;
    }

    const originalStatus = item.status;
    console.log('[AI OS Webview] handleMoveItem', { itemId, columnId, columnName, from: originalStatus, to: columnName });

    // Optimistic update - use column name for status (matching how items are filtered in KanbanBoard)
    optimisticMove(itemId, columnName);

    // Send to extension host with column ID (GitHub option ID for GraphQL mutation)
    setStatusMessage(`Moving item #${item.number} to ${columnName}...`);
    setStatusType('info');
    console.log('[AI OS Webview] Sending moveItem to extension host', { itemId, columnId });
    postMessage('moveItem', { itemId, columnId });

    // Listen for response to revert on error
    const responseHandler = (event: MessageEvent) => {
      const message = event.data as { type: string; data?: { message?: string; id?: string; status?: string } };
      if (message?.type === 'error') {
        console.error('[AI OS Webview] Move failed', { error: message.data?.message });
        revertMove(itemId, originalStatus);
        setStatusMessage(`MOVE FAILED: ${message.data?.message ?? 'Unknown error'}`);
        setStatusType('error');
      } else if (message?.type === 'itemMoved') {
        console.log('[AI OS Webview] Move confirmed by server', { data: message.data });
        setStatusMessage(`Moved item #${item.number} to ${columnName}`);
        setStatusType('success');
      }
      window.removeEventListener('message', responseHandler);
    };
    window.addEventListener('message', responseHandler);

    // Auto-remove listener after 5s to prevent memory leak if no response
    setTimeout(() => {
      window.removeEventListener('message', responseHandler);
    }, 5000);
  };

  const handleRefresh = () => {
    postMessage('refresh');
  };

  return (
    <div className="h-screen flex flex-col">
      <Header onRefresh={handleRefresh} />
      {statusMessage && (
        <div className={`px-4 py-2 text-sm font-medium text-center ${
          statusType === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
          statusType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        }`}>
          {statusMessage}
        </div>
      )}
      <KanbanBoard onMoveItem={handleMoveItem} />
    </div>
  );
}
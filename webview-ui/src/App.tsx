import { useEffect, useState } from 'react';
import { useVsCode, onMessage, offMessage } from './hooks/useVsCode';
import { useBoardStore, persistBoardState } from './store/boardStore';
import type { KanbanColumn, IssueItem } from './store/boardStore';
import KanbanBoard from './components/KanbanBoard';

/** Replace items for a given status column in-place, using an iterator over the new order */
function replaceColumnItems(currentItems: IssueItem[], columnStatus: string, newColumnItems: IssueItem[]): IssueItem[] {
  let idx = 0;
  return currentItems.map((item) => {
    if (item.status === columnStatus) {
      return newColumnItems[idx++];
    }
    return item;
  });
}

export default function App() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success' | null>(null);

  // Persist board state to VS Code's acquireVsCodeApi().setState()
  useEffect(() => {
    const unsubscribe = persistBoardState();
    return () => unsubscribe();
  }, []);

  const { postMessage } = useVsCode();
  const { setBoardData, setLoading, setError, optimisticMove, revertMove, reorderItems, setWorkingIssue } = useBoardStore();

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

    onMessage<{ itemId: string }>('itemReordered', () => {
      // Server confirmed the reorder - state is already updated optimistically
      setBoardData(
        useBoardStore.getState().columns,
        useBoardStore.getState().items
      );
    });

    onMessage<{ message: string }>('error', (data) => {
      setError(data.message);
      setLoading(false);
    });

    onMessage<{ issueNumber: number; active: boolean }>('workingStatus', (data) => {
      setWorkingIssue(data.issueNumber, data.active);
    });

    // Set loading — the extension will send boardData when ready
    setLoading(true);

    return () => {
      // Cleanup: remove message handlers to prevent duplicates on remount
      offMessage('boardData');
      offMessage('itemMoved');
      offMessage('itemReordered');
      offMessage('error');
      offMessage('workingStatus');
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

  const handleReorderItem = (itemId: string, afterId: string | null) => {
    const currentItems = useBoardStore.getState().items;
    const activeItem = currentItems.find((i) => i.id === itemId);

    if (!activeItem) {
      console.error('[AI OS Webview] Reorder: active item not found', { itemId });
      return;
    }

    // Get the column (status) for the active item — reorder ONLY within this column
    const columnStatus = activeItem.status;
    const columnItems = currentItems.filter((i) => i.status === columnStatus);

    const activeColIndex = columnItems.findIndex((i) => i.id === itemId);

    if (activeColIndex === -1) {
      console.error('[AI OS Webview] Reorder: active item not found in column', { itemId, columnStatus });
      return;
    }

    // afterId === null means move to top of column (afterIndex = -1)
    const afterColIndex = afterId ? columnItems.findIndex((i) => i.id === afterId) : -1;

    if (afterId && afterColIndex === -1) {
      console.error('[AI OS Webview] Reorder: target item not found in column', { afterId, columnStatus });
      return;
    }

    // Build new column order: remove active item, insert it after the target item
    const newColumnItems = [...columnItems];
    const [removed] = newColumnItems.splice(activeColIndex, 1);
    // After splicing, adjust afterColIndex if needed
    const adjustedAfterIndex = activeColIndex < afterColIndex ? afterColIndex - 1 : afterColIndex;
    newColumnItems.splice(adjustedAfterIndex + 1, 0, removed);

    console.log('[AI OS Webview] handleReorderItem', { itemId, afterId, columnStatus, activeColIndex, afterColIndex });

    // Rebuild the full items array: replace items in this column with the new order,
    // keeping items from other columns in their original positions
    const newItems = replaceColumnItems(currentItems, columnStatus, newColumnItems);

    // Optimistic update
    reorderItems(newItems);

    // Send to extension host
    setStatusMessage(`Reordering item...`);
    setStatusType('info');
    postMessage('reorderItem', { itemId, afterId });

    // Listen for response to revert on error
    const originalItems = [...currentItems];
    const responseHandler = (event: MessageEvent) => {
      const message = event.data as { type: string; data?: { message?: string; itemId?: string } };
      console.log('[AI OS Webview] Reorder responseHandler received', { messageType: message?.type, fullMessage: message });
      if (message?.type === 'error') {
        console.error('[AI OS Webview] Reorder FAILED — reverting', { error: message.data?.message });
        reorderItems(originalItems);
        setStatusMessage(`REORDER FAILED: ${message.data?.message ?? 'Unknown error'}`);
        setStatusType('error');
      } else if (message?.type === 'itemReordered') {
        console.log('[AI OS Webview] Reorder confirmed by server');
        setStatusMessage('Item reordered');
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

  return (
    <div className="h-screen flex flex-col bg-vscode-panel-background">
      {statusMessage && (
        <div className={`px-4 py-2 text-sm font-medium text-center ${
          statusType === 'error' ? 'bg-vscode-diffEditor-removedLineBackground text-vscode-diffEditor-removedTextBackground' :
          statusType === 'success' ? 'bg-vscode-diffEditor-insertedLineBackground text-vscode-diffEditor-insertedTextBackground' :
          'bg-vscode-list-hoverBackground text-vscode-list-foreground'
        }`}>
          {statusMessage}
        </div>
      )}
      <KanbanBoard onMoveItem={handleMoveItem} onReorderItem={handleReorderItem} />
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useVsCode, onMessage, offMessage } from './hooks/useVsCode';
import { useBoardStore, persistBoardState, type KanbanColumn, type IssueItem } from "./store/boardStore";
import KanbanBoard from './components/KanbanBoard';
import { logger } from './logger';

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
    logger.info(`[App.handleMoveItem] Starting move: itemId=${itemId}, columnId=${columnId}, columnName=${columnName}`);
    const item = useBoardStore.getState().items.find((i) => i.id === itemId);
    if (!item) {
      logger.error(`[App.handleMoveItem] Item ${itemId} not found in store`);
      setStatusMessage(`ERROR: Item ${itemId} not found in store`);
      setStatusType('error');
      return;
    }

    const originalStatus = item.status;
    logger.info(`[App.handleMoveItem] Moving #${item.number} from ${originalStatus} to ${columnName}`);

    // Optimistic update - use column name for status (matching how items are filtered in KanbanBoard)
    optimisticMove(itemId, columnName);

    // Send to extension host with column ID (GitHub option ID for GraphQL mutation)
    setStatusMessage(`Moving item #${item.number} to ${columnName}...`);
    setStatusType('info');
    postMessage('moveItem', { itemId, columnId });

    // Use one-time onMessage handlers with timeout cleanup instead of raw window.addEventListener
    const moveErrorHandler = (data: { message?: string }) => {
      logger.error(`[App.handleMoveItem] Move failed: ${data.message ?? 'Unknown error'}`);
      revertMove(itemId, originalStatus);
      setStatusMessage(`MOVE FAILED: ${data.message ?? 'Server rejected the move'}`);
      setStatusType('error');
    };
    const moveSuccessHandler = () => {
      logger.info(`[App.handleMoveItem] Move confirmed for #${item.number} to ${columnName}`);
      setStatusMessage(`Moved item #${item.number} to ${columnName}`);
      setStatusType('success');
    };

    onMessage<{ message?: string }>('error', moveErrorHandler);
    onMessage<{ id?: string; status?: string }>('itemMoved', moveSuccessHandler);

    // Auto-remove handlers after 5s to prevent stale callbacks
    setTimeout(() => {
      offMessage('error');
      offMessage('itemMoved');
    }, 5000);
  };

  const handleReorderItem = (itemId: string, afterId: string | null) => {
    logger.info(`[App.handleReorderItem] Starting reorder: itemId=${itemId}, afterId=${afterId}`);
    const currentItems = useBoardStore.getState().items;
    const activeItem = currentItems.find((i) => i.id === itemId);

    if (!activeItem) {
      logger.error(`[App.handleReorderItem] Active item ${itemId} not found`);
      return;
    }

    // Get the column (status) for the active item — reorder ONLY within this column
    const columnStatus = activeItem.status;
    const columnItems = currentItems.filter((i) => i.status === columnStatus);

    const activeColIndex = columnItems.findIndex((i) => i.id === itemId);

    if (activeColIndex === -1) {
      logger.error(`[App.handleReorderItem] Active item ${itemId} not found in column ${columnStatus}`);
      return;
    }

    // afterId === null means move to top of column (afterIndex = -1)
    const afterColIndex = afterId ? columnItems.findIndex((i) => i.id === afterId) : -1;

    if (afterId && afterColIndex === -1) {
      logger.error(`[App.handleReorderItem] Target item ${afterId} not found in column ${columnStatus}`);
      return;
    }

    // Build new column order: remove active item, insert it after the target item
    const newColumnItems = [...columnItems];
    const [removed] = newColumnItems.splice(activeColIndex, 1);
    // After splicing, adjust afterColIndex if needed
    const adjustedAfterIndex = activeColIndex < afterColIndex ? afterColIndex - 1 : afterColIndex;
    newColumnItems.splice(adjustedAfterIndex + 1, 0, removed);

    logger.info(`[App.handleReorderItem] Reordering in ${columnStatus}: activeIndex=${activeColIndex}, afterIndex=${afterColIndex}`);

    // Rebuild the full items array: replace items in this column with the new order,
    // keeping items from other columns in their original positions
    const newItems = replaceColumnItems(currentItems, columnStatus, newColumnItems);

    // Optimistic update
    reorderItems(newItems);

    // Send to extension host
    setStatusMessage(`Reordering item...`);
    setStatusType('info');
    postMessage('reorderItem', { itemId, afterId });

    // Use one-time onMessage handlers with timeout cleanup instead of raw window.addEventListener
    const originalItems = [...currentItems];
    const reorderErrorHandler = (data: { message?: string }) => {
      logger.error(`[App.handleReorderItem] Reorder failed: ${data.message ?? 'Unknown error'}`);
      reorderItems(originalItems);
      setStatusMessage(`REORDER FAILED: ${data.message ?? 'Server rejected the reorder'}`);
      setStatusType('error');
    };
    const reorderSuccessHandler = () => {
      logger.info(`[App.handleReorderItem] Reorder confirmed for ${itemId}`);
      setStatusMessage('Item reordered');
      setStatusType('success');
    };

    onMessage<{ message?: string }>('error', reorderErrorHandler);
    onMessage<{ itemId?: string }>('itemReordered', reorderSuccessHandler);

    // Auto-remove handlers after 5s to prevent stale callbacks
    setTimeout(() => {
      offMessage('error');
      offMessage('itemReordered');
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
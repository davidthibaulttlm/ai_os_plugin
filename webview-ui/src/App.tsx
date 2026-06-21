import { useEffect, useState, useCallback } from 'react';
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
  const [columnPromptData, setColumnPromptData] = useState<{ column: string; system: string; developer: string; systemDefault: string; developerDefault: string } | null>(null);

  // Persist board state to VS Code's acquireVsCodeApi().setState()
  useEffect(() => {
    const unsubscribe = persistBoardState();
    return () => unsubscribe();
  }, []);

  const { postMessage } = useVsCode();
  const { setBoardData, setLoading, setError, optimisticMove, revertMove, reorderItems, setWorkingIssue, addAgentOutput, setAgentStatus } = useBoardStore();

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

    onMessage<{ issueNumber: number; line: string; timestamp: number }>('agentOutput', (data) => {
      addAgentOutput(data.issueNumber, data.line);
    });

    onMessage<{ issueNumber: number; status: 'running' | 'success' | 'failed'; reason?: string }>('agentStatus', (data) => {
      setAgentStatus(data.issueNumber, data.status, data.reason);
    });

    onMessage<{ column: string; system: string; developer: string; systemDefault: string; developerDefault: string }>('columnPrompts', (data) => {
      logger.info(`[App.useEffect] columnPrompts received for ${data.column}`);
      setColumnPromptData(data);
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
      offMessage('agentOutput');
      offMessage('agentStatus');
      offMessage('columnPrompts');
    };
  }, []);

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

    // One-time window listeners for this specific move response
    // Use raw addEventListener with { once: true } to avoid interfering with app-level registry handlers
    const moveErrorHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'error') {
        logger.error(`[App.handleMoveItem] Move failed: ${message.data?.message ?? 'Unknown error'}`);
        revertMove(itemId, originalStatus);
        setStatusMessage(`MOVE FAILED: ${message.data?.message ?? 'Server rejected the move'}`);
        setStatusType('error');
      }
    };
    const moveSuccessHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'itemMoved') {
        logger.info(`[App.handleMoveItem] Move confirmed for #${item.number} to ${columnName}`);
        setStatusMessage(`Moved item #${item.number} to ${columnName}`);
        setStatusType('success');
      }
    };

    window.addEventListener('message', moveSuccessHandler, { once: true });
    window.addEventListener('message', moveErrorHandler, { once: true });

    // Safety timeout: remove listeners if response never arrives
    setTimeout(() => {
      window.removeEventListener('message', moveSuccessHandler);
      window.removeEventListener('message', moveErrorHandler);
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

    // One-time window listeners for this specific reorder response
    const originalItems = [...currentItems];
    const reorderErrorHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'error') {
        logger.error(`[App.handleReorderItem] Reorder failed: ${message.data?.message ?? 'Unknown error'}`);
        reorderItems(originalItems);
        setStatusMessage(`REORDER FAILED: ${message.data?.message ?? 'Server rejected the reorder'}`);
        setStatusType('error');
      }
    };
    const reorderSuccessHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'itemReordered') {
        logger.info(`[App.handleReorderItem] Reorder confirmed for ${itemId}`);
        setStatusMessage('Item reordered');
        setStatusType('success');
      }
    };

    window.addEventListener('message', reorderSuccessHandler, { once: true });
    window.addEventListener('message', reorderErrorHandler, { once: true });

    // Safety timeout: remove listeners if response never arrives
    setTimeout(() => {
      window.removeEventListener('message', reorderSuccessHandler);
      window.removeEventListener('message', reorderErrorHandler);
    }, 5000);
  };

  const handleSaveColumnPrompt = useCallback((column: string, promptType: 'system' | 'developer', value: string) => {
    logger.info(`[App.handleSaveColumnPrompt] column=${column} type=${promptType}`);
    postMessage('saveColumnPrompt', { column, promptType, value });
  }, [postMessage]);

  const handleResetColumnPrompt = useCallback((column: string, promptType: 'system' | 'developer') => {
    logger.info(`[App.handleResetColumnPrompt] column=${column} type=${promptType}`);
    postMessage('resetColumnPrompt', { column, promptType });
  }, [postMessage]);

  const handleRequestColumnPrompts = useCallback((column: string) => {
    logger.info(`[App.handleRequestColumnPrompts] column=${column}`);
    postMessage('requestColumnPrompts', { column });
  }, [postMessage]);

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
      <KanbanBoard
        onMoveItem={handleMoveItem}
        onReorderItem={handleReorderItem}
        onSaveColumnPrompt={handleSaveColumnPrompt}
        onResetColumnPrompt={handleResetColumnPrompt}
        onRequestColumnPrompts={handleRequestColumnPrompts}
        columnPromptData={columnPromptData}
      />
    </div>
  );
}
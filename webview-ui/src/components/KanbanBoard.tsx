import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useBoardStore, type IssueItem } from "../store/boardStore";
import KanbanColumn from './KanbanColumn';
import IssueCard from './IssueCard';
import ColumnSettingsModal from './ColumnSettingsModal';
import { logger } from '../logger';

interface KanbanBoardProps {
  onMoveItem: (itemId: string, columnId: string, columnName: string) => void;
  onReorderItem: (itemId: string, afterId: string | null) => void;
  onSaveColumnPrompt: (column: string, promptType: 'system' | 'developer', value: string) => void;
  onResetColumnPrompt: (column: string, promptType: 'system' | 'developer') => void;
  onRequestColumnPrompts: (column: string) => void;
  columnPromptData: { column: string; system: string; developer: string; systemDefault: string; developerDefault: string } | null;
}

export default function KanbanBoard({
  onMoveItem,
  onReorderItem,
  onSaveColumnPrompt,
  onResetColumnPrompt,
  onRequestColumnPrompts,
  columnPromptData,
}: KanbanBoardProps) {
  const { columns, items, loading, error } = useBoardStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const [activeItem, setActiveItem] = useState<IssueItem | null>(null);
  const [modalColumn, setModalColumn] = useState<string | null>(null);
  const [modalSystemPrompt, setModalSystemPrompt] = useState('');
  const [modalDeveloperPrompt, setModalDeveloperPrompt] = useState('');
  const [modalSystemDefault, setModalSystemDefault] = useState('');
  const [modalDeveloperDefault, setModalDeveloperDefault] = useState('');

  // Update modal prompts when data arrives from extension host
  useEffect(() => {
    if (columnPromptData && columnPromptData.column === modalColumn) {
      logger.info(`[KanbanBoard.useEffect] Updating modal prompts for ${columnPromptData.column}`);
      setModalSystemPrompt(columnPromptData.system);
      setModalDeveloperPrompt(columnPromptData.developer);
      setModalSystemDefault(columnPromptData.systemDefault);
      setModalDeveloperDefault(columnPromptData.developerDefault);
    }
  }, [columnPromptData, modalColumn]);

  const handleOpenSettings = useCallback((columnName: string) => {
    logger.info(`[KanbanBoard.handleOpenSettings] Opening settings for column: ${columnName}`);
    setModalColumn(columnName);
    onRequestColumnPrompts(columnName);
  }, [onRequestColumnPrompts]);

  const handleCloseModal = useCallback(() => {
    logger.info(`[KanbanBoard.handleCloseModal] Closing modal for column: ${modalColumn}`);
    setModalColumn(null);
  }, [modalColumn]);

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;

    if (!over || active.id === over.id) {
      logger.debug(`[KanbanBoard.handleDragEnd] No move needed`);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    logger.info(`[KanbanBoard.handleDragEnd] Drag end: activeId=${activeId}, overId=${overId}`);

    // Check if dropped over another card
    const activeItem = items.find((i) => i.id === activeId);
    const overItem = items.find((i) => i.id === overId);

    // Check if dropped directly on a column
    let droppedColumn = columns.find((col) => col.id === overId);

    // If not a column, check if dropped over another card — find its column
    if (!droppedColumn && overItem) {
      droppedColumn = columns.find((col) => col.name === overItem.status);
    }

    if (droppedColumn && activeItem) {
      // Same-column reorder
      if (activeItem.status === droppedColumn.name) {
        let afterId: string | null;
        if (!overItem) {
          // Dropped on column itself → move to top
          afterId = null;
        } else {
          // Determine if dropped above or below the target card
          const activeRect = active.rect.current.translated;
          const overRect = over.rect;
          if (activeRect && overRect) {
            const activeCenterY = activeRect.top + activeRect.height / 2;
            const overCenterY = overRect.top + overRect.height / 2;
            // Dropped above the target card → place before (afterId = card before overItem)
            if (activeCenterY < overCenterY) {
              const columnItems = items.filter((i) => i.status === droppedColumn.name);
              const overItemIndex = columnItems.findIndex((i) => i.id === overId);
              afterId = overItemIndex > 0 ? columnItems[overItemIndex - 1].id : null;
            } else {
              // Dropped below the target card → place after
              afterId = overId;
            }
          } else {
            afterId = overId;
          }
        }
        logger.info(`[KanbanBoard.handleDragEnd] Same-column reorder: itemId=${activeId}, afterId=${afterId}, column=${droppedColumn.name}`);
        onReorderItem(activeId, afterId);
      } else {
        // Cross-column move
        logger.info(`[KanbanBoard.handleDragEnd] Cross-column move: itemId=${activeId}, from=${activeItem.status}, to=${droppedColumn.name}`);
        onMoveItem(activeId, droppedColumn.id, droppedColumn.name);
      }
    } else {
      logger.error(`[KanbanBoard.handleDragEnd] No column found for drop target: overId=${overId}`);
    }
  };

  const handleDragCancel = () => {
    setActiveItem(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-vscode-descriptionForeground">Loading board...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-vscode-errorForeground">Error: {error}</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 p-4 overflow-x-auto overflow-y-hidden h-full">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            items={items.filter((item) => item.status === column.name)}
            onOpenSettings={handleOpenSettings}
          />
        ))}
      </div>

      {modalColumn && (
        <ColumnSettingsModal
          column={modalColumn}
          onClose={handleCloseModal}
          onSavePrompt={onSaveColumnPrompt}
          onResetPrompt={onResetColumnPrompt}
          systemPrompt={modalSystemPrompt}
          developerPrompt={modalDeveloperPrompt}
          systemDefault={modalSystemDefault}
          developerDefault={modalDeveloperDefault}
        />
      )}
      <DragOverlay>
        {activeItem ? <IssueCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

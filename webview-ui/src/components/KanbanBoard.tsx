import { useState } from 'react';
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

interface KanbanBoardProps {
  onMoveItem: (itemId: string, columnId: string, columnName: string) => void;
  onReorderItem: (itemId: string, afterId: string | null) => void;
}

export default function KanbanBoard({ onMoveItem, onReorderItem }: KanbanBoardProps) {
  const { columns, items, loading, error } = useBoardStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const [activeItem, setActiveItem] = useState<IssueItem | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    console.log('[AI OS Drag] handleDragEnd START', { activeId: active.id, overId: over?.id });

    if (!over || active.id === over.id) {
      console.log('[AI OS Drag] No move needed', { reason: over ? 'same item' : 'no target' });
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over another card
    const activeItem = items.find((i) => i.id === activeId);
    const overItem = items.find((i) => i.id === overId);
    console.log('[AI OS Drag] Items resolved', {
      activeItemFound: !!activeItem,
      activeItemStatus: activeItem?.status,
      overItemFound: !!overItem,
      overItemStatus: overItem?.status,
    });

    // Check if dropped directly on a column
    let droppedColumn = columns.find((col) => col.id === overId);

    // If not a column, check if dropped over another card — find its column
    if (!droppedColumn && overItem) {
      droppedColumn = columns.find((col) => col.name === overItem.status);
    }
    console.log('[AI OS Drag] Column resolved', { columnFound: !!droppedColumn, columnName: droppedColumn?.name });

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
        console.log('[AI OS Drag] SAME-COLUMN REORDER — calling onReorderItem', {
          itemId: activeId,
          afterId,
          column: droppedColumn.name,
          droppedOnColumn: !overItem,
        });
        onReorderItem(activeId, afterId);
      } else {
        // Cross-column move
        console.log('[AI OS Drag] Cross-column move', { itemId: activeId, from: activeItem.status, to: droppedColumn.name });
        onMoveItem(activeId, droppedColumn.id, droppedColumn.name);
      }
    } else {
      console.error('[AI OS Drag] No column found for drop target', { overId, availableColumns: columns.map(c => ({ id: c.id, name: c.name })) });
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
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem ? <IssueCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

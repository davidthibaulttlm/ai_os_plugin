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
import { useBoardStore } from '../store/boardStore';
import type { IssueItem } from '../store/boardStore';
import KanbanColumn from './KanbanColumn';
import IssueCard from './IssueCard';

interface KanbanBoardProps {
  onMoveItem: (itemId: string, columnId: string, columnName: string) => void;
}

export default function KanbanBoard({ onMoveItem }: KanbanBoardProps) {
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
    console.debug('[AI OS Drag] handleDragEnd', { activeId: active.id, overId: over?.id });

    if (!over || active.id === over.id) {
      console.debug('[AI OS Drag] No move needed', { reason: over ? 'same item' : 'no target' });
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped directly on a column
    let droppedColumn = columns.find((col) => col.id === overId);
    console.debug('[AI OS Drag] Column lookup', { overId, found: droppedColumn?.name ?? null });

    // If not a column, check if dropped over another card — find its column
    if (!droppedColumn) {
      const droppedItem = items.find((item) => item.id === overId);
      if (droppedItem) {
        droppedColumn = columns.find((col) => col.name === droppedItem.status);
        console.debug('[AI OS Drag] Resolved via card', { cardId: droppedItem.id, column: droppedColumn?.name ?? null });
      }
    }

    if (droppedColumn) {
      console.log('[AI OS Drag] Triggering move', { itemId: activeId, columnId: droppedColumn.id, columnName: droppedColumn.name });
      onMoveItem(activeId, droppedColumn.id, droppedColumn.name);
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
        <div className="text-gray-500">Loading board...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Error: {error}</div>
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

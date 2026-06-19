import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { KanbanColumn, IssueItem } from '../store/boardStore';
import IssueCard from './IssueCard';

interface KanbanColumnProps {
  column: KanbanColumn;
  items: IssueItem[];
}

export default function KanbanColumn({ column, items }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[280px] h-full bg-gray-100 dark:bg-gray-800 rounded-lg p-3 transition-colors ${
        isOver ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
          {column.name.replace(/_/g, ' ')}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {items.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[100px]">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <IssueCard key={item.id} item={item} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

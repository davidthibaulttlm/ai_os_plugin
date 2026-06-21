import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { KanbanColumn as KanbanColumnType, IssueItem } from '../store/boardStore';
import IssueCard from './IssueCard';
import { logger } from '../logger';

interface KanbanColumnProps {
  column: KanbanColumnType;
  items: IssueItem[];
  onOpenSettings: (columnName: string) => void;
}

export default function KanbanColumn({ column, items, onOpenSettings }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const handleSettingsClick = () => {
    logger.info(`[KanbanColumn.handleSettingsClick] Column: ${column.name}`);
    onOpenSettings(column.name);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[280px] h-full bg-vscode-sideBar-background rounded-lg p-3 transition-colors ${
        isOver ? 'ring-2 ring-vscode-focusBorder bg-vscode-list-hoverBackground' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-vscode-sideBar-foreground">
          {column.name.replace(/_/g, ' ')} ({items.length})
        </h3>
        <button
          onClick={handleSettingsClick}
          className="text-xs text-vscode-descriptionForeground hover:text-vscode-sideBar-foreground cursor-pointer p-1 rounded transition-colors"
          title="Column settings"
        >
          ⚙️
        </button>
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

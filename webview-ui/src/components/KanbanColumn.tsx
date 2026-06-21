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
          className="text-vscode-descriptionForeground hover:text-vscode-sideBar-foreground cursor-pointer p-0.5 rounded transition-colors inline-flex items-center justify-center"
          title="Column settings"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M7.99997 6C6.89497 6 5.99997 6.895 5.99997 8C5.99997 9.105 6.89497 10 7.99997 10C9.10497 10 9.99997 9.105 9.99997 8C9.99997 6.895 9.10497 6 7.99997 6ZM7.99997 9C7.44797 9 6.99997 8.552 6.99997 8C6.99997 7.448 7.44797 7 7.99997 7C8.55197 7 8.99997 7.448 8.99997 8C8.99997 8.552 8.55197 9 7.99997 9ZM14.565 9.715L13.279 8.628C13.245 8.599 13.213 8.567 13.184 8.533C12.888 8.186 12.931 7.667 13.279 7.372L14.565 6.285C14.693 6.177 14.742 6.003 14.691 5.844C14.386 4.903 13.882 4.04 13.219 3.308C13.139 3.22 13.027 3.172 12.912 3.172C12.865 3.172 12.818 3.18 12.773 3.196L11.186 3.761C11.144 3.776 11.1 3.788 11.056 3.796C11.006 3.805 10.956 3.81 10.907 3.81C10.515 3.81 10.167 3.532 10.094 3.134L9.79097 1.482C9.76097 1.318 9.63397 1.188 9.46997 1.153C8.98997 1.051 8.49897 1 8.00097 1C7.50297 1 7.01097 1.052 6.53097 1.153C6.36697 1.188 6.23997 1.318 6.20997 1.482L5.90797 3.134C5.89997 3.178 5.88797 3.221 5.87297 3.263C5.75197 3.6 5.43397 3.81 5.09397 3.81C5.00197 3.81 4.90797 3.794 4.81597 3.762L3.22897 3.197C3.18397 3.181 3.13597 3.173 3.08997 3.173C2.97497 3.173 2.86297 3.221 2.78297 3.309C2.11897 4.041 1.61597 4.904 1.30997 5.845C1.25797 6.004 1.30797 6.178 1.43597 6.286L2.72197 7.373C2.75597 7.402 2.78797 7.434 2.81697 7.468C3.11297 7.815 3.06997 8.334 2.72197 8.629L1.43597 9.716C1.30797 9.824 1.25897 9.998 1.30997 10.157C1.61497 11.098 2.11897 11.961 2.78297 12.693C2.86297 12.781 2.97497 12.829 3.08997 12.829C3.13697 12.829 3.18397 12.821 3.22897 12.805L4.81597 12.24C4.85797 12.225 4.90197 12.213 4.94597 12.205C4.99597 12.196 5.04597 12.192 5.09497 12.192C5.48697 12.192 5.83497 12.47 5.90797 12.868L6.20997 14.52C6.23997 14.684 6.36697 14.814 6.53097 14.849C7.01097 14.951 7.50297 15.002 8.00097 15.002C8.49897 15.002 8.99097 14.95 9.46997 14.849C9.63397 14.814 9.76097 14.684 9.79097 14.52L10.094 12.868C10.102 12.824 10.114 12.781 10.129 12.739C10.25 12.402 10.568 12.192 10.96 12.192C11.009 12.192 11.059 12.196 11.109 12.205C11.153 12.213 11.197 12.225 11.239 12.24L12.826 12.805C12.871 12.821 12.919 12.829 12.966 12.829C13.081 12.829 13.193 12.781 13.273 12.693C13.937 11.961 14.44 11.098 14.745 10.157C14.797 9.998 14.748 9.824 14.62 9.715Z"/></svg>
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

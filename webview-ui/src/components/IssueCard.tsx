import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVsCode } from '../hooks/useVsCode';
import { useBoardStore } from '../store/boardStore';
import type { IssueItem } from '../store/boardStore';

interface IssueCardProps {
  item: IssueItem;
}

export default function IssueCard({ item }: IssueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { postMessage } = useVsCode();
  const workingIssues = useBoardStore((state) => state.workingIssues);
  const isWorking = workingIssues.has(item.number);

  const handleClick = () => {
    postMessage('selectIssue', { issueId: item.url });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="bg-vscode-editor-background rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-vscode-editor-border"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono text-vscode-descriptionForeground">
          #{item.number}
        </span>
        {item.type === 'PULL_REQUEST' && (
          <span className="text-xs bg-vscode-badge-background text-vscode-badge-foreground px-1.5 py-0.5 rounded">
            PR
          </span>
        )}
      </div>
      <div className="text-sm font-medium mt-1 text-vscode-editor-foreground">
        {item.title}
      </div>
      {item.repo && (
        <div className="text-xs text-vscode-descriptionForeground mt-1">
          {item.repo}
        </div>
      )}
      {item.labels && item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="text-xs bg-vscode-list-hoverBackground text-vscode-list-foreground px-1.5 py-0.5 rounded"
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {isWorking && (
        <div className="flex items-center gap-1 mt-2">
          <div className="w-2 h-2 rounded-full bg-vscode-progressBar-background animate-pulse" />
          <span className="text-xs text-vscode-descriptionForeground">Claude is working...</span>
        </div>
      )}
    </div>
  );
}

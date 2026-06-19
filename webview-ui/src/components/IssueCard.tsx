import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVsCode } from '../hooks/useVsCode';
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
      className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          #{item.number}
        </span>
        {item.type === 'PULL_REQUEST' && (
          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
            PR
          </span>
        )}
      </div>
      <div className="text-sm font-medium mt-1 text-gray-800 dark:text-gray-200">
        {item.title}
      </div>
      {item.repo && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {item.repo}
        </div>
      )}
      {item.labels && item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

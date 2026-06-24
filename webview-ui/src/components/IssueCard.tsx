import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVsCode } from '../hooks/useVsCode';
import { useBoardStore, type IssueItem } from "../store/boardStore";

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
  const agentOutputs = useBoardStore((state) => state.agentOutputs);
  const agentStatuses = useBoardStore((state) => state.agentStatuses);
  const isWorking = workingIssues.has(item.number);
  const agentStatus = agentStatuses.get(item.number);
  const outputLines = agentOutputs.get(item.number) ?? [];
  const [outputOpen, setOutputOpen] = useState(false);

  const handleClick = () => {
    postMessage('selectIssue', { issueId: item.url });
  };

  const hasAgentSession = agentStatus !== undefined;

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
        <div className="flex gap-1">
          {item.type === 'PULL_REQUEST' && (
            <span className="text-xs bg-vscode-badge-background text-vscode-badge-foreground px-1.5 py-0.5 rounded">
              PR
            </span>
          )}
          {agentStatus === 'success' && (
            <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">
              Done
            </span>
          )}
          {agentStatus === 'failed' && (
            <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">
              Failed
            </span>
          )}
        </div>
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
      {item.assignees && item.assignees.length > 0 && (
        <div className="flex items-center -space-x-2 mt-2">
          {item.assignees.slice(0, 5).map((assignee) => (
            <img
              key={assignee.login}
              src={assignee.avatarUrl}
              alt={assignee.login}
              title={assignee.login}
              onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23666%22 width=%22100%22 height=%22100%22 rx=%2250%22/><text x=%2250%22 y=%2265%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2240%22>' + encodeURIComponent(assignee.login[0]) + '</text></svg>'; }}
              className="w-6 h-6 rounded-full border border-vscode-editor-background"
            />
          ))}
        </div>
      )}
      {isWorking && (
        <div className="flex items-center gap-1 mt-2">
          <div className="w-2 h-2 rounded-full bg-vscode-progressBar-background animate-pulse" />
          <span className="text-xs text-vscode-descriptionForeground">Claude is working...</span>
        </div>
      )}
      {hasAgentSession && outputLines.length > 0 && (
        <div className="mt-2 border-t border-vscode-editor-border pt-2">
          <button
            onClick={(e) => { e.stopPropagation(); setOutputOpen(!outputOpen); }}
            className="text-xs text-vscode-textLink-foreground hover:underline"
          >
            {outputOpen ? 'Hide' : 'Show'} output ({outputLines.length} lines)
          </button>
          {outputOpen && (
            <div className="mt-1 bg-vscode-editor-inactiveSelectionBackground rounded p-2 max-h-32 overflow-auto">
              {outputLines.slice(-20).map((line, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="text-xs font-mono text-vscode-editor-foreground">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

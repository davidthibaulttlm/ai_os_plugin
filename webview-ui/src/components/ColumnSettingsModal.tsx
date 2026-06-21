import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../logger';

const AI_COLUMNS = ['AI_SPEC', 'AI_CODE'];

interface ColumnSettingsModalProps {
  column: string;
  onClose: () => void;
  onSavePrompt: (column: string, promptType: 'system' | 'developer', value: string) => void;
  onResetPrompt: (column: string, promptType: 'system' | 'developer') => void;
  systemPrompt: string;
  developerPrompt: string;
  systemDefault: string;
  developerDefault: string;
}

export default function ColumnSettingsModal({
  column,
  onClose,
  onSavePrompt,
  onResetPrompt,
  systemPrompt,
  developerPrompt,
  systemDefault,
  developerDefault,
}: ColumnSettingsModalProps) {
  const isAIColumn = AI_COLUMNS.includes(column);

  const [systemValue, setSystemValue] = useState(systemPrompt);
  const [developerValue, setDeveloperValue] = useState(developerPrompt);
  const [systemSaved, setSystemSaved] = useState(false);
  const [developerSaved, setDeveloperSaved] = useState(false);

  const systemDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const developerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when modal opens with fresh data
  useEffect(() => {
    logger.info(`[ColumnSettingsModal.useEffect] Modal opened for column: ${column}`);
    setSystemValue(systemPrompt);
    setDeveloperValue(developerPrompt);
    setSystemSaved(false);
    setDeveloperSaved(false);
  }, [column, systemPrompt, developerPrompt]);

  useEffect(() => {
    return () => {
      if (systemDebounceRef.current) clearTimeout(systemDebounceRef.current);
      if (developerDebounceRef.current) clearTimeout(developerDebounceRef.current);
    };
  }, []);

  const debouncedSaveSystem = useCallback(
    (value: string) => {
      if (systemDebounceRef.current) {
        clearTimeout(systemDebounceRef.current);
      }
      setSystemSaved(false);
      systemDebounceRef.current = setTimeout(() => {
        logger.info(`[ColumnSettingsModal.debouncedSaveSystem] Saving system prompt for ${column}`);
        onSavePrompt(column, 'system', value);
        setSystemSaved(true);
      }, 300);
    },
    [column, onSavePrompt]
  );

  const debouncedSaveDeveloper = useCallback(
    (value: string) => {
      if (developerDebounceRef.current) {
        clearTimeout(developerDebounceRef.current);
      }
      setDeveloperSaved(false);
      developerDebounceRef.current = setTimeout(() => {
        logger.info(`[ColumnSettingsModal.debouncedSaveDeveloper] Saving developer prompt for ${column}`);
        onSavePrompt(column, 'developer', value);
        setDeveloperSaved(true);
      }, 300);
    },
    [column, onSavePrompt]
  );

  const handleSystemChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSystemValue(value);
    debouncedSaveSystem(value);
  };

  const handleDeveloperChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDeveloperValue(value);
    debouncedSaveDeveloper(value);
  };

  const handleResetSystem = () => {
    logger.info(`[ColumnSettingsModal.handleResetSystem] Resetting system prompt for ${column}`);
    onResetPrompt(column, 'system');
    setSystemValue(systemDefault);
    setSystemSaved(true);
  };

  const handleResetDeveloper = () => {
    logger.info(`[ColumnSettingsModal.handleResetDeveloper] Resetting developer prompt for ${column}`);
    onResetPrompt(column, 'developer');
    setDeveloperValue(developerDefault);
    setDeveloperSaved(true);
  };

  const handleClose = () => {
    logger.info(`[ColumnSettingsModal.handleClose] Closing modal for ${column}`);
    if (systemDebounceRef.current) clearTimeout(systemDebounceRef.current);
    if (developerDebounceRef.current) clearTimeout(developerDebounceRef.current);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-vscode-editor-background text-vscode-sideBar-foreground rounded-lg shadow-xl p-6 max-w-[600px] w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Column Settings: {column.replace(/_/g, ' ')}
          </h2>
          <button
            onClick={handleClose}
            className="text-vscode-descriptionForeground hover:text-vscode-sideBar-foreground cursor-pointer text-xl"
            title="Close"
          >
            ✕
          </button>
        </div>

        {isAIColumn ? (
          <div className="flex flex-col gap-4">
            {/* System Prompt */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-sm font-medium">System Prompt</label>
                <span
                  className="text-xs text-vscode-descriptionForeground cursor-help"
                  title="Defines the AI agent's role and expertise for this column's activity. Example: 'You are a senior software architect writing technical specifications.'"
                >
                  ?
                </span>
              </div>
              <div className="relative">
                <textarea
                  value={systemValue}
                  onChange={handleSystemChange}
                  className="w-full min-h-[120px] p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded font-mono text-sm resize-vertical focus:outline-none focus:border-vscode-focusBorder"
                  style={{ fontFamily: 'monospace' }}
                />
                <button
                  onClick={handleResetSystem}
                  className="absolute top-1 right-1 text-xs text-vscode-descriptionForeground hover:text-vscode-sideBar-foreground cursor-pointer p-1"
                  title="Reset to default"
                >
                  ↩
                </button>
              </div>
              {systemSaved && (
                <span className="text-xs text-vscode-descriptionForeground mt-1">
                  Auto-saved ✓
                </span>
              )}
            </div>

            {/* Developer Prompt */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-sm font-medium">Developer Prompt</label>
                <span
                  className="text-xs text-vscode-descriptionForeground cursor-help"
                  title="Provides project conventions, output format requirements, and implementation rules. Example: 'Follow our spec template with sections for Architecture, API Contracts, and Implementation Plan.'"
                >
                  ?
                </span>
              </div>
              <div className="relative">
                <textarea
                  value={developerValue}
                  onChange={handleDeveloperChange}
                  className="w-full min-h-[120px] p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded font-mono text-sm resize-vertical focus:outline-none focus:border-vscode-focusBorder"
                  style={{ fontFamily: 'monospace' }}
                />
                <button
                  onClick={handleResetDeveloper}
                  className="absolute top-1 right-1 text-xs text-vscode-descriptionForeground hover:text-vscode-sideBar-foreground cursor-pointer p-1"
                  title="Reset to default"
                >
                  ↩
                </button>
              </div>
              {developerSaved && (
                <span className="text-xs text-vscode-descriptionForeground mt-1">
                  Auto-saved ✓
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-vscode-descriptionForeground text-sm py-4">
            Human review column — no AI prompts configured
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground cursor-pointer text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

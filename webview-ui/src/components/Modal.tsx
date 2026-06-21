import { useEffect, ReactNode } from 'react';
import { logger } from '../logger';

interface ModalProps {
  /** Modal title shown in the header bar */
  title: string;
  /** Called when the modal is closed (X button, overlay click, or Escape key) */
  onClose: () => void;
  /** Modal body content */
  children: ReactNode;
  /** Maximum width of the modal dialog. Default: max-w-[600px] */
  maxWidth?: string;
}

/**
 * Reusable modal dialog with overlay, header, and close button.
 * Closes on overlay click (clicking outside the dialog) and Escape key.
 */
export default function Modal({ title, onClose, children, maxWidth = 'max-w-[600px]' }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        logger.info(`[Modal.useEffect] Escape key pressed, closing modal: ${title}`);
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [title, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      logger.info(`[Modal.handleOverlayClick] Overlay clicked, closing modal: ${title}`);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`${maxWidth} bg-vscode-editor-background text-vscode-sideBar-foreground rounded-lg shadow-xl p-6 w-full mx-4`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => {
              logger.info(`[Modal.headerClose] X button clicked, closing modal: ${title}`);
              onClose();
            }}
            className="text-vscode-descriptionForeground hover:text-vscode-sideBar-foreground cursor-pointer text-xl"
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {children}
      </div>
    </div>
  );
}

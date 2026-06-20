interface HeaderProps {
  onRefresh: () => void;
}

export default function Header({ onRefresh }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-vscode-panel-background border-b border-vscode-panel-border">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold text-vscode-panel-foreground">
          AI OS Kanban
        </h1>
      </div>
      <button
        onClick={onRefresh}
        className="px-3 py-1.5 text-sm bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded-md transition-colors"
      >
        Refresh
      </button>
    </header>
  );
}

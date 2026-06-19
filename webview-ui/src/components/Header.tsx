interface HeaderProps {
  onRefresh: () => void;
}

export default function Header({ onRefresh }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">
          AI OS Kanban
        </h1>
      </div>
      <button
        onClick={onRefresh}
        className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
      >
        Refresh
      </button>
    </header>
  );
}

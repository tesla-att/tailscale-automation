import { useEffect, useState, memo } from 'react';

interface KeyboardShortcutsProps {
  onRefresh?: () => void;
  onToggleView?: () => void;
  onFocusSearch?: () => void;
}

const KeyboardShortcuts = memo(({ onRefresh, onToggleView, onFocusSearch }: KeyboardShortcutsProps) => {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Cmd/Ctrl + R: Refresh
      if ((event.metaKey || event.ctrlKey) && event.key === 'r') {
        event.preventDefault();
        onRefresh?.();
      }

      // V: Toggle view
      if (event.key === 'v' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onToggleView?.();
      }

      // /: Focus search
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onFocusSearch?.();
      }

      // ?: Show help
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setShowHelp(prev => !prev);
      }

      // Escape: Close help
      if (event.key === 'Escape') {
        setShowHelp(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRefresh, onToggleView, onFocusSearch]);

  if (!showHelp) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowHelp(true)}
          className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl"
          title="Keyboard shortcuts (?)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Keyboard Shortcuts</h3>
          <button
            onClick={() => setShowHelp(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Refresh data</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">⌘ R</kbd>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Toggle view mode</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">V</kbd>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Focus search</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">/</kbd>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Show this help</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">?</kbd>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Close help</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">ESC</kbd>
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-100 rounded">ESC</kbd> or click outside to close
        </div>
      </div>
    </div>
  );
});

KeyboardShortcuts.displayName = 'KeyboardShortcuts';

export default KeyboardShortcuts;

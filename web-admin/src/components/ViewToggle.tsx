import { memo } from 'react';

interface ViewToggleProps {
  view: 'table' | 'grid';
  onViewChange: (view: 'table' | 'grid') => void;
}

const ViewToggle = memo(({ view, onViewChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center bg-gray-100 rounded-xl p-1 shadow-sm">
      <button
        onClick={() => onViewChange('table')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
          ${view === 'table' 
            ? 'bg-white shadow-sm text-blue-700 transform scale-105' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }
        `}
        aria-label="Table view"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18m-9 8h9" />
        </svg>
        <span className="hidden sm:inline">Table</span>
      </button>
      
      <button
        onClick={() => onViewChange('grid')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
          ${view === 'grid' 
            ? 'bg-white shadow-sm text-blue-700 transform scale-105' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }
        `}
        aria-label="Grid view"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <span className="hidden sm:inline">Grid</span>
      </button>
    </div>
  );
});

ViewToggle.displayName = 'ViewToggle';

export default ViewToggle;

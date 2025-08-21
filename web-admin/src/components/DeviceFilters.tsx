import { memo, useState } from 'react';

interface DeviceFiltersProps {
  onFilterChange: (filters: DeviceFilters) => void;
  totalDevices: number;
  filteredCount: number;
}

interface DeviceFilters {
  status: 'all' | 'online' | 'offline';
  user: string;
  timeRange: 'all' | 'hour' | 'day' | 'week';
}

const DeviceFilters = memo(({ onFilterChange, totalDevices, filteredCount }: DeviceFiltersProps) => {
  const [filters, setFilters] = useState<DeviceFilters>({
    status: 'all',
    user: '',
    timeRange: 'all'
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (newFilters: Partial<DeviceFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const clearFilters = () => {
    const defaultFilters: DeviceFilters = {
      status: 'all',
      user: '',
      timeRange: 'all'
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  const hasActiveFilters = filters.status !== 'all' || filters.user !== '' || filters.timeRange !== 'all';

  return (
    <div className="space-y-4">
      {/* Filter toggle and summary */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-300"
        >
          <svg 
            className={`w-4 h-4 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Advanced Filters
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
              Active
            </span>
          )}
        </button>

        <div className="text-sm text-gray-600">
          <span className="font-medium">{filteredCount}</span> of <span className="font-medium">{totalDevices}</span> devices
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-3 text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl animate-slide-down">
          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange({ status: e.target.value as 'all' | 'online' | 'offline' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            >
              <option value="all">All devices</option>
              <option value="online">Online only</option>
              <option value="offline">Offline only</option>
            </select>
          </div>

          {/* User filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">User</label>
            <input
              type="text"
              placeholder="Filter by user..."
              value={filters.user}
              onChange={(e) => handleFilterChange({ user: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
          </div>

          {/* Time range filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Seen</label>
            <select
              value={filters.timeRange}
              onChange={(e) => handleFilterChange({ timeRange: e.target.value as DeviceFilters['timeRange'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            >
              <option value="all">Any time</option>
              <option value="hour">Last hour</option>
              <option value="day">Last day</option>
              <option value="week">Last week</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
});

DeviceFilters.displayName = 'DeviceFilters';

export default DeviceFilters;
export type { DeviceFilters as DeviceFiltersType };

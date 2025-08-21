import { useState, useMemo, useCallback } from "react";
import { ApiService } from "../services/api";
import usePoll from "../hooks/usePoll";
import Table from "../components/Table";
import { TableLoadingSkeleton } from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import ViewToggle from "../components/ViewToggle";
import DeviceFilters, { type DeviceFiltersType } from "../components/DeviceFilters";
import EnhancedDeviceCard from "../components/EnhancedDeviceCard";

const StatusBadge = ({ online }: { online: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-300 ${
    online 
      ? 'bg-green-100 text-green-800 hover:bg-green-200'
      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
  }`}>
    <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
    {online ? 'Online' : 'Offline'}
  </span>
);

export default function EnhancedDevices() {
  const { data, err, isLoading, refetch } = usePoll<{devices: any[]}>(() => ApiService.getDevices(), 10000);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [filters, setFilters] = useState<DeviceFiltersType>({
    status: 'all',
    user: '',
    timeRange: 'all'
  });

  const devices = data?.devices || [];
  
  // Apply filters
  const filteredDevices = useMemo(() => {
    return devices.filter((device: any) => {
      const isOnline = device.lastSeen ? (new Date().getTime() - new Date(device.lastSeen).getTime()) < 300000 : false;
      
      // Status filter
      if (filters.status === 'online' && !isOnline) return false;
      if (filters.status === 'offline' && isOnline) return false;
      
      // User filter
      if (filters.user && !device.user?.toLowerCase().includes(filters.user.toLowerCase())) return false;
      
      // Time range filter
      if (filters.timeRange !== 'all' && device.lastSeen) {
        const lastSeen = new Date(device.lastSeen);
        const now = new Date();
        const diffHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);
        
        switch (filters.timeRange) {
          case 'hour':
            if (diffHours > 1) return false;
            break;
          case 'day':
            if (diffHours > 24) return false;
            break;
          case 'week':
            if (diffHours > 168) return false;
            break;
        }
      }
      
      return true;
    });
  }, [devices, filters]);
  
  const rows = filteredDevices.map((d: any) => ({
    id: d.id,
    hostname: d.hostname || d.name || "-",
    user: d.user || "-",
    online: d.lastSeen ? (new Date().getTime() - new Date(d.lastSeen).getTime()) < 300000 : false,
    last_seen: d.lastSeen ? new Date(d.lastSeen).toLocaleString() : "Never",
  }));
  
  const handleFilterChange = useCallback((newFilters: DeviceFiltersType) => {
    setFilters(newFilters);
  }, []);
  
  const handleViewChange = useCallback((newView: 'table' | 'grid') => {
    setView(newView);
  }, []);

  const columns = [
    { key: "hostname", label: "Hostname", sortable: true },
    { key: "user", label: "User", sortable: true },
    {
      key: "online",
      label: "Status",
      sortable: true,
      render: (value: boolean) => <StatusBadge online={value} />
    },
    { key: "last_seen", label: "Last Seen", sortable: true },
  ];

  if (err) {
    return (
      <div>
        {/* Enhanced header with stats and controls */}
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
              <p className="text-gray-600">Manage and monitor your Tailscale devices</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <ViewToggle view={view} onViewChange={handleViewChange} />
              
              <button 
                onClick={refetch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="font-medium">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        <ErrorMessage 
          message={err} 
          onRetry={refetch}
          className="animate-slide-up"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        {/* Enhanced header with stats and controls */}
        <div className="space-y-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
              <p className="text-gray-600">Manage and monitor your Tailscale devices</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <ViewToggle view={view} onViewChange={handleViewChange} />
              
              <button 
                disabled
                className="px-4 py-2 bg-gray-400 text-white rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="font-medium">Loading...</span>
              </button>
            </div>
          </div>
          
          {/* Loading skeleton for stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 p-4 rounded-xl animate-pulse">
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>

        <TableLoadingSkeleton rows={5} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced header with stats and controls */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
            <p className="text-gray-600">Manage and monitor your Tailscale devices</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <ViewToggle view={view} onViewChange={handleViewChange} />
            
            <button 
              onClick={refetch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-medium">Refresh</span>
            </button>
          </div>
        </div>
        
        {/* Device statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 hover:shadow-md transition-all duration-300 cursor-pointer group">
            <div className="text-2xl font-bold text-blue-700 group-hover:scale-110 transition-transform duration-300">{devices.length}</div>
            <div className="text-sm text-blue-600 font-medium">Total Devices</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200 hover:shadow-md transition-all duration-300 cursor-pointer group">
            <div className="text-2xl font-bold text-green-700 group-hover:scale-110 transition-transform duration-300">{rows.filter(r => r.online).length}</div>
            <div className="text-sm text-green-600 font-medium">Online Now</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200 hover:shadow-md transition-all duration-300 cursor-pointer group">
            <div className="text-2xl font-bold text-orange-700 group-hover:scale-110 transition-transform duration-300">{rows.filter(r => !r.online).length}</div>
            <div className="text-sm text-orange-600 font-medium">Offline</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 hover:shadow-md transition-all duration-300 cursor-pointer group">
            <div className="text-2xl font-bold text-purple-700 group-hover:scale-110 transition-transform duration-300">{filteredDevices.length}</div>
            <div className="text-sm text-purple-600 font-medium">Filtered</div>
          </div>
        </div>
        
        {/* Advanced filters */}
        <DeviceFilters 
          onFilterChange={handleFilterChange}
          totalDevices={devices.length}
          filteredCount={filteredDevices.length}
        />
      </div>

      {/* Content based on view mode */}
      {view === 'table' ? (
        <Table 
          columns={columns} 
          rows={rows} 
          searchable={true} 
          className="animate-slide-up"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up">
          {rows.map((device, index) => (
            <div 
              key={device.id} 
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <EnhancedDeviceCard 
                device={device}
                onClick={() => console.log('Device clicked:', device.hostname)}
              />
            </div>
          ))}
          
          {rows.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">No devices found</p>
              <p className="text-sm">Try adjusting your filters or search criteria</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

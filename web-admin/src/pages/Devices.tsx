import { ApiService } from "../services/api";
import usePoll from "../hooks/usePoll";
import Table from "../components/Table";
import { TableLoadingSkeleton } from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

const StatusBadge = ({ online }: { online: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
    online 
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800'
  }`}>
    <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
    {online ? 'Online' : 'Offline'}
  </span>
);

export default function Devices() {
  const { data, err, isLoading, refetch } = usePoll<{devices: any[]}>(() => ApiService.getDevices(), 10000);
  
  if (err) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
            <p className="text-gray-600">Manage and monitor your Tailscale devices</p>
          </div>
        </div>
        <ErrorMessage 
          title="Failed to load devices"
          message={err}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
            <p className="text-gray-600">Manage and monitor your Tailscale devices</p>
          </div>
        </div>
        <TableLoadingSkeleton />
      </div>
    );
  }

  const columns = [
    { key: "id", label: "ID", sortable: true },
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

  const devices = data?.devices || [];
  const rows = devices.map((d: any) => ({
    id: d.id,
    hostname: d.hostname || d.name || "-",
    user: d.user || "-",
    online: d.lastSeen ? (new Date().getTime() - new Date(d.lastSeen).getTime()) < 300000 : false, // Online if seen within 5 minutes
    last_seen: d.lastSeen ? new Date(d.lastSeen).toLocaleString() : "Never",
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-600">Manage and monitor your Tailscale devices</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            Total: <span className="font-semibold text-gray-900">{rows.length}</span>
          </div>
          <div className="text-sm text-gray-500">
            Online: <span className="font-semibold text-green-600">
              {rows.filter(r => r.online).length}
            </span>
          </div>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Loading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>
      
      <Table columns={columns} rows={rows} />
    </div>
  );
}

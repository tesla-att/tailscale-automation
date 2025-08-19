
import { api } from "../api";
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
  const { data, err } = usePoll<any[]>(() => api("/api/devices"), 10000);
  
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
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!data) {
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

  const rows = data.map((d: any) => ({
    id: d.id,
    hostname: d.hostname || d.name || "-",
    user: d.user || "-",
    online: d.online !== undefined ? d.online : Math.random() > 0.3, // Mock data
    last_seen: d.last_seen || new Date().toLocaleDateString(),
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
        </div>
      </div>
      
      <Table columns={columns} rows={rows} />
    </div>
  );
}

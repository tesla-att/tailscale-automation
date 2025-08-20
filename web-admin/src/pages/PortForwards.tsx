import React, { useState } from "react";
import { ApiService } from "../services/api";
import usePoll from "../hooks/usePoll";
import Table from "../components/Table";
import { TableLoadingSkeleton } from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

interface PortForward {
  id: string;
  name: string;
  source_port: number;
  target_host: string;
  target_port: number;
  protocol: string;
  active: boolean;
  description?: string;
  created_at: string;
  user_id: string;
  machine_id?: string;
}



const StatusBadge = ({ active }: { active: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
    active 
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800'
  }`}>
    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
    {active ? 'Active' : 'Inactive'}
  </span>
);

const ProtocolBadge = ({ protocol }: { protocol: string }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
    protocol.toLowerCase() === 'tcp' 
      ? 'bg-blue-100 text-blue-800'
      : 'bg-purple-100 text-purple-800'
  }`}>
    {protocol.toUpperCase()}
  </span>
);

const CreatePortForwardModal = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    source_port: '',
    target_host: '',
    target_port: '',
    protocol: 'tcp',
    description: '',
    user_id: 'default-user' // This should be selected from a user list in a real app
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await ApiService.post('/port-forwards', {
          ...formData,
          source_port: parseInt(formData.source_port),
        target_port: parseInt(formData.target_port)
      });
      onSuccess();
      onClose();
      setFormData({
        name: '',
        source_port: '',
        target_host: '',
        target_port: '',
        protocol: 'tcp',
        description: '',
        user_id: 'default-user'
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create Port Forward</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Web Server"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Port *
              </label>
              <input
                type="number"
                required
                min="1"
                max="65535"
                value={formData.source_port}
                onChange={(e) => setFormData({ ...formData, source_port: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="8080"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protocol
              </label>
              <select
                value={formData.protocol}
                onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Host *
            </label>
            <input
              type="text"
              required
              value={formData.target_host}
              onChange={(e) => setFormData({ ...formData, target_host: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="192.168.1.100 or hostname"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Port *
            </label>
            <input
              type="number"
              required
              min="1"
              max="65535"
              value={formData.target_port}
              onChange={(e) => setFormData({ ...formData, target_port: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="80"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Optional description..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function PortForwards() {
  const { data, err, refetch } = usePoll<PortForward[]>(() => ApiService.get("/port-forwards"), 10000);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const handleToggle = async (id: string) => {
    try {
      await ApiService.post(`/port-forwards/${id}/toggle`, {});
      refetch();
    } catch (err: any) {
      alert(`Failed to toggle port forward: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      await ApiService.post(`/port-forwards/${id}/delete`, {});
      refetch();
    } catch (err: any) {
      alert(`Failed to delete port forward: ${err.message}`);
    }
  };
  
  if (err) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Port Forwards</h1>
            <p className="text-gray-600">Manage port forwarding rules</p>
          </div>
        </div>
        <ErrorMessage 
          title="Failed to load port forwards"
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
            <h1 className="text-2xl font-bold text-gray-900">Port Forwards</h1>
            <p className="text-gray-600">Manage port forwarding rules</p>
          </div>
        </div>
        <TableLoadingSkeleton />
      </div>
    );
  }

  const columns = [
    { key: "name", label: "Name", sortable: true },
    { 
      key: "rule", 
      label: "Rule", 
      sortable: false,
      render: (_: any, row: any) => (
        <div className="font-mono text-sm">
          {row.source_port} → {row.target_host}:{row.target_port}
        </div>
      )
    },
    { 
      key: "protocol", 
      label: "Protocol", 
      sortable: true,
      render: (value: string) => <ProtocolBadge protocol={value} />
    },
    { 
      key: "active", 
      label: "Status", 
      sortable: true,
      render: (value: boolean) => <StatusBadge active={value} />
    },
    { key: "description", label: "Description", sortable: false },
    { 
      key: "actions", 
      label: "Actions", 
      sortable: false,
      render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggle(row.id)}
            className={`px-3 py-1 text-xs rounded-full font-medium ${
              row.active 
                ? 'bg-red-100 text-red-800 hover:bg-red-200'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            {row.active ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => handleDelete(row.id, row.name)}
            className="px-3 py-1 text-xs rounded-full font-medium bg-red-100 text-red-800 hover:bg-red-200"
          >
            Delete
          </button>
        </div>
      )
    },
  ];

  const rows = data.map((pf: PortForward) => ({
    id: pf.id,
    name: pf.name,
    source_port: pf.source_port,
    target_host: pf.target_host,
    target_port: pf.target_port,
    protocol: pf.protocol,
    active: pf.active,
    description: pf.description || "-",
    rule: `${pf.source_port} → ${pf.target_host}:${pf.target_port}`,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Port Forwards</h1>
          <p className="text-gray-600">Manage port forwarding rules</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            Total: <span className="font-semibold text-gray-900">{rows.length}</span>
          </div>
          <div className="text-sm text-gray-500">
            Active: <span className="font-semibold text-green-600">
              {rows.filter(r => r.active).length}
            </span>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Add Port Forward
          </button>
        </div>
      </div>
      
      <Table columns={columns} rows={rows} />
      
      <CreatePortForwardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}

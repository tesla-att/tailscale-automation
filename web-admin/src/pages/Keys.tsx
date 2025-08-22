import React, { useEffect, useState } from "react";
import { ApiService } from "../services/api";
import Table from "../components/Table";
import { TableLoadingSkeleton } from "../components/LoadingSpinner";
import ErrorMessage, { InlineError } from "../components/ErrorMessage";

interface AuthKey {
  id: string;
  ts_key_id: string;
  description: string;
  key?: string;
  key_masked: string;
  status: string;
  expires_at: string;
  uses: number;
  max_uses?: number;
  created_at: string;
  tags: string[];
  reusable: boolean;
  ephemeral: boolean;
  preauthorized: boolean;
  user_email?: string;
  machine_hostname?: string;
  permissions: any;
}

interface AuthKeyStats {
  total_keys: number;
  active_keys: number;
  expired_keys: number;
  revoked_keys: number;
  keys_expiring_soon: number;
  tailnet_info: any;
}

const KeyStatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Active' };
      case 'expired':
        return { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Expired' };
      case 'revoked':
        return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500', label: 'Revoked' };
      default:
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500', label: 'Unknown' };
    }
  };

  const config = getStatusConfig(status);
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></div>
      {config.label}
    </span>
  );
};

const MaskedKey = ({ masked, onCopy }: { masked: string; onCopy?: () => void }) => (
  <div className="flex items-center gap-2">
    <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{masked}</code>
    <button 
      className="text-gray-400 hover:text-gray-600 transition-colors"
      onClick={onCopy || (() => navigator.clipboard.writeText(masked))}
      title="Copy to clipboard"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  </div>
);

const TagBadge = ({ tag }: { tag: string }) => (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
    {tag}
  </span>
);

const KeyActions = ({ authKey, onRevoke, onReactivate, onViewDetails }: { 
  authKey: AuthKey; 
  onRevoke: (id: string) => void;
  onReactivate: (id: string) => void;
  onViewDetails: (id: string) => void;
}) => (
  <div className="flex items-center gap-2">
    <button
      onClick={() => onViewDetails(authKey.id)}
      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
    >
      View
    </button>
    
    {authKey.status === 'active' && (
      <button
        onClick={() => onRevoke(authKey.id)}
        className="text-red-600 hover:text-red-800 text-sm font-medium"
      >
        Revoke
      </button>
    )}
    
    {authKey.status === 'revoked' && (
      <button
        onClick={() => onReactivate(authKey.id)}
        className="text-green-600 hover:text-green-800 text-sm font-medium"
      >
        Reactivate
      </button>
    )}
  </div>
);

export default function Keys() {
  const [keys, setKeys] = useState<AuthKey[]>([]);
  const [stats, setStats] = useState<AuthKeyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedKey, setSelectedKey] = useState<AuthKey | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    user_id: '',
    machine_id: '',
    include_inactive: true  // Default to true to show all keys
  });

  const loadKeys = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Build query parameters for filtering
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.user_id) queryParams.append('user_id', filters.user_id);
      if (filters.machine_id) queryParams.append('machine_id', filters.machine_id);
      if (filters.include_inactive) queryParams.append('include_inactive', 'true');
      
      const endpoint = `/keys${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const data = await ApiService.get(endpoint);
      
      // Apply client-side filtering for better UX
      let filteredKeys = data;
      
      if (filters.status) {
        filteredKeys = filteredKeys.filter((key: AuthKey) => key.status === filters.status);
      }
      
      // Only filter by active status if user explicitly unchecks include_inactive
      if (filters.include_inactive === false) {
        // Show only active keys when user explicitly unchecks include_inactive
        filteredKeys = filteredKeys.filter((key: AuthKey) => key.status === 'active');
      }
      // Default behavior: if include_inactive is true or undefined, show all keys
      
      setKeys(filteredKeys);
      
      // Load stats
      try {
        const statsData = await ApiService.get('/keys/stats');
        setStats(statsData);
      } catch (e) {
        console.warn('Failed to load stats:', e);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load keys");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await ApiService.get('/keys/stats');
      setStats(data);
    } catch (err) {
      console.warn('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []); // Only load on mount

  const createForUser = async (keyData: any) => {
    try {
      const newKey = await ApiService.post("/keys", keyData);
      setShowCreateForm(false);
      await loadKeys();
      await loadStats();
      
      // Show success message with the new key
      if (newKey.key) {
        alert(`Key created successfully!\n\nFull Key: ${newKey.key}\n\n⚠️ Copy this key now - it won't be shown again!`);
      }
    } catch (err: any) {
      alert(`Failed to create key: ${err.message}`);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this key? This action cannot be undone.')) {
      return;
    }
    
    try {
      await ApiService.post(`/keys/${keyId}/revoke`, {});
      await loadKeys();
      await loadStats();
      alert('Key revoked successfully');
    } catch (err: any) {
      alert(`Failed to revoke key: ${err.message}`);
    }
  };

  const handleReactivate = async (keyId: string) => {
    try {
      await ApiService.post(`/keys/${keyId}/reactivate`, {});
      await loadKeys();
      await loadStats();
      alert('Key reactivated successfully');
    } catch (err: any) {
      alert(`Failed to reactivate key: ${err.message}`);
    }
  };

  const handleViewDetails = (keyId: string) => {
    const key = keys.find(k => k.id === keyId);
    if (key) {
      setSelectedKey(key);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (error) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
            <p className="text-gray-600">Manage authentication keys for API access</p>
          </div>
        </div>
        <ErrorMessage 
          title="Failed to load keys"
          message={error}
          onRetry={loadKeys}
        />
      </div>
    );
  }

  const columns = [
    { key: "id", label: "ID", sortable: true },
    { 
      key: "key_masked", 
      label: "Key", 
      sortable: false,
      render: (key_masked: string, _row: any) => (
        <MaskedKey 
          masked={key_masked} 
          onCopy={() => navigator.clipboard.writeText(key_masked)}
        />
      )
    },
    { key: "description", label: "Description", sortable: true },
    { key: "user_email", label: "User", sortable: true },
    { key: "machine_hostname", label: "Machine", sortable: true },
    { 
      key: "tags", 
      label: "Tags", 
      sortable: false,
      render: (tags: string[], _row: any) => (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, index) => (
            <TagBadge key={index} tag={tag} />
          ))}
        </div>
      )
    },
    { key: "expires_at", label: "Expires", sortable: true },
    { 
      key: "status", 
      label: "Status", 
      sortable: true,
      render: (status: string, _row: any) => <KeyStatusBadge status={status} />
    },
    { key: "uses", label: "Uses", sortable: true },
    { key: "created_at", label: "Created", sortable: true },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_: any, row: AuthKey) => (
        <KeyActions 
          authKey={row} 
          onRevoke={handleRevoke}
          onReactivate={handleReactivate}
          onViewDetails={handleViewDetails}
        />
      )
    }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-600">Manage authentication keys for API access</p>
        </div>
        <div className="flex items-center gap-4">
          {stats && (
            <div className="text-sm text-gray-500">
              Total: <span className="font-semibold text-gray-900">{stats.total_keys}</span> | 
              Active: <span className="font-semibold text-green-600">{stats.active_keys}</span> | 
              Expired: <span className="font-semibold text-red-600">{stats.expired_keys}</span>
            </div>
          )}
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium"
          >
            {showCreateForm ? 'Cancel' : 'Create New Key'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-600">Total Keys</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_keys}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600">{stats.active_keys}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-600">Expired</div>
            <div className="text-2xl font-bold text-red-600">{stats.expired_keys}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-600">Revoked</div>
            <div className="text-2xl font-bold text-gray-600">{stats.revoked_keys}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-600">Expiring Soon</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.keys_expiring_soon}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Include Inactive</label>
            <input
              type="checkbox"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={filters.include_inactive}
              onChange={(e) => handleFilterChange('include_inactive', e.target.checked)}
            />
          </div>
          <div className="md:col-span-2">
            <button
              onClick={() => {
                // Force reload from backend with current filters
                loadKeys();
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Key</h2>
          <CreateKeyForm onCreate={createForUser} onCancel={() => setShowCreateForm(false)} />
        </div>
      )}

      {/* Keys Table */}
      {loading ? (
        <TableLoadingSkeleton />
      ) : (
        <Table columns={columns} rows={keys} />
      )}

      {/* Key Details Modal */}
      {selectedKey && (
        <KeyDetailsModal 
          authKey={selectedKey} 
          onClose={() => setSelectedKey(null)} 
        />
      )}
    </div>
  );
}

function CreateKeyForm({ onCreate, onCancel }: { 
  onCreate: (keyData: any) => void; 
  onCancel: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    description: '',
    ttl_seconds: 86400, // 1 day default
    reusable: true,
    ephemeral: false,
    preauthorized: true,
    tags: [] as string[],
    user_id: '',
    machine_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersData, machinesResponse] = await Promise.all([
          ApiService.get("/users"),
          ApiService.get("/devices")
        ]);
        setUsers(usersData);
        
        // Handle new devices response format
        if (machinesResponse && machinesResponse.devices) {
          setMachines(machinesResponse.devices);
        } else if (Array.isArray(machinesResponse)) {
          setMachines(machinesResponse);
        } else {
          setMachines([]);
        }
      } catch (err: any) {
        console.error("Failed to load users and machines:", err);
        setError("Failed to load users and machines");
        setUsers([]);
        setMachines([]);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description) return;
    
    setLoading(true);
    try {
      await onCreate(formData);
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    const tag = prompt('Enter tag name:');
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <InlineError message={error} />}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="e.g., Production server access"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            TTL (seconds)
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.ttl_seconds}
            onChange={(e) => setFormData(prev => ({ ...prev, ttl_seconds: parseInt(e.target.value) }))}
          >
            <option value={300}>5 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>1 day</option>
            <option value={604800}>1 week</option>
            <option value={2592000}>1 month</option>
            <option value={31536000}>1 year</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            User (optional)
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.user_id}
            onChange={(e) => setFormData(prev => ({ ...prev, user_id: e.target.value }))}
          >
            <option value="">-- Choose a user --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.email} {u.display_name && `(${u.display_name})`}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Machine (optional)
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.machine_id}
            onChange={(e) => setFormData(prev => ({ ...prev, machine_id: e.target.value }))}
          >
            <option value="">-- Choose a machine --</option>
            {machines.map(m => (
              <option key={m.id} value={m.id}>
                {m.hostname || m.name || 'Unknown'} {m.user_email && `(${m.user_email})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
            checked={formData.reusable}
            onChange={(e) => setFormData(prev => ({ ...prev, reusable: e.target.checked }))}
          />
          <span className="text-sm font-medium text-gray-700">Reusable</span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
            checked={formData.ephemeral}
            onChange={(e) => setFormData(prev => ({ ...prev, ephemeral: e.target.checked }))}
          />
          <span className="text-sm font-medium text-gray-700">Ephemeral</span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
            checked={formData.preauthorized}
            onChange={(e) => setFormData(prev => ({ ...prev, preauthorized: e.target.checked }))}
          />
          <span className="text-sm font-medium text-gray-700">Preauthorized</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags
        </label>
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={addTag}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            + Add Tag
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.tags.map((tag, index) => (
            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!formData.description || loading}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Creating...
            </div>
          ) : (
            "Create Key"
          )}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
        <p>⚠️ Keys will be shown only once upon creation. Make sure to copy and store them securely.</p>
      </div>
    </form>
  );
}

function KeyDetailsModal({ authKey, onClose }: { authKey: AuthKey; onClose: () => void }) {
  const [usageStats, setUsageStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsageStats = async () => {
      if (authKey.ts_key_id) {
        setLoading(true);
        try {
          const stats = await ApiService.get(`/keys/${authKey.id}/usage`);
          setUsageStats(stats);
        } catch (err) {
          console.warn('Failed to load usage stats:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    loadUsageStats();
  }, [authKey]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Key Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ID</label>
                <p className="text-sm text-gray-900">{authKey.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tailscale ID</label>
                <p className="text-sm text-gray-900">{authKey.ts_key_id || 'N/A'}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <p className="text-sm text-gray-900">{authKey.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <KeyStatusBadge status={authKey.status} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Uses</label>
                <p className="text-sm text-gray-900">{authKey.uses} / {authKey.max_uses || '∞'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <p className="text-sm text-gray-900">{new Date(authKey.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Expires</label>
                <p className="text-sm text-gray-900">{new Date(authKey.expires_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Reusable</label>
                <p className="text-sm text-gray-900">{authKey.reusable ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ephemeral</label>
                <p className="text-sm text-gray-900">{authKey.ephemeral ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Preauthorized</label>
                <p className="text-sm text-gray-900">{authKey.preauthorized ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {authKey.user_email && (
              <div>
                <label className="block text-sm font-medium text-gray-700">User</label>
                <p className="text-sm text-gray-900">{authKey.user_email}</p>
              </div>
            )}

            {authKey.machine_hostname && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Machine</label>
                <p className="text-sm text-gray-900">{authKey.machine_hostname}</p>
              </div>
            )}

            {authKey.tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Tags</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {authKey.tags.map((tag, index) => (
                    <TagBadge key={index} tag={tag} />
                  ))}
                </div>
              </div>
            )}

            {usageStats && !loading && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Usage Statistics</label>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Database Uses:</span> {usageStats.database_uses}
                    </div>
                    <div>
                      <span className="font-medium">Tailscale Uses:</span> {usageStats.tailscale_uses}
                    </div>
                    {usageStats.last_used && (
                      <div>
                        <span className="font-medium">Last Used:</span> {new Date(usageStats.last_used).toLocaleString()}
                      </div>
                    )}
                    {usageStats.max_uses && (
                      <div>
                        <span className="font-medium">Max Uses:</span> {usageStats.max_uses}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading usage statistics...</p>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { ApiService } from "../services/api";
import Table from "../components/Table";
import { TableLoadingSkeleton } from "../components/LoadingSpinner";
import ErrorMessage, { InlineError } from "../components/ErrorMessage";

const KeyStatusBadge = ({ active }: { active: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
    active 
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800'
  }`}>
    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`}></div>
    {active ? 'Active' : 'Inactive'}
  </span>
);

const MaskedKey = ({ masked }: { masked: string }) => (
  <div className="flex items-center gap-2">
    <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{masked}</code>
    <button 
      className="text-gray-400 hover:text-gray-600 transition-colors"
      onClick={() => navigator.clipboard.writeText(masked)}
      title="Copy to clipboard"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  </div>
);

export default function Keys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const loadKeys = async () => {
    try {
      setLoading(true);
      setError("");
      // Demo: Mock some keys data
      await new Promise(resolve => setTimeout(resolve, 1000));
      setKeys([
        {
          id: "1",
          masked: "tskey-auth-***************ABCD",
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          active: true,
          user_email: "admin@example.com",
          created_at: new Date().toLocaleDateString()
        },
        {
          id: "2", 
          masked: "tskey-auth-***************EFGH",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          active: true,
          user_email: "user@example.com",
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString()
        }
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to load keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const createForUser = async (user_id: string) => {
    try {
      const k = await ApiService.post("/keys", { user_id });
      // Refresh keys list after creating
      await loadKeys();
      alert(`Created key ${k.masked}`);
    } catch (err: any) {
      alert(`Failed to create key: ${err.message}`);
    }
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
      key: "masked", 
      label: "Key", 
      sortable: false,
      render: (masked: string) => <MaskedKey masked={masked} />
    },
    { key: "user_email", label: "User", sortable: true },
    { key: "expires_at", label: "Expires", sortable: true },
    { 
      key: "active", 
      label: "Status", 
      sortable: true,
      render: (active: boolean) => <KeyStatusBadge active={active} />
    },
    { key: "created_at", label: "Created", sortable: true },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-600">Manage authentication keys for API access</p>
        </div>
        <div className="text-sm text-gray-500">
          Total: <span className="font-semibold text-gray-900">{keys.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Key</h2>
        <CreateKeyForm onCreate={createForUser} />
      </div>

      {loading ? (
        <TableLoadingSkeleton />
      ) : (
        <Table columns={columns} rows={keys} />
      )}
    </div>
  );
}

function CreateKeyForm({ onCreate }: { onCreate: (user_id: string) => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [user, setUser] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await ApiService.get("/users");
        setUsers(data);
      } catch (err: any) {
        setError("Failed to load users");
      }
    };
    loadUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      await onCreate(user);
      setUser("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <InlineError message={error} />}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select User
          </label>
          <select
            id="user-select"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            value={user}
            onChange={e => setUser(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Choose a user --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.email} {u.display_name && `(${u.display_name})`}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-end">
          <button
            type="submit"
            disabled={!user || loading}
            className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
        </div>
      </div>

      <div className="text-sm text-gray-500">
        <p>⚠️ Keys will be shown only once upon creation. Make sure to copy and store them securely.</p>
      </div>
    </form>
  );
}

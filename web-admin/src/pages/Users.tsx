import { useEffect, useState } from "react";
import { ApiService } from "../services/api";
import Table from "../components/Table";
import { TableLoadingSkeleton } from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

const UserAvatar = ({ email, displayName }: { email: string; displayName: string }) => {
  const initials = displayName 
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase();
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
        {initials}
      </div>
      <div>
        <div className="font-medium text-gray-900">{displayName || email}</div>
        {displayName && <div className="text-sm text-gray-500">{email}</div>}
      </div>
    </div>
  );
};

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await ApiService.get("/users");
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (error) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-gray-600">Manage user accounts and permissions</p>
          </div>
        </div>
        <ErrorMessage 
          title="Failed to load users"
          message={error}
          onRetry={loadUsers}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-gray-600">Manage user accounts and permissions</p>
          </div>
        </div>
        <TableLoadingSkeleton />
      </div>
    );
  }

  const columns = [
    { key: "id", label: "ID", sortable: true },
    { 
      key: "email", 
      label: "User", 
      sortable: true,
      render: (email: string, row: any) => (
        <UserAvatar email={email} displayName={row.display_name} />
      )
    },
    { key: "role", label: "Role", sortable: true },
    { key: "created_at", label: "Created", sortable: true },
  ];

  const rows = users.map(u => ({
    id: u.id,
    email: u.email,
    display_name: u.display_name || "",
    role: u.role || "User",
    created_at: u.created_at || new Date().toLocaleDateString(),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>
        <div className="text-sm text-gray-500">
          Total: <span className="font-semibold text-gray-900">{rows.length}</span>
        </div>
      </div>
      
      <Table columns={columns} rows={rows} />
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Users, Shield, Activity, Bell, Settings, 
  BarChart3, Globe, RefreshCw, AlertCircle,
  Copy, Plus, Search,
  Monitor, TrendingUp, Loader2
} from 'lucide-react';

// Types
interface User {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  devices: number;
  created_at: string;
}

interface Device {
  id: string;
  name: string;
  ip: string;
  os: string;
  status: 'online' | 'offline';
  lastSeen: string;
  user: string;
  tags: string[];
  created: string;
  expires: string;
  hostname: string;
  clientVersion: string;
  updateAvailable: boolean;
  keyExpiryDisabled: boolean;
  machineKey: string;
  nodeKey: string;
}

interface AuthKey {
  id: string;
  description: string;
  key: string;
  status: 'active' | 'expired' | 'revoked';
  expiresAt: string;
  uses: number;
  maxUses: number;
  created_at: string;
  capabilities: any;
  tags: string[];
}

interface Analytics {
  totalUsers: number;
  activeDevices: number;
  totalDevices: number;
  keyRotations: number;
  avgUptime: number;
  dataTransfer: string;
  alertsToday: number;
  deploymentsToday: number;
}

// API Service
class ApiService {
  private static baseUrl = 'http://localhost:8000';

  static async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  static async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  static async delete(endpoint: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
  }

  // Specific API methods
  static getDevices(): Promise<{ devices: Device[] }> {
    return this.get('/api/devices');
  }

  static getUsers(): Promise<User[]> {
    return this.get('/api/users');
  }

  static createUser(userData: { name: string; email: string }): Promise<User> {
    return this.post('/api/users', userData);
  }

  static getAuthKeys(): Promise<AuthKey[]> {
    return this.get('/api/keys');
  }

  static createAuthKey(keyData: { 
    description: string; 
    ttl_seconds: number; 
    reusable?: boolean;
    tags?: string[];
  }): Promise<AuthKey> {
    return this.post('/api/keys', keyData);
  }

  static revokeAuthKey(keyId: string): Promise<void> {
    return this.post(`/api/keys/${keyId}/revoke`, {});
  }

  static getAnalytics(): Promise<Analytics> {
    return this.get('/api/analytics/overview');
  }

  static checkHealth(): Promise<{ status: string }> {
    return this.get('/healthz');
  }
}

// WebSocket Hook
function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connectWS = () => {
      try {
        ws.current = new WebSocket(url);
        
        ws.current.onopen = () => {
          setIsConnected(true);
          console.log('WebSocket connected');
        };
        
        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.current.onclose = () => {
          setIsConnected(false);
          console.log('WebSocket disconnected');
          // Reconnect after 5 seconds
          setTimeout(connectWS, 5000);
        };

        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setTimeout(connectWS, 5000);
      }
    };

    connectWS();

    return () => {
      ws.current?.close();
    };
  }, [url]);

  return { isConnected, lastMessage };
}

export default function TailscaleAdminDashboard() {
  // State management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [authKeys, setAuthKeys] = useState<AuthKey[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  // Modal states
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);

  // WebSocket connection
  const { isConnected, lastMessage } = useWebSocket('ws://localhost:8000/ws');

  // Load data functions
  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiService.getDevices();
      setDevices(data.devices || []);
      setError(null);
    } catch (err) {
      setError('Failed to load devices: ' + (err as Error).message);
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiService.getUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError('Failed to load users: ' + (err as Error).message);
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuthKeys = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiService.getAuthKeys();
      setAuthKeys(data);
      setError(null);
    } catch (err) {
      setError('Failed to load auth keys: ' + (err as Error).message);
      console.error('Failed to load auth keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await ApiService.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      // Fallback to mock data for analytics if API fails
      setAnalytics({
        totalUsers: users.length,
        activeDevices: devices.filter(d => d.status === 'online').length,
        totalDevices: devices.length,
        keyRotations: 0,
        avgUptime: 98.5,
        dataTransfer: '0 TB',
        alertsToday: 0,
        deploymentsToday: 0
      });
    }
  }, [users.length, devices]);

  const loadAllData = useCallback(async () => {
    await Promise.all([
      loadDevices(),
      loadUsers(),
      loadAuthKeys()
    ]);
    await loadAnalytics();
  }, [loadDevices, loadUsers, loadAuthKeys, loadAnalytics]);

  // Initial data load
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadAllData();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, loadAllData]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'device_update') {
        loadDevices();
      } else if (lastMessage.type === 'user_update') {
        loadUsers();
      } else if (lastMessage.type === 'key_update') {
        loadAuthKeys();
      }
      
      // Add notification
      setNotifications(prev => [
        { 
          id: Date.now(), 
          message: lastMessage.message || 'System update', 
          time: new Date().toISOString(), 
          type: lastMessage.level || 'info' 
        },
        ...prev.slice(0, 4)
      ]);
    }
  }, [lastMessage, loadDevices, loadUsers, loadAuthKeys]);

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotifications(prev => [
        { id: Date.now(), message: 'Đã sao chép vào clipboard', time: new Date().toISOString(), type: 'success' },
        ...prev.slice(0, 4)
      ]);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Create user handler
  const handleCreateUser = async (userData: { name: string; email: string }) => {
    try {
      setLoading(true);
      await ApiService.createUser(userData);
      await loadUsers();
      setShowCreateUser(false);
      setNotifications(prev => [
        { id: Date.now(), message: 'Tạo người dùng thành công', time: new Date().toISOString(), type: 'success' },
        ...prev.slice(0, 4)
      ]);
    } catch (err) {
      setError('Failed to create user: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Create auth key handler
  const handleCreateAuthKey = async (keyData: { description: string; ttlDays: number; tags: string[] }) => {
    try {
      setLoading(true);
      await ApiService.createAuthKey({
        description: keyData.description,
        ttl_seconds: keyData.ttlDays * 24 * 60 * 60,
        reusable: true,
        tags: keyData.tags
      });
      await loadAuthKeys();
      setShowCreateKey(false);
      setNotifications(prev => [
        { id: Date.now(), message: 'Tạo auth key thành công', time: new Date().toISOString(), type: 'success' },
        ...prev.slice(0, 4)
      ]);
    } catch (err) {
      setError('Failed to create auth key: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Revoke auth key handler
  const handleRevokeAuthKey = async (keyId: string) => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi key này?')) return;
    
    try {
      setLoading(true);
      await ApiService.revokeAuthKey(keyId);
      await loadAuthKeys();
      setNotifications(prev => [
        { id: Date.now(), message: 'Thu hồi auth key thành công', time: new Date().toISOString(), type: 'success' },
        ...prev.slice(0, 4)
      ]);
    } catch (err) {
      setError('Failed to revoke auth key: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Components
  const StatusIndicator = ({ status }: { status: string }) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-red-500',
      active: 'bg-green-500',
      inactive: 'bg-gray-500',
      expired: 'bg-red-500',
      revoked: 'bg-gray-500'
    };
    return <div className={`w-3 h-3 rounded-full ${colors[status as keyof typeof colors] || 'bg-gray-500'}`} />;
  };

  const StatCard = ({ title, value, change, icon: Icon, color = 'blue' }: any) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-1 flex items-center gap-1 ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className="w-4 h-4" />
              {change}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg bg-${color}-100 flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <span className="ml-2 text-gray-600">Đang tải...</span>
    </div>
  );

  const ErrorAlert = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-800">{message}</span>
        </div>
        <button onClick={onDismiss} className="text-red-600 hover:text-red-800">
          ×
        </button>
      </div>
    </div>
  );

  // Tab Components
  const DashboardTab = () => (
    <div className="space-y-6">
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Tổng người dùng" 
            value={analytics.totalUsers} 
            change={`+${users.filter(u => new Date(u.created_at) > new Date(Date.now() - 7*24*60*60*1000)).length} tuần này`}
            icon={Users} 
            color="blue" 
          />
          <StatCard 
            title="Thiết bị hoạt động" 
            value={`${analytics.activeDevices}/${analytics.totalDevices}`} 
            change={analytics.activeDevices > analytics.totalDevices * 0.8 ? '+Tốt' : 'Cần chú ý'}
            icon={Monitor} 
            color="green" 
          />
          <StatCard 
            title="Auth Keys hoạt động" 
            value={authKeys.filter(k => k.status === 'active').length} 
            change={`${authKeys.filter(k => k.status === 'expired').length} hết hạn`}
            icon={Shield} 
            color="purple" 
          />
          <StatCard 
            title="Thiết bị online" 
            value={`${Math.round((analytics.activeDevices / Math.max(analytics.totalDevices, 1)) * 100)}%`} 
            change={analytics.avgUptime > 95 ? '+Tốt' : 'Cần cải thiện'}
            icon={Activity} 
            color="indigo" 
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Thiết bị gần đây</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">{isConnected ? 'Đã kết nối' : 'Mất kết nối'}</span>
            </div>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {devices.slice(0, 5).map(device => (
              <div key={device.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <StatusIndicator status={device.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{device.name}</p>
                  <p className="text-xs text-gray-500">
                    {device.ip} • {device.os} • {formatDate(device.lastSeen)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Auth Keys</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {authKeys.slice(0, 5).map(key => (
              <div key={key.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <StatusIndicator status={key.status} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{key.description}</p>
                  <p className="text-xs text-gray-500">
                    Hết hạn: {formatDate(key.expiresAt)} • Uses: {key.uses}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const UsersTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm người dùng..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => setShowCreateUser(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Thêm người dùng
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading && <LoadingSpinner />}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người dùng</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thiết bị</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lần cuối</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users
                  .filter(user => 
                    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={user.status} />
                        <span className={`text-sm ${user.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                          {user.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {devices.filter(d => d.user === user.name).length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.lastLogin)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">Sửa</button>
                      <button className="text-red-600 hover:text-red-900">Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const DevicesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý thiết bị</h2>
        <button 
          onClick={loadDevices}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Làm mới
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading && <LoadingSpinner />}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thiết bị</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OS</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người dùng</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lần cuối</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {devices.map(device => (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-sm font-medium text-gray-900">{device.name}</span>
                          {device.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {device.tags.map(tag => (
                                <span key={tag} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.ip}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.os}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={device.status} />
                        <span className={`text-sm ${device.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                          {device.status === 'online' ? 'Trực tuyến' : 'Ngoại tuyến'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.user}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(device.lastSeen)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">Chi tiết</button>
                      <button className="text-red-600 hover:text-red-900">Ngắt kết nối</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const AuthKeysTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Auth Keys</h2>
        <button
          onClick={() => setShowCreateKey(true)}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Tạo key mới
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading && <LoadingSpinner />}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hết hạn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {authKeys.map(key => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{key.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded max-w-xs truncate">
                          {key.key.substring(0, 20)}...
                        </code>
                        <button 
                          onClick={() => copyToClipboard(key.key)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={key.status} />
                        <span className={`text-sm ${
                          key.status === 'active' ? 'text-green-600' : 
                          key.status === 'expired' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {key.status === 'active' ? 'Hoạt động' : 
                           key.status === 'expired' ? 'Hết hạn' : 'Thu hồi'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-1">
                        {key.tags.map(tag => (
                          <span key={tag} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(key.expiresAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button 
                        onClick={() => copyToClipboard(key.key)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Sao chép
                      </button>
                      {key.status === 'active' && (
                        <button 
                          onClick={() => handleRevokeAuthKey(key.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={loading}
                        >
                          Thu hồi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // Main navigation tabs
  const tabs = [
    { id: 'dashboard', name: 'Tổng quan', icon: BarChart3 },
    { id: 'users', name: 'Người dùng', icon: Users },
    { id: 'devices', name: 'Thiết bị', icon: Monitor },
    { id: 'keys', name: 'Auth Keys', icon: Shield },
    { id: 'settings', name: 'Cài đặt', icon: Settings },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'users': return <UsersTab />;
      case 'devices': return <DevicesTab />;
      case 'keys': return <AuthKeysTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">ATT Tailscale Manager</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <div className="relative">
                <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Auto refresh toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`p-2 rounded-lg ${autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                >
                  <RefreshCw className={`w-4 h-4 ${autoRefresh && !loading ? 'animate-spin' : ''}`} />
                </button>
                <span className="text-sm text-gray-600">Auto</span>
              </div>

              {/* Connection status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
        {renderTabContent()}
      </main>

      {/* Floating notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-20 right-4 space-y-2 z-50">
          {notifications.slice(0, 3).map(notification => (
            <div
              key={notification.id}
              className={`bg-white rounded-lg shadow-lg border p-4 max-w-sm animate-slide-in ${
                notification.type === 'success' ? 'border-green-200' :
                notification.type === 'error' ? 'border-red-200' : 'border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  notification.type === 'success' ? 'bg-green-500' :
                  notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(notification.time).toLocaleTimeString('vi-VN')}
                  </p>
                </div>
                <button
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Tạo người dùng mới</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              handleCreateUser({
                name: formData.get('name') as string,
                email: formData.get('email') as string
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tên</label>
                  <input
                    name="name"
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Auth Key Modal */}
      {showCreateKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Tạo Auth Key mới</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const tags = (formData.get('tags') as string).split(',').map(t => t.trim()).filter(t => t);
              handleCreateAuthKey({
                description: formData.get('description') as string,
                ttlDays: parseInt(formData.get('ttlDays') as string),
                tags
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả</label>
                  <input
                    name="description"
                    type="text"
                    required
                    placeholder="Employee Access 2025"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Thời hạn (ngày)</label>
                  <input
                    name="ttlDays"
                    type="number"
                    required
                    defaultValue={90}
                    min={1}
                    max={365}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (phân cách bằng dấu phẩy)</label>
                  <input
                    name="tags"
                    type="text"
                    placeholder="tag:employee, tag:office"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateKey(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}} />
    </div>
  );
}
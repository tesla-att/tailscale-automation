import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Shield, Activity, Server, Download, Bell, Settings, 
  BarChart3, Globe, Terminal, RefreshCw, AlertCircle, CheckCircle,
  Eye, EyeOff, Copy, Trash2, Plus, Search, Filter, Upload,
  Monitor, Cpu, HardDrive, Wifi, Clock, Zap, TrendingUp
} from 'lucide-react';

// Mock data for demo
const mockUsers = [
  { id: 1, name: 'Nguyễn Văn A', email: 'nva@company.com', status: 'active', lastLogin: '2025-01-20T10:30:00Z', devices: 2 },
  { id: 2, name: 'Trần Thị B', email: 'ttb@company.com', status: 'active', lastLogin: '2025-01-20T09:15:00Z', devices: 1 },
  { id: 3, name: 'Lê Văn C', email: 'lvc@company.com', status: 'inactive', lastLogin: '2025-01-19T16:45:00Z', devices: 0 },
];

const mockDevices = [
  { id: 1, name: 'NVA-LAPTOP', ip: '100.96.11.97', os: 'Windows 11', status: 'online', lastSeen: '2025-01-20T11:00:00Z', user: 'Nguyễn Văn A' },
  { id: 2, name: 'NVA-PHONE', ip: '100.96.11.98', os: 'Android 14', status: 'online', lastSeen: '2025-01-20T10:55:00Z', user: 'Nguyễn Văn A' },
  { id: 3, name: 'TTB-DESKTOP', ip: '100.96.11.99', os: 'Windows 10', status: 'offline', lastSeen: '2025-01-20T08:30:00Z', user: 'Trần Thị B' },
];

const mockAuthKeys = [
  { id: 1, description: 'Employee Key 2025', key: 'tskey-auth-xxx...', status: 'active', expiresAt: '2025-04-20T00:00:00Z', uses: 15, maxUses: 50 },
  { id: 2, description: 'Temporary Access', key: 'tskey-auth-yyy...', status: 'expired', expiresAt: '2025-01-15T00:00:00Z', uses: 5, maxUses: 10 },
];

const mockLogs = [
  { id: 1, timestamp: '2025-01-20T11:00:00Z', level: 'info', message: 'User "Nguyễn Văn A" logged in successfully', source: 'auth' },
  { id: 2, timestamp: '2025-01-20T10:58:00Z', level: 'warning', message: 'Auth key "Employee Key 2025" expires in 90 days', source: 'rotation' },
  { id: 3, timestamp: '2025-01-20T10:55:00Z', level: 'info', message: 'Device "NVA-PHONE" connected', source: 'device' },
  { id: 4, timestamp: '2025-01-20T10:50:00Z', level: 'error', message: 'Failed to deploy agent to device TTB-DESKTOP', source: 'deployment' },
];

const mockAnalytics = {
  totalUsers: 23,
  activeDevices: 18,
  totalDevices: 25,
  keyRotations: 5,
  avgUptime: 98.5,
  dataTransfer: '2.3 TB',
  alertsToday: 3,
  deploymentsToday: 7
};

export default function TailscaleAdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const wsRef = useRef(null);

  // Simulate real-time updates
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        // Simulate receiving real-time updates
        const now = new Date().toISOString();
        setNotifications(prev => [
          { id: Date.now(), message: 'Cập nhật trạng thái thiết bị', time: now, type: 'info' },
          ...prev.slice(0, 4)
        ]);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const StatusIndicator = ({ status }) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-red-500',
      active: 'bg-green-500',
      inactive: 'bg-gray-500',
      expired: 'bg-red-500'
    };
    return <div className={`w-3 h-3 rounded-full ${colors[status] || 'bg-gray-500'}`} />;
  };

  const StatCard = ({ title, value, change, icon: Icon, color = 'blue' }) => (
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

  const DashboardTab = () => (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Tổng người dùng" 
          value={mockAnalytics.totalUsers} 
          change="+2 tuần này"
          icon={Users} 
          color="blue" 
        />
        <StatCard 
          title="Thiết bị hoạt động" 
          value={`${mockAnalytics.activeDevices}/${mockAnalytics.totalDevices}`} 
          change="+1 hôm nay"
          icon={Monitor} 
          color="green" 
        />
        <StatCard 
          title="Uptime trung bình" 
          value={`${mockAnalytics.avgUptime}%`} 
          change="+0.2%"
          icon={Activity} 
          color="indigo" 
        />
        <StatCard 
          title="Cảnh báo hôm nay" 
          value={mockAnalytics.alertsToday} 
          change="-2 so với hôm qua"
          icon={AlertCircle} 
          color="red" 
        />
      </div>

      {/* Real-time Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Hoạt động thời gian thực</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">{isConnected ? 'Đã kết nối' : 'Mất kết nối'}</span>
            </div>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {mockLogs.slice(0, 5).map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  log.level === 'error' ? 'bg-red-500' : 
                  log.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 break-words">{log.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(log.timestamp).toLocaleString('vi-VN')} • {log.source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Triển khai Windows Agent</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium text-blue-900">Agent Deploy Tool</p>
                <p className="text-sm text-blue-700">Tự động cài đặt và cấu hình Tailscale</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Tải .exe
              </button>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Triển khai hôm nay</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">TTB-DESKTOP</span>
                  <span className="text-sm text-red-600">Thất bại</span>
                </div>
                <div className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">LVC-LAPTOP</span>
                  <span className="text-sm text-green-600">Thành công</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Thống kê sử dụng (7 ngày qua)</h3>
        <div className="h-64 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Biểu đồ thống kê sẽ được hiển thị ở đây</p>
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
        >
          <Plus className="w-4 h-4" />
          Thêm người dùng
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người dùng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thiết bị</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lần cuối</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" className="rounded" />
                  </td>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.devices}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.lastLogin).toLocaleString('vi-VN')}
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
      </div>
    </div>
  );

  const DevicesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý thiết bị</h2>
        <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
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
              {mockDevices.map(device => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{device.name}</span>
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
                    {new Date(device.lastSeen).toLocaleString('vi-VN')}
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
      </div>
    </div>
  );

  const AuthKeysTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Auth Keys</h2>
        <button
          onClick={() => setShowCreateKey(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Tạo key mới
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sử dụng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hết hạn</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockAuthKeys.map(key => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{key.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{key.key}</code>
                      <button className="text-gray-400 hover:text-gray-600">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={key.status} />
                      <span className={`text-sm ${key.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                        {key.status === 'active' ? 'Hoạt động' : 'Hết hạn'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{key.uses}/{key.maxUses}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(key.expiresAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button className="text-blue-600 hover:text-blue-900">Sao chép</button>
                    <button className="text-red-600 hover:text-red-900">Thu hồi</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const DeploymentTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Windows Agent Deployment</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Build Agent
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Tải agent.exe
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cấu hình Agent</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Auth Key URL</label>
              <input
                type="text"
                defaultValue="http://100.96.11.97:9090/authkey.txt"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">IP nội bộ sẽ được ưu tiên</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fallback URL</label>
              <input
                type="text"
                defaultValue="https://auth.csonline-sri.work/authkey.txt"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Security Token</label>
              <input
                type="password"
                defaultValue="att_secure_token_2025"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="autostart" defaultChecked className="rounded" />
              <label htmlFor="autostart" className="text-sm text-gray-700">Tự động khởi động cùng Windows</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="autorepair" defaultChecked className="rounded" />
              <label htmlFor="autorepair" className="text-sm text-gray-700">Tự động sửa chữa khi mất kết nối</label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lịch sử triển khai</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">LVC-LAPTOP</p>
                <p className="text-xs text-green-700">Cài đặt thành công - 10:30 AM</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">TTB-DESKTOP</p>
                <p className="text-xs text-red-700">Lỗi quyền admin - 10:25 AM</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">NVA-LAPTOP</p>
                <p className="text-xs text-green-700">Cập nhật thành công - 09:15 AM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Installation Instructions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hướng dẫn cài đặt Agent</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Tải file <code className="bg-gray-200 px-1 rounded">tailscale-agent.exe</code> từ nút "Tải agent.exe" ở trên</li>
            <li>Chạy file .exe với quyền Administrator (Click phải → "Run as administrator")</li>
            <li>Agent sẽ tự động:</li>
            <ul className="list-disc list-inside ml-4 space-y-1 mt-1">
              <li>Kiểm tra và cài đặt Tailscale nếu chưa có</li>
              <li>Lấy Auth Key từ server</li>
              <li>Kết nối với Tailnet</li>
              <li>Thiết lập tự khởi động cùng Windows</li>
              <li>Tạo log file tại <code>C:\ATT Tail Scale\Logs\tailscalelogs.log</code></li>
            </ul>
            <li>Kiểm tra trạng thái kết nối trong tab "Thiết bị"</li>
          </ol>
        </div>
      </div>
    </div>
  );

  const AnalyticsTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Phân tích nâng cao</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Lưu lượng tuần này" value="2.3 TB" change="+15%" icon={Activity} color="purple" />
        <StatCard title="Xoay key tự động" value="5" change="+2" icon={RefreshCw} color="orange" />
        <StatCard title="Thời gian phản hồi" value="45ms" change="-5ms" icon={Zap} color="green" />
        <StatCard title="Độ tin cậy" value="99.8%" change="+0.1%" icon={Shield} color="blue" />
      </div>

      {/* Network Usage Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sử dụng mạng theo thời gian</h3>
        <div className="h-64 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Biểu đồ lưu lượng mạng</p>
          </div>
        </div>
      </div>

      {/* Device Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hiệu suất thiết bị</h3>
          <div className="space-y-4">
            {mockDevices.map(device => (
              <div key={device.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <StatusIndicator status={device.status} />
                  <div>
                    <p className="text-sm font-medium">{device.name}</p>
                    <p className="text-xs text-gray-500">{device.ip}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{device.status === 'online' ? '< 50ms' : 'N/A'}</p>
                  <p className="text-xs text-gray-500">Ping</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cảnh báo và sự kiện</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Key sắp hết hạn</p>
                <p className="text-xs text-yellow-700">"Employee Key 2025" hết hạn trong 90 ngày</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Thiết bị mất kết nối</p>
                <p className="text-xs text-red-700">TTB-DESKTOP offline hơn 2 giờ</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard', name: 'Tổng quan', icon: BarChart3 },
    { id: 'users', name: 'Người dùng', icon: Users },
    { id: 'devices', name: 'Thiết bị', icon: Monitor },
    { id: 'keys', name: 'Auth Keys', icon: Shield },
    { id: 'deployment', name: 'Triển khai', icon: Download },
    { id: 'analytics', name: 'Phân tích', icon: TrendingUp },
    { id: 'settings', name: 'Cài đặt', icon: Settings },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'users': return <UsersTab />;
      case 'devices': return <DevicesTab />;
      case 'keys': return <AuthKeysTab />;
      case 'deployment': return <DeploymentTab />;
      case 'analytics': return <AnalyticsTab />;
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
              {/* Real-time notifications */}
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
                  <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
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
        {renderTabContent()}
      </main>

      {/* Floating notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-20 right-4 space-y-2 z-50">
          {notifications.slice(0, 3).map(notification => (
            <div
              key={notification.id}
              className="bg-white rounded-lg shadow-lg border p-4 max-w-sm animate-slide-in"
            >
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
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

      <style jsx>{`
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
      `}</style>
    </div>
  );
}
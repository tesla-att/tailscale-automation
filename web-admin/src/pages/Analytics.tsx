import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Progress, Table, Tag, Spin, Alert
} from 'antd';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  WifiOutlined, SecurityScanOutlined, GlobalOutlined, KeyOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/api';
// import ApiTestComponent from '../components/ApiTestComponent';

interface AnalyticsData {
  deviceMetrics: any;
  networkPerformance: any;
  securityEvents: any;
  usageAnalytics: any;
}

const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Get overview data from backend
      const overview = await ApiService.get('/analytics/overview');
      
      // Generate comprehensive mock data for charts based on overview
      const deviceMetrics = {
        total_devices: overview.totalDevices || 0,
        online_devices: overview.activeDevices || 0,
        offline_devices: (overview.totalDevices || 0) - (overview.activeDevices || 0),
        uptime: overview.avgUptime || 0,
        device_types: {
          'Desktop': overview.totalDevices ? Math.floor(overview.totalDevices * 0.4) : 0,
          'Mobile': overview.totalDevices ? Math.floor(overview.totalDevices * 0.3) : 0,
          'Server': overview.totalDevices ? Math.floor(overview.totalDevices * 0.2) : 0,
          'IoT': overview.totalDevices ? Math.floor(overview.totalDevices * 0.1) : 0
        },
        daily_connections: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
          connections: Math.floor(Math.random() * 50) + 20
        }))
      };
      
      const networkPerformance = {
        uptime: overview.avgUptime || 95,
        bandwidth_usage: {
          current: Math.floor(Math.random() * 100) + 50,
          daily_average: 75
        },
        latency: {
          average: Math.floor(Math.random() * 20) + 10
        },
        packet_loss: Math.random() * 0.5
      };
      
      const securityEvents = {
        alertsToday: overview.alertsToday || 0,
        totalEvents: 42,
        resolved: 38,
        failed_auth_attempts: Math.floor(Math.random() * 10) + 2,
        recent_events: [
          {
            timestamp: new Date().toISOString(),
            type: 'key_rotation',
            description: 'Authentication key rotated successfully',
            severity: 'info'
          },
          {
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            type: 'login_attempt',
            description: 'Successful login from authorized device',
            severity: 'info'
          }
        ]
      };
      
      const usageAnalytics = {
        activeUsers: overview.activeUsers || 0,
        totalUsers: overview.totalUsers || 0,
        deploymentsToday: overview.deploymentsToday || 0,
        auth_key_usage: {
          active_keys: Math.floor(Math.random() * 20) + 5
        },
        geographic_distribution: [
          { country: 'US', devices: Math.floor(Math.random() * 100) + 50 },
          { country: 'EU', devices: Math.floor(Math.random() * 80) + 30 },
          { country: 'Asia', devices: Math.floor(Math.random() * 60) + 20 }
        ]
      };

      setData({
        deviceMetrics,
        networkPerformance,
        securityEvents,
        usageAnalytics
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        {/* Loading spinner hidden for cleaner UI */}
        {/* <Spin size="large" /> */}
        <div className="text-gray-500">Loading analytics data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        {/* Error alert hidden for cleaner UI */}
        {/* <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
        /> */}
        <div className="text-red-500">Error loading analytics: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  // Ensure all required data structures exist with fallbacks
  const safeData = {
    deviceMetrics: {
      total_devices: data.deviceMetrics?.total_devices || 0,
      device_types: data.deviceMetrics?.device_types || {},
      daily_connections: data.deviceMetrics?.daily_connections || []
    },
    networkPerformance: {
      uptime: data.networkPerformance?.uptime || 0,
      bandwidth_usage: data.networkPerformance?.bandwidth_usage || { current: 0, daily_average: 1 },
      latency: data.networkPerformance?.latency || { average: 0 },
      packet_loss: data.networkPerformance?.packet_loss || 0
    },
    securityEvents: {
      failed_auth_attempts: data.securityEvents?.failed_auth_attempts || 0,
      recent_events: data.securityEvents?.recent_events || []
    },
    usageAnalytics: {
      auth_key_usage: data.usageAnalytics?.auth_key_usage || { active_keys: 0 },
      geographic_distribution: data.usageAnalytics?.geographic_distribution || []
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Safe data access with fallbacks
  const deviceTypeData = safeData.deviceMetrics.device_types && 
    typeof safeData.deviceMetrics.device_types === 'object' && 
    Object.keys(safeData.deviceMetrics.device_types).length > 0 ? 
    Object.entries(safeData.deviceMetrics.device_types).map(
      ([type, count]) => ({ name: type, value: count })
    ) : [];

  const dailyConnections = safeData.deviceMetrics.daily_connections;
  const geographicDistribution = safeData.usageAnalytics.geographic_distribution;
  const recentEvents = safeData.securityEvents.recent_events;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600">Comprehensive network analytics and insights</p>
      </div>

      {/* API Test Component - Hidden for production */}
      {/* <ApiTestComponent /> */}

      {/* Key Metrics */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Devices"
              value={safeData.deviceMetrics.total_devices}
              prefix={<WifiOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Network Uptime"
              value={safeData.networkPerformance.uptime}
              suffix="%"
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Auth Keys"
              value={safeData.usageAnalytics.auth_key_usage.active_keys}
              prefix={<KeyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Security Events"
              value={safeData.securityEvents.failed_auth_attempts}
              prefix={<SecurityScanOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={16}>
        <Col span={16}>
          <Card title="Daily Connection Trends">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyConnections}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="connections" 
                  stroke="#1890ff" 
                  fill="#1890ff"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Device Types Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={deviceTypeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {deviceTypeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Performance Metrics */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Network Performance">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span>Bandwidth Usage</span>
                  <span>{safeData.networkPerformance.bandwidth_usage.current} GB</span>
                </div>
                <Progress 
                  percent={
                    safeData.networkPerformance.bandwidth_usage.current && safeData.networkPerformance.bandwidth_usage.daily_average ?
                    (safeData.networkPerformance.bandwidth_usage.current / 
                     safeData.networkPerformance.bandwidth_usage.daily_average) * 50 : 0
                  } 
                  status="active"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span>Average Latency</span>
                  <span>{safeData.networkPerformance.latency.average}ms</span>
                </div>
                <Progress 
                  percent={safeData.networkPerformance.latency.average} 
                  status={safeData.networkPerformance.latency.average > 50 ? 'exception' : 'success'}
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span>Packet Loss</span>
                  <span>{(safeData.networkPerformance.packet_loss * 100).toFixed(2)}%</span>
                </div>
                <Progress 
                  percent={safeData.networkPerformance.packet_loss * 10} 
                  status={safeData.networkPerformance.packet_loss > 1 ? 'exception' : 'success'}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Geographic Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={geographicDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="country" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="devices" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Security Events Table */}
      <Card title="Recent Security Events">
        <Table
          dataSource={recentEvents}
          pagination={false}
          columns={[
            {
              title: 'Time',
              dataIndex: 'timestamp',
              render: (timestamp: string) => new Date(timestamp).toLocaleString()
            },
            {
              title: 'Type',
              dataIndex: 'type',
              render: (type: string) => (
                <Tag color={type === 'key_rotation' ? 'blue' : 'green'}>
                  {type.replace('_', ' ').toUpperCase()}
                </Tag>
              )
            },
            {
              title: 'Description',
              dataIndex: 'description'
            },
            {
              title: 'Severity',
              dataIndex: 'severity',
              render: (severity: string) => (
                <Tag color={severity === 'info' ? 'blue' : severity === 'warning' ? 'orange' : 'red'}>
                  {severity.toUpperCase()}
                </Tag>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default Analytics;
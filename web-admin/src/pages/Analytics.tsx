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
      const [deviceMetrics, networkPerformance, securityEvents, usageAnalytics] = 
        await Promise.all([
          ApiService.get('/analytics/device-metrics'),
          ApiService.get('/analytics/network-performance'),
          ApiService.get('/analytics/security-events'),
          ApiService.get('/analytics/usage-analytics')
        ]);

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
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Failed to load analytics"
        description={error}
        type="error"
        showIcon
        action={
          <button onClick={loadAnalytics} className="text-blue-600 underline">
            Retry
          </button>
        }
      />
    );
  }

  if (!data) return null;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const deviceTypeData = Object.entries(data.deviceMetrics.device_types).map(
    ([type, count]) => ({ name: type, value: count })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600">Comprehensive network analytics and insights</p>
      </div>

      {/* Key Metrics */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Devices"
              value={data.deviceMetrics.total_devices}
              prefix={<WifiOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Network Uptime"
              value={data.networkPerformance.uptime}
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
              value={data.usageAnalytics.auth_key_usage.active_keys}
              prefix={<KeyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Security Events"
              value={data.securityEvents.failed_auth_attempts}
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
              <AreaChart data={data.deviceMetrics.daily_connections}>
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
                  <span>{data.networkPerformance.bandwidth_usage.current} GB</span>
                </div>
                <Progress 
                  percent={
                    (data.networkPerformance.bandwidth_usage.current / 
                     data.networkPerformance.bandwidth_usage.daily_average) * 50
                  } 
                  status="active"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span>Average Latency</span>
                  <span>{data.networkPerformance.latency.average}ms</span>
                </div>
                <Progress 
                  percent={data.networkPerformance.latency.average} 
                  status={data.networkPerformance.latency.average > 50 ? 'exception' : 'success'}
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span>Packet Loss</span>
                  <span>{data.networkPerformance.packet_loss}%</span>
                </div>
                <Progress 
                  percent={data.networkPerformance.packet_loss * 10} 
                  status={data.networkPerformance.packet_loss > 1 ? 'exception' : 'success'}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Geographic Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.usageAnalytics.geographic_distribution}>
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
          dataSource={data.securityEvents.recent_events}
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
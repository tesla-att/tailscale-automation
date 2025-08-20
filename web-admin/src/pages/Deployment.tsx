import React, { useState, useEffect } from 'react';
import {
  Card, Button, Table, Steps, Modal, Form, Select, Switch, Input,
  Space, Tag, Progress, notification, Divider, Alert
} from 'antd';
import {
  WindowsOutlined, DownloadOutlined, PlayCircleOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/api';

interface WindowsDevice {
  hostname: string;
  ip_address: string;
  os_version: string;
  architecture: string;
  domain?: string;
  status: string;
}

interface DeploymentConfig {
  auth_key: string;
  tags: string[];
  auto_update: boolean;
  unattended_mode: boolean;
  advertise_routes: string[];
  accept_routes: boolean;
}

const Deployment: React.FC = () => {
  const [devices, setDevices] = useState<WindowsDevice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [scriptModalVisible, setScriptModalVisible] = useState(false);
  const [currentStep] = useState(0);
  const [deploymentScript, setDeploymentScript] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    discoverDevices();
    loadDeployments();
  }, []);

  const discoverDevices = async () => {
    try {
      setLoading(true);
      const discoveredDevices = await ApiService.get('/deployment/discover-devices');
      setDevices(discoveredDevices);
    } catch (error: any) {
      notification.error({
        message: 'Discovery Failed',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDeployments = async () => {
    try {
      const deploymentHistory = await ApiService.get('/deployment/deployments');
      setDeployments(deploymentHistory);
    } catch (error) {
      console.error('Failed to load deployments:', error);
    }
  };

  const generateScript = async (config: DeploymentConfig) => {
    try {
      const response = await ApiService.post('/deployment/generate-script', config);
      
      setDeploymentScript(response.script);
      setScriptModalVisible(true);
    } catch (error: any) {
      notification.error({
        message: 'Script Generation Failed',
        description: error.message
      });
    }
  };

  const executeDeployment = async (config: DeploymentConfig) => {
    try {
      const response = await ApiService.post('/deployment/deploy-bulk', {
        devices: selectedDevices,
        config
      });

      notification.success({
        message: 'Deployment Started',
        description: `Deployment ${response.deployment_id} started for ${selectedDevices.length} devices`
      });

      setDeployModalVisible(false);
      setSelectedDevices([]);
      loadDeployments();
    } catch (error: any) {
      notification.error({
        message: 'Deployment Failed',
        description: error.message
      });
    }
  };

  const handleDeploySubmit = async (values: any) => {
    const config: DeploymentConfig = {
      auth_key: values.auth_key || 'auto-generated-key',
      tags: values.tags || ['tag:windows', 'tag:managed'],
      auto_update: values.auto_update ?? true,
      unattended_mode: values.unattended_mode ?? true,
      advertise_routes: values.advertise_routes?.split(',').filter(Boolean) || [],
      accept_routes: values.accept_routes ?? true
    };

    if (values.action === 'script') {
      await generateScript(config);
    } else {
      await executeDeployment(config);
    }
  };

  const downloadScript = () => {
    const blob = new Blob([deploymentScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tailscale-deploy-${Date.now()}.ps1`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deviceColumns = [
    {
      title: 'Device',
      dataIndex: 'hostname',
      render: (hostname: string, record: WindowsDevice) => (
        <Space>
          <WindowsOutlined />
          <div>
            <div className="font-medium">{hostname}</div>
            <div className="text-sm text-gray-500">{record.ip_address}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'OS Version',
      dataIndex: 'os_version'
    },
    {
      title: 'Architecture',
      dataIndex: 'architecture'
    },
    {
      title: 'Domain',
      dataIndex: 'domain',
      render: (domain: string) => domain || 'Workgroup'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={status === 'discovered' ? 'blue' : 'green'}>
          {status.toUpperCase()}
        </Tag>
      )
    }
  ];

  const deploymentColumns = [
    {
      title: 'Deployment ID',
      dataIndex: 'id',
      render: (id: string) => <code className="text-xs">{id}</code>
    },
    {
      title: 'Devices',
      dataIndex: 'devices',
      render: (devices: string[]) => devices.length
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          started: 'processing',
          completed: 'success',
          failed: 'error'
        };
        return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: 'Progress',
      render: (record: any) => {
        if (record.status === 'started') {
          return <Progress percent={0} status="active" />;
        }
        if (record.results) {
          const success = record.results.filter((r: any) => r.status === 'success').length;
          const total = record.results.length;
          const percent = (success / total) * 100;
          return <Progress percent={percent} status={percent === 100 ? 'success' : 'exception'} />;
        }
        return null;
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Windows Agent Deployment</h1>
          <p className="text-gray-600">Deploy and manage Tailscale agents on Windows devices</p>
        </div>
        <Space>
          <Button icon={<PlayCircleOutlined />} onClick={discoverDevices} loading={loading}>
            Discover Devices
          </Button>
          <Button 
            type="primary" 
            icon={<WindowsOutlined />}
            disabled={selectedDevices.length === 0}
            onClick={() => setDeployModalVisible(true)}
          >
            Deploy to {selectedDevices.length} Device(s)
          </Button>
        </Space>
      </div>

      {/* Deployment Steps */}
      <Card>
        <Steps
          current={currentStep}
          items={[
            {
              title: 'Discover Devices',
              description: 'Scan network for Windows devices',
              icon: <WindowsOutlined />
            },
            {
              title: 'Configure Deployment',
              description: 'Set deployment parameters',
              icon: <ExclamationCircleOutlined />
            },
            {
              title: 'Execute Deployment',
              description: 'Deploy Tailscale agents',
              icon: <PlayCircleOutlined />
            },
            {
              title: 'Monitor Progress',
              description: 'Track deployment status',
              icon: <CheckCircleOutlined />
            }
          ]}
        />
      </Card>

      {/* Discovered Devices */}
      <Card title={`Discovered Windows Devices (${devices.length})`}>
        <Table
          columns={deviceColumns}
          dataSource={devices}
          rowKey="hostname"
          loading={loading}
          rowSelection={{
            selectedRowKeys: selectedDevices,
            onChange: (selectedRowKeys) => setSelectedDevices(selectedRowKeys as string[]),
            getCheckboxProps: (record) => ({
              disabled: record.status !== 'discovered'
            })
          }}
          pagination={false}
        />
      </Card>

      {/* Deployment History */}
      <Card title="Deployment History">
        <Table
          columns={deploymentColumns}
          dataSource={deployments}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Deployment Configuration Modal */}
      <Modal
        title="Configure Deployment"
        open={deployModalVisible}
        onCancel={() => setDeployModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleDeploySubmit}
          initialValues={{
            tags: ['tag:windows', 'tag:managed'],
            auto_update: true,
            unattended_mode: true,
            accept_routes: true
          }}
        >
          <Alert
            message={`Deploying to ${selectedDevices.length} selected devices`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            label="Authentication Key"
            name="auth_key"
            help="Leave empty to auto-generate a new key"
          >
            <Input.Password placeholder="Auto-generate new key" />
          </Form.Item>

          <Form.Item
            label="Device Tags"
            name="tags"
          >
            <Select
              mode="tags"
              placeholder="Add tags for device categorization"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="Advertise Routes"
            name="advertise_routes"
            help="Comma-separated list of subnets to advertise (e.g., 192.168.1.0/24)"
          >
            <Input placeholder="192.168.1.0/24, 10.0.0.0/8" />
          </Form.Item>

          <Divider />

          <Space style={{ width: '100%' }} direction="vertical">
            <Form.Item
              name="auto_update"
              valuePropName="checked"
            >
              <Switch /> Enable automatic updates
            </Form.Item>

            <Form.Item
              name="unattended_mode"
              valuePropName="checked"
            >
              <Switch /> Enable unattended mode
            </Form.Item>

            <Form.Item
              name="accept_routes"
              valuePropName="checked"
            >
              <Switch /> Accept subnet routes
            </Form.Item>
          </Space>

          <Divider />

          <Space>
            <Form.Item name="action" noStyle>
              <Button htmlType="submit" onClick={() => form.setFieldValue('action', 'deploy')} type="primary">
                <PlayCircleOutlined /> Deploy Now
              </Button>
            </Form.Item>
            
            <Form.Item name="action" noStyle>
              <Button htmlType="submit" onClick={() => form.setFieldValue('action', 'script')}>
                <DownloadOutlined /> Generate Script
              </Button>
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Script Download Modal */}
      <Modal
        title="PowerShell Deployment Script"
        open={scriptModalVisible}
        onCancel={() => setScriptModalVisible(false)}
        width={800}
        footer={[
          <Button key="download" type="primary" onClick={downloadScript}>
            <DownloadOutlined /> Download Script
          </Button>
        ]}
      >
        <Alert
          message="PowerShell Script Generated"
          description="Run this script as Administrator on target Windows machines"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
          {deploymentScript}
        </pre>
      </Modal>
    </div>
  );
};

export default Deployment;
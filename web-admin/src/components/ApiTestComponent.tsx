import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';

interface ApiTestData {
  devices: number;
  users: number;
  keys: number;
  analytics: number;
  deployment: number;
  portForwards: number;
  alerts: number;
}

const ApiTestComponent: React.FC = () => {
  const [data, setData] = useState<ApiTestData>({
    devices: 0,
    users: 0,
    keys: 0,
    analytics: 0,
    deployment: 0,
    portForwards: 0,
    alerts: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 ApiTestComponent: Fetching data...');

      // Fetch all endpoints
      const [devicesRes, usersRes, keysRes, analyticsRes, deploymentRes, portForwardsRes, alertsRes] = await Promise.allSettled([
        ApiService.get('/devices'),
        ApiService.get('/users'),
        ApiService.get('/keys'),
        ApiService.get('/analytics/overview'),
        ApiService.get('/deployment'),
        ApiService.get('/port-forwards'),
        ApiService.get('/alerts')
      ]);

      const newData: ApiTestData = {
        devices: devicesRes.status === 'fulfilled' ? (devicesRes.value?.devices?.length || 0) : 0,
        users: usersRes.status === 'fulfilled' ? (usersRes.value?.length || 0) : 0,
        keys: keysRes.status === 'fulfilled' ? (keysRes.value?.length || 0) : 0,
        analytics: analyticsRes.status === 'fulfilled' ? 1 : 0,
        deployment: deploymentRes.status === 'fulfilled' ? (deploymentRes.value?.length || 0) : 0,
        portForwards: portForwardsRes.status === 'fulfilled' ? (portForwardsRes.value?.length || 0) : 0,
        alerts: alertsRes.status === 'fulfilled' ? (alertsRes.value?.length || 0) : 2
      };

      console.log('✅ ApiTestComponent: New data:', newData);
      setData(newData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('❌ ApiTestComponent: Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🧪 API Test Component</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Last Update: {lastUpdate.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          ❌ Error: {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="text-2xl font-bold text-blue-700">{data.devices}</div>
          <div className="text-sm text-blue-600">Devices</div>
        </div>
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <div className="text-2xl font-bold text-green-700">{data.users}</div>
          <div className="text-sm text-green-600">Users</div>
        </div>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded">
          <div className="text-2xl font-bold text-purple-700">{data.keys}</div>
          <div className="text-sm text-purple-600">Keys</div>
        </div>
        <div className="p-3 bg-teal-50 border border-teal-200 rounded">
          <div className="text-2xl font-bold text-teal-700">{data.analytics}</div>
          <div className="text-sm text-teal-600">Analytics</div>
        </div>
        <div className="p-3 bg-cyan-50 border border-cyan-200 rounded">
          <div className="text-2xl font-bold text-cyan-700">{data.deployment}</div>
          <div className="text-sm text-cyan-600">Deployment</div>
        </div>
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
          <div className="text-2xl font-bold text-indigo-700">{data.portForwards}</div>
          <div className="text-sm text-indigo-600">Port Forwards</div>
        </div>
        <div className="p-3 bg-orange-50 border border-orange-200 rounded">
          <div className="text-2xl font-bold text-orange-700">{data.alerts}</div>
          <div className="text-sm text-orange-600">Alerts</div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
        <div className="font-semibold mb-2">🔍 Debug Info:</div>
        <div>Loading: {loading ? 'Yes' : 'No'}</div>
        <div>Error: {error || 'None'}</div>
        <div>Data: {JSON.stringify(data, null, 2)}</div>
      </div>
    </div>
  );
};

export default ApiTestComponent;

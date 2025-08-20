const API_BASE = 'http://localhost:8000/api';

export class ApiService {
  static async get(endpoint: string) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  }

  static async post(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  }

  // Analytics endpoints
  static getAnalytics() {
    return this.get('/analytics/overview');
  }

  static getNetworkUsage(days = 7) {
    return this.get(`/analytics/network-usage?days=${days}`);
  }

  static getDevicePerformance() {
    return this.get('/analytics/device-performance');
  }

  // Deployment endpoints
  static buildAgent(config: any) {
    return this.post('/deployment/build-agent', config);
  }

  static getDeploymentHistory() {
    return this.get('/deployment/deployment-history');
  }
}
const API_BASE = 'http://localhost:8000/api';

class ApiError extends Error {
  status?: number;
  code?: string;
  
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class ApiService {
  private static async handleResponse(response: Response) {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // If we can't parse JSON, use the default error message
      }
      
      throw new ApiError(errorMessage, response.status);
    }
    
    try {
      return await response.json();
    } catch {
      return null; // For responses with no body
    }
  }

  static async get(endpoint: string) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network errors, CORS, etc.
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('Unable to connect to server. Please check if the backend is running.');
      }
      
      throw new ApiError(`Network error: ${(error as Error).message}`);
    }
  }

  static async post(endpoint: string, data: any) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network errors, CORS, etc.
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('Unable to connect to server. Please check if the backend is running.');
      }
      
      throw new ApiError(`Network error: ${(error as Error).message}`);
    }
  }

  static async put(endpoint: string, data: any) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('Unable to connect to server. Please check if the backend is running.');
      }
      
      throw new ApiError(`Network error: ${(error as Error).message}`);
    }
  }

  static async delete(endpoint: string) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('Unable to connect to server. Please check if the backend is running.');
      }
      
      throw new ApiError(`Network error: ${(error as Error).message}`);
    }
  }

  // Health check - bypass API_BASE for healthz endpoint
  static async checkHealth() {
    try {
      const response = await fetch('http://localhost:8000/healthz');
      if (!response.ok) throw new Error('Health check failed');
      return await response.json();
    } catch {
      throw new ApiError('Backend server is not responding. Please start the server using ./start-system.sh');
    }
  }



  // Check if server is running
  static async isServerRunning(): Promise<boolean> {
    try {
      await this.checkHealth();
      return true;
    } catch {
      return false;
    }
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

  // Device endpoints
  static getDevices() {
    return this.get('/devices');
  }

  // User endpoints
  static getUsers() {
    return this.get('/users');
  }

  static createUser(userData: { name: string; email: string }) {
    return this.post('/users', userData);
  }

  // Auth Key endpoints
  static getAuthKeys() {
    return this.get('/keys');
  }

  static createAuthKey(keyData: any) {
    return this.post('/keys', keyData);
  }

  static revokeAuthKey(keyId: string) {
    return this.post(`/keys/${keyId}/revoke`, {});
  }

  // Port Forward endpoints
  static getPortForwards() {
    return this.get('/port-forwards');
  }

  static createPortForward(data: any) {
    return this.post('/port-forwards', data);
  }

  static updatePortForward(id: string, data: any) {
    return this.put(`/port-forwards/${id}`, data);
  }

  static deletePortForward(id: string) {
    return this.delete(`/port-forwards/${id}`);
  }

  static togglePortForward(id: string) {
    return this.post(`/port-forwards/${id}/toggle`, {});
  }
}
const axios = require('axios');
const crypto = require('crypto');

class TailscaleService {
    constructor(logger) {
        this.logger = logger;
        this.clientId = process.env.TAILSCALE_CLIENT_ID;
        this.clientSecret = process.env.TAILSCALE_CLIENT_SECRET;
        this.tailnet = process.env.TAILSCALE_TAILNET;
        this.baseURL = 'https://api.tailscale.com/api/v2';
        this.accessToken = null;
        this.tokenExpiry = null;
        
        this.isConfigured = !!(this.clientId && this.clientSecret && this.tailnet);
        if (!this.isConfigured) {
            this.logger.warn('Tailscale configuration incomplete. Some features may not work properly.', {
                category: 'SYSTEM',
                hasClientId: !!this.clientId,
                hasClientSecret: !!this.clientSecret,
                hasTailnet: !!this.tailnet
            });
        }
    }

    // Get OAuth access token with retry logic
    async getAccessToken(retries = 3) {
        if (!this.isConfigured) {
            throw new Error('Tailscale not configured. Please set TAILSCALE_CLIENT_ID, TAILSCALE_CLIENT_SECRET, and TAILSCALE_TAILNET');
        }
        
        // Return cached token if still valid
        if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.accessToken;
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                this.logger.info('Requesting Tailscale OAuth token', {
                    category: 'AUTH',
                    attempt,
                    clientId: this.clientId.substring(0, 10) + '...'
                });

                const response = await axios.post(
                    'https://api.tailscale.com/api/v2/oauth/token',
                    new URLSearchParams({
                        'client_id': this.clientId,
                        'client_secret': this.clientSecret,
                        'grant_type': 'client_credentials',
                        'scope': 'device'
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Accept': 'application/json'
                        },
                        timeout: 30000
                    }
                );

                if (response.data.access_token) {
                    this.accessToken = response.data.access_token;
                    // Set expiry 5 minutes before actual expiry for safety
                    const expiresIn = response.data.expires_in || 3600;
                    this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);

                    this.logger.info('OAuth token obtained successfully', {
                        category: 'AUTH',
                        expiresIn,
                        expiryTime: this.tokenExpiry.toISOString()
                    });

                    return this.accessToken;
                }

                throw new Error('No access token in response');

            } catch (error) {
                this.logger.error(`OAuth token request failed (attempt ${attempt}/${retries})`, {
                    category: 'AUTH',
                    error: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    responseData: error.response?.data
                });

                if (attempt === retries) {
                    throw new Error(`Failed to obtain OAuth token after ${retries} attempts: ${error.message}`);
                }

                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    // Create authenticated request headers
    async getAuthHeaders() {
        const token = await this.getAccessToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    // Create new auth key with enhanced options
    async createAuthKey(options = {}) {
        const defaultOptions = {
            reusable: true,
            ephemeral: false,
            preauthorized: true,
            tags: ['tag:employee'],
            expiryDays: 90,
            description: `Auto-generated key ${new Date().toISOString()}`
        };

        const keyOptions = { ...defaultOptions, ...options };

        try {
            const headers = await this.getAuthHeaders();
            
            // Calculate expiry timestamp
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + keyOptions.expiryDays);

            const requestData = {
                capabilities: {
                    devices: {
                        create: {
                            reusable: keyOptions.reusable,
                            ephemeral: keyOptions.ephemeral,
                            preauthorized: keyOptions.preauthorized,
                            tags: keyOptions.tags
                        }
                    }
                },
                expirySeconds: keyOptions.expiryDays * 24 * 60 * 60,
                description: keyOptions.description
            };

            this.logger.info('Creating new auth key', {
                category: 'AUTH',
                tailnet: this.tailnet,
                options: keyOptions
            });

            const response = await axios.post(
                `${this.baseURL}/tailnet/${this.tailnet}/keys`,
                requestData,
                {
                    headers,
                    timeout: 30000
                }
            );

            const keyData = response.data;
            
            this.logger.info('Auth key created successfully', {
                category: 'AUTH',
                keyId: keyData.id,
                keyPrefix: keyData.key.substring(0, 20) + '...',
                expires: expiryDate.toISOString()
            });

            return {
                id: keyData.id,
                key: keyData.key,
                created: new Date().toISOString(),
                expires: expiryDate.toISOString(),
                capabilities: requestData.capabilities,
                description: keyOptions.description,
                tags: keyOptions.tags
            };

        } catch (error) {
            this.logger.error('Failed to create auth key', {
                category: 'AUTH',
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseData: error.response?.data,
                tailnet: this.tailnet
            });

            // Provide more specific error messages
            if (error.response?.status === 401) {
                throw new Error('Authentication failed. Please check your Tailscale client ID and secret.');
            } else if (error.response?.status === 403) {
                throw new Error('Access forbidden. Please check your OAuth client permissions.');
            } else if (error.response?.status === 404) {
                throw new Error(`Tailnet not found: ${this.tailnet}. Please check your tailnet name.`);
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Request timeout. Please check your internet connection.');
            }

            throw new Error(`Tailscale API error: ${error.message}`);
        }
    }

    // List all auth keys
    async listAuthKeys() {
        try {
            const headers = await this.getAuthHeaders();
            
            const response = await axios.get(
                `${this.baseURL}/tailnet/${this.tailnet}/keys`,
                {
                    headers,
                    timeout: 30000
                }
            );

            return response.data.keys || [];

        } catch (error) {
            this.logger.error('Failed to list auth keys', {
                category: 'AUTH',
                error: error.message,
                status: error.response?.status
            });
            throw error;
        }
    }

    // Delete auth key
    async deleteAuthKey(keyId) {
        try {
            const headers = await this.getAuthHeaders();
            
            await axios.delete(
                `${this.baseURL}/tailnet/${this.tailnet}/keys/${keyId}`,
                {
                    headers,
                    timeout: 30000
                }
            );

            this.logger.info('Auth key deleted successfully', {
                category: 'AUTH',
                keyId
            });

            return true;

        } catch (error) {
            this.logger.error('Failed to delete auth key', {
                category: 'AUTH',
                error: error.message,
                keyId,
                status: error.response?.status
            });
            throw error;
        }
    }

    // Get device list
    async getDevices() {
        try {
            const headers = await this.getAuthHeaders();
            
            const response = await axios.get(
                `${this.baseURL}/tailnet/${this.tailnet}/devices`,
                {
                    headers,
                    timeout: 30000
                }
            );

            return response.data.devices || [];

        } catch (error) {
            this.logger.error('Failed to get devices', {
                category: 'AUTH',
                error: error.message,
                status: error.response?.status
            });
            throw error;
        }
    }

    // Test API connectivity
    async testConnection() {
        try {
            const token = await this.getAccessToken();
            
            this.logger.info('Testing Tailscale API connection', {
                category: 'AUTH',
                tailnet: this.tailnet
            });

            // Try to list devices as a simple test
            await this.getDevices();

            return {
                success: true,
                message: 'Successfully connected to Tailscale API',
                tailnet: this.tailnet,
                tokenExpiry: this.tokenExpiry
            };

        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error.response?.data || error.message
            };
        }
    }

    // Generate a secure random string for descriptions
    generateSecureId() {
        return crypto.randomBytes(8).toString('hex');
    }
}

module.exports = TailscaleService;

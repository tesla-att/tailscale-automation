const redis = require('redis');
const axios = require('axios');
const winston = require('winston');
const cron = require('cron');
const fs = require('fs').promises;
const path = require('path');

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/logs/scheduler.log' }),
    new winston.transports.Console()
  ]
});

// Redis client configuration
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD,
  database: process.env.REDIS_DB || 0
});

// Connect to Redis
redisClient.connect().catch((err) => {
  logger.error('Redis connection failed:', err);
});

// Tailscale API configuration
const TAILSCALE_API_KEY = process.env.TAILSCALE_API_KEY;
const TAILNET = process.env.TAILNET;
const CONFIG_DIR = process.env.CONFIG_DIR || '/config';

const tailscaleAPI = axios.create({
  baseURL: 'https://api.tailscale.com/api/v2',
  headers: {
    'Authorization': `Bearer ${TAILSCALE_API_KEY}`
  }
});

// Auth key renewal function
async function checkAndRenewAuthKeys() {
  logger.info('Starting auth key renewal check...');
  
  try {
    // Read employees config
    const configPath = path.join(CONFIG_DIR, 'employees.json');
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    
    // Get devices from Tailscale
    const devicesResponse = await tailscaleAPI.get(`/tailnet/${TAILNET}/devices`);
    const devices = devicesResponse.data.devices;
    
    for (const employee of config.employees) {
      // Check if device is online
      const device = devices.find(d => d.hostname === employee.hostname);
      
      if (!device || !device.online) {
        logger.warn(`Device offline for employee ${employee.id}, checking auth key...`);
        
        // Check if auth key exists in Redis
        const existingKey = await redisClient.get(`authkey:${employee.id}`);
        
        if (!existingKey) {
          logger.info(`Creating new auth key for ${employee.id}`);
          
          // Create new auth key
          const response = await tailscaleAPI.post(`/tailnet/${TAILNET}/keys`, {
            capabilities: {
              devices: {
                create: {
                  reusable: false,
                  ephemeral: false,
                  preauthorized: true,
                  tags: ["tag:employee"]
                }
              }
            },
            expirySeconds: parseInt(process.env.AUTH_KEY_EXPIRY) || 2592000,
            description: `Auto-renewed for ${employee.id}`
          });
          
          const authKey = response.data.key;
          await redisClient.setEx(`authkey:${employee.id}`, 2592000, authKey);
          
          logger.info(`Auth key renewed for ${employee.id}`);
        }
      }
    }
    
  } catch (error) {
    logger.error('Error in auth key renewal:', error);
  }
}

// Device monitoring function
async function monitorDevices() {
  logger.info('Monitoring device status...');
  
  try {
    const devicesResponse = await tailscaleAPI.get(`/tailnet/${TAILNET}/devices`);
    const devices = devicesResponse.data.devices;
    
    const onlineDevices = devices.filter(d => d.online).length;
    const totalDevices = devices.length;
    
    logger.info(`Device status: ${onlineDevices}/${totalDevices} online`);
    
    // Store status in Redis
    await redisClient.setEx('device_status', 300, JSON.stringify({
      online: onlineDevices,
      total: totalDevices,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    logger.error('Error monitoring devices:', error);
  }
}

// Schedule jobs
logger.info('Starting Tailscale automation scheduler...');

// Auth key renewal - every 24 hours
const renewalJob = new cron.CronJob('0 2 * * *', checkAndRenewAuthKeys);
renewalJob.start();

// Device monitoring - every 5 minutes  
const monitorJob = new cron.CronJob('*/5 * * * *', monitorDevices);
monitorJob.start();

logger.info('Scheduler started successfully');

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutting down scheduler...');
  renewalJob.stop();
  monitorJob.stop();
  redisClient.quit();
  process.exit(0);
});
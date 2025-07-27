#!/bin/bash

# =================================================================
# QUICK COMMANDS SUMMARY - Chạy tuần tự để fix issues
# =================================================================

echo "🚀 TAILSCALE AUTOMATION - QUICK UPDATE COMMANDS"
echo "Run these commands in order to fix your current issues"
echo "================================================================"

echo "
📋 OVERVIEW:
Your current issues:
❌ API Server: Redis connection ECONNREFUSED ::1:6379  
❌ Scheduler: Cannot find module '/app/scheduler.js'

We will fix these by:
✅ Updating Redis config in API server
✅ Creating missing scheduler.js file  
✅ Adding proper environment variables
✅ Rebuilding containers with fixes
"

echo "⚠️  IMPORTANT: Backup your current files first!"
echo "================================================================"

# =================================================================
# STEP 1: BACKUP CURRENT FILES
# =================================================================

echo "
📦 STEP 1: Backup current files
================================================================"

echo "# Create backups"
echo "cp api/server.js api/server.js.backup"
echo "cp .env .env.backup"
echo "cp docker-compose.yml docker-compose.yml.backup"

echo "
💡 Copy and run these commands:
cp api/server.js api/server.js.backup
cp .env .env.backup  
cp docker-compose.yml docker-compose.yml.backup
"

# =================================================================
# STEP 2: CREATE MISSING SCHEDULER FILE
# =================================================================

echo "
📁 STEP 2: Create missing scheduler.js
================================================================"

cat << 'EOF_SCHEDULER'
# Create the scheduler file
cat > scheduler/scheduler.js << 'EOF'
const redis = require('redis');
const axios = require('axios');
const winston = require('winston');
const cron = require('cron');
const fs = require('fs').promises;
const path = require('path');

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

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB) || 0
});

redisClient.connect().catch((err) => {
  logger.error('Redis connection failed:', err);
});

redisClient.on('connect', () => {
  logger.info('✅ Scheduler connected to Redis successfully');
});

const TAILSCALE_API_KEY = process.env.TAILSCALE_API_KEY;
const TAILNET = process.env.TAILNET;
const CONFIG_DIR = process.env.CONFIG_DIR || '/config';

const tailscaleAPI = axios.create({
  baseURL: 'https://api.tailscale.com/api/v2',
  headers: { 'Authorization': `Bearer ${TAILSCALE_API_KEY}` }
});

async function checkAndRenewAuthKeys() {
  logger.info('🔄 Starting auth key renewal check...');
  try {
    const configPath = path.join(CONFIG_DIR, 'employees.json');
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    
    const devicesResponse = await tailscaleAPI.get(`/tailnet/${TAILNET}/devices`);
    const devices = devicesResponse.data.devices;
    
    for (const employee of config.employees) {
      const device = devices.find(d => d.hostname === employee.hostname);
      if (!device || !device.online) {
        const existingKey = await redisClient.get(`authkey:${employee.id}`);
        if (!existingKey) {
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
            expirySeconds: 2592000,
            description: `Auto-renewed for ${employee.id}`
          });
          
          await redisClient.setEx(`authkey:${employee.id}`, 2592000, response.data.key);
          logger.info(`✅ Auth key renewed for ${employee.id}`);
        }
      }
    }
  } catch (error) {
    logger.error('❌ Error in auth key renewal:', error);
  }
}

async function monitorDevices() {
  try {
    const devicesResponse = await tailscaleAPI.get(`/tailnet/${TAILNET}/devices`);
    const devices = devicesResponse.data.devices;
    const onlineDevices = devices.filter(d => d.online).length;
    
    await redisClient.setEx('device_status', 300, JSON.stringify({
      online: onlineDevices,
      total: devices.length,
      timestamp: new Date().toISOString()
    }));
    
    logger.info(`📊 Device status: ${onlineDevices}/${devices.length} online`);
  } catch (error) {
    logger.error('❌ Error monitoring devices:', error);
  }
}

logger.info('🚀 Starting Tailscale scheduler...');

const renewalJob = new cron.CronJob('0 2 * * *', checkAndRenewAuthKeys);
const monitorJob = new cron.CronJob('*/5 * * * *', monitorDevices);

renewalJob.start();
monitorJob.start();

logger.info('✅ Scheduler started successfully');

process.on('SIGTERM', () => {
  renewalJob.stop();
  monitorJob.stop();
  redisClient.quit();
  process.exit(0);
});
EOF
EOF_SCHEDULER

echo "
💡 Copy and run this command to create scheduler.js:
"

echo 'cat > scheduler/scheduler.js << '"'"'EOF'"'"'
const redis = require("redis");
const axios = require("axios");
const winston = require("winston");
const cron = require("cron");
const fs = require("fs").promises;
const path = require("path");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: "/logs/scheduler.log" }),
    new winston.transports.Console()
  ]
});

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB) || 0
});

redisClient.connect().catch((err) => logger.error("Redis connection failed:", err));
redisClient.on("connect", () => logger.info("✅ Scheduler connected to Redis"));

const TAILSCALE_API_KEY = process.env.TAILSCALE_API_KEY;
const TAILNET = process.env.TAILNET;
const CONFIG_DIR = process.env.CONFIG_DIR || "/config";

const tailscaleAPI = axios.create({
  baseURL: "https://api.tailscale.com/api/v2",
  headers: { Authorization: `Bearer ${TAILSCALE_API_KEY}` }
});

async function checkAndRenewAuthKeys() {
  logger.info("🔄 Starting auth key renewal check...");
  try {
    const data = await fs.readFile(path.join(CONFIG_DIR, "employees.json"), "utf8");
    const config = JSON.parse(data);
    const devices = (await tailscaleAPI.get(`/tailnet/${TAILNET}/devices`)).data.devices;
    
    for (const employee of config.employees) {
      const device = devices.find(d => d.hostname === employee.hostname);
      if (!device || !device.online) {
        const existingKey = await redisClient.get(`authkey:${employee.id}`);
        if (!existingKey) {
          const response = await tailscaleAPI.post(`/tailnet/${TAILNET}/keys`, {
            capabilities: { devices: { create: { reusable: false, ephemeral: false, preauthorized: true, tags: ["tag:employee"] }}},
            expirySeconds: 2592000,
            description: `Auto-renewed for ${employee.id}`
          });
          await redisClient.setEx(`authkey:${employee.id}`, 2592000, response.data.key);
          logger.info(`✅ Auth key renewed for ${employee.id}`);
        }
      }
    }
  } catch (error) {
    logger.error("❌ Error in auth key renewal:", error);
  }
}

async function monitorDevices() {
  try {
    const devices = (await tailscaleAPI.get(`/tailnet/${TAILNET}/devices`)).data.devices;
    const onlineDevices = devices.filter(d => d.online).length;
    await redisClient.setEx("device_status", 300, JSON.stringify({
      online: onlineDevices, total: devices.length, timestamp: new Date().toISOString()
    }));
    logger.info(`📊 Device status: ${onlineDevices}/${devices.length} online`);
  } catch (error) {
    logger.error("❌ Error monitoring devices:", error);
  }
}

logger.info("🚀 Starting Tailscale scheduler...");
const renewalJob = new cron.CronJob("0 2 * * *", checkAndRenewAuthKeys);
const monitorJob = new cron.CronJob("*/5 * * * *", monitorDevices);
renewalJob.start();
monitorJob.start();
logger.info("✅ Scheduler started successfully");

process.on("SIGTERM", () => {
  renewalJob.stop();
  monitorJob.stop();
  redisClient.quit();
  process.exit(0);
});
EOF'

# =================================================================
# STEP 3: FIX REDIS CONFIG IN API SERVER
# =================================================================

echo "
🔧 STEP 3: Fix Redis config in api/server.js
================================================================"

echo "
💡 Edit api/server.js and make these changes:

1. Find this line (around line 30-40):
   const client = redis.createClient({

2. Replace the entire Redis configuration section with:

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB) || 0
});

redisClient.connect().catch((err) => {
  logger.error('Redis connection failed:', err);
});

redisClient.on('connect', () => {
  logger.info('✅ Connected to Redis successfully');
});

3. Find and replace ALL instances of:
   - 'client.' with 'redisClient.'
   - Use Ctrl+H (Find & Replace) in your editor
"

# =================================================================
# STEP 4: UPDATE ENVIRONMENT VARIABLES
# =================================================================

echo "
🔐 STEP 4: Add Redis variables to .env
================================================================"

echo "# Add Redis configuration to .env file"
echo 'echo "" >> .env'
echo 'echo "# Redis Configuration" >> .env'
echo 'echo "REDIS_HOST=redis" >> .env'
echo 'echo "REDIS_PORT=6379" >> .env'
echo 'echo "REDIS_DB=0" >> .env'

echo "
💡 Copy and run these commands:
echo \"\" >> .env
echo \"# Redis Configuration\" >> .env
echo \"REDIS_HOST=redis\" >> .env
echo \"REDIS_PORT=6379\" >> .env
echo \"REDIS_DB=0\" >> .env
"

# =================================================================
# STEP 5: FIX REDIS MEMORY WARNING
# =================================================================

echo "
⚙️  STEP 5: Fix Redis memory warning
================================================================"

echo "# Fix Redis memory overcommit warning"
echo 'echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf'
echo 'sudo sysctl vm.overcommit_memory=1'

echo "
💡 Copy and run these commands:
echo \"vm.overcommit_memory = 1\" | sudo tee -a /etc/sysctl.conf
sudo sysctl vm.overcommit_memory=1
"

# =================================================================
# STEP 6: REBUILD AND START
# =================================================================

echo "
🔨 STEP 6: Rebuild and start containers
================================================================"

echo "# Stop, rebuild, and restart containers"
echo "docker-compose down"
echo "docker-compose build --no-cache"
echo "docker-compose up -d"

echo "
💡 Copy and run these commands:
docker-compose down
docker-compose build --no-cache  
docker-compose up -d
"

# =================================================================
# STEP 7: VERIFY EVERYTHING WORKS
# =================================================================

echo "
✅ STEP 7: Verify everything works
================================================================"

echo "# Check container status"
echo "docker-compose ps"
echo ""
echo "# Check API health"  
echo "curl http://localhost:3000/health"
echo ""
echo "# Check web interface"
echo "curl -I http://localhost:8080"
echo ""
echo "# View logs"
echo "docker-compose logs -f"

echo "
💡 Copy and run these commands:
docker-compose ps
curl http://localhost:3000/health
curl -I http://localhost:8080
"

# =================================================================
# SUMMARY
# =================================================================

echo "
🎯 SUMMARY - Copy and run ALL these commands in order:
================================================================

# 1. Backup files
cp api/server.js api/server.js.backup
cp .env .env.backup

# 2. Create scheduler.js (run the long command above)

# 3. Manually edit api/server.js:
#    - Change 'client' to 'redisClient' 
#    - Update Redis configuration with socket

# 4. Add Redis variables to .env
echo \"\" >> .env
echo \"# Redis Configuration\" >> .env  
echo \"REDIS_HOST=redis\" >> .env
echo \"REDIS_PORT=6379\" >> .env
echo \"REDIS_DB=0\" >> .env

# 5. Fix Redis memory
echo \"vm.overcommit_memory = 1\" | sudo tee -a /etc/sysctl.conf
sudo sysctl vm.overcommit_memory=1

# 6. Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 7. Verify
docker-compose ps
curl http://localhost:3000/health

================================================================
🎉 After completing all steps, your system should work!
🌐 Access: http://localhost:8080
🔑 Login: admin / admin123
================================================================
"

echo "
🆘 Need help? 
- Check individual file templates in the detailed guide
- Run verification script to see what's missing
- View logs: docker-compose logs -f
"
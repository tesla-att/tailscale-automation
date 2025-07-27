const express = require('express');
const axios = require('axios');
const cors = require('cors');
const redis = require('redis');
const winston = require('winston');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.API_PORT || 3000;

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/logs/api.log' }),
    new winston.transports.Console()
  ]
});

// Redis client configuration - FIX REDIS CONNECTION
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
  }
});

// Connect to Redis
redisClient.connect().catch((err) => {
  logger.error('Redis connection failed:', err);
});

redisClient.on('error', (err) => {
  logger.error('Redis error:', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis successfully');
});

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    redis: redisClient.isReady ? 'connected' : 'disconnected'
  });
});

// API Routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Simple auth - in production use proper user management
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (username === adminUser && password === adminPass) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET || 'default-secret');
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Get all employees
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const configPath = path.join(CONFIG_DIR, 'employees.json');
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    res.json(config.employees);
  } catch (error) {
    logger.error('Error reading employees config:', error);
    res.status(500).json({ error: 'Failed to read employees configuration' });
  }
});

// Add new employee
app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    const newEmployee = req.body;
    const configPath = path.join(CONFIG_DIR, 'employees.json');
    
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    
    // Add timestamp
    newEmployee.created_at = new Date().toISOString();
    newEmployee.status = 'active';
    
    config.employees.push(newEmployee);
    config.metadata.total_employees = config.employees.length;
    config.metadata.last_updated = new Date().toISOString();
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    logger.info(`Added new employee: ${newEmployee.id}`);
    res.json({ success: true, employee: newEmployee });
  } catch (error) {
    logger.error('Error adding employee:', error);
    res.status(500).json({ error: 'Failed to add employee' });
  }
});

// Create auth key for employee
app.post('/api/employees/:id/authkey', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;
    
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
      description: `Auto-generated for ${employeeId}`
    });
    
    const authKey = response.data.key;
    
    // Store in Redis with expiration
    if (redisClient.isReady) {
      await redisClient.setEx(`authkey:${employeeId}`, 2592000, authKey);
    }
    
    logger.info(`Created auth key for employee: ${employeeId}`);
    res.json({ authKey, employeeId });
  } catch (error) {
    logger.error('Error creating auth key:', error);
    res.status(500).json({ error: 'Failed to create auth key' });
  }
});

// Get devices status
app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const response = await tailscaleAPI.get(`/tailnet/${TAILNET}/devices`);
    res.json(response.data.devices);
  } catch (error) {
    logger.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Generate deployment script
app.get('/api/employees/:id/script/:os', authenticateToken, async (req, res) => {
  try {
    const { id, os } = req.params;
    
    // Get auth key from Redis
    let authKey;
    if (redisClient.isReady) {
      authKey = await redisClient.get(`authkey:${id}`);
    }
    
    if (!authKey) {
      return res.status(404).json({ error: 'Auth key not found. Please generate one first.' });
    }
    
    // Get employee data
    const configPath = path.join(CONFIG_DIR, 'employees.json');
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    const employee = config.employees.find(emp => emp.id === id);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    let script = '';
    const hostname = employee.hostname;
    
    switch (os) {
      case 'windows':
        script = generateWindowsScript(id, authKey, hostname);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="deploy_${id}_windows.ps1"`);
        break;
      case 'macos':
        script = generateMacOSScript(id, authKey, hostname);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="deploy_${id}_macos.sh"`);
        break;
      case 'linux':
        script = generateLinuxScript(id, authKey, hostname);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="deploy_${id}_linux.sh"`);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported OS' });
    }
    
    res.send(script);
  } catch (error) {
    logger.error('Error generating script:', error);
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

// Script generation functions
function generateWindowsScript(employeeId, authKey, hostname) {
  return `# Tailscale Auto-Deploy Script for Windows
# Employee: ${employeeId}

Write-Host "Installing Tailscale for ${employeeId}..."

# Download and install Tailscale
$url = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
$output = "$env:TEMP\\tailscale-setup.exe"
Invoke-WebRequest -Uri $url -OutFile $output

Start-Process -FilePath $output -ArgumentList "/quiet" -Wait

# Wait for service to start
Start-Sleep -Seconds 10

# Connect with auth key
& "C:\\Program Files\\Tailscale\\tailscale.exe" up --authkey="${authKey}" --hostname="${hostname}" --accept-routes

Write-Host "Tailscale installed and configured successfully!"`;
}

function generateMacOSScript(employeeId, authKey, hostname) {
  return `#!/bin/bash
# Tailscale Auto-Deploy Script for macOS
# Employee: ${employeeId}

echo "Installing Tailscale for ${employeeId}..."

# Download and install Tailscale
curl -o /tmp/Tailscale.pkg https://pkgs.tailscale.com/stable/Tailscale-latest.pkg
sudo installer -pkg /tmp/Tailscale.pkg -target /

# Connect with auth key
sudo tailscale up --authkey="${authKey}" --hostname="${hostname}" --accept-routes

echo "Tailscale installed and configured successfully!"`;
}

function generateLinuxScript(employeeId, authKey, hostname) {
  return `#!/bin/bash
# Tailscale Auto-Deploy Script for Linux
# Employee: ${employeeId}

echo "Installing Tailscale for ${employeeId}..."

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Connect with auth key
sudo tailscale up --authkey="${authKey}" --hostname="${hostname}" --accept-routes

echo "Tailscale installed and configured successfully!"`;
}

// Start server
app.listen(port, () => {
  logger.info(`Tailscale Manager API server running on port ${port}`);
});


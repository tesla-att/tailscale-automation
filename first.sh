#!/bin/bash
# Tailscale Automation Quick Deployment Script
# Tạo hệ thống hoàn chỉnh trong 10 phút

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 TAILSCALE AUTOMATION DEPLOYMENT${NC}"
echo "=================================="
echo ""

# Check dependencies
check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Dependencies OK${NC}"
}

# Create project structure
create_structure() {
    echo "📁 Creating project structure..."
    
    mkdir -p {backend/{api,services,config},frontend/public/{css,js},scripts/{generators,templates},docker,data/{logs,config}}
    
    echo -e "${GREEN}✅ Project structure created${NC}"
}

# Create backend API
create_backend() {
    echo "⚙️ Creating backend API..."
    
    # package.json
    cat > backend/package.json << 'EOF'
{
  "name": "tailscale-automation-backend",
  "version": "1.0.0",
  "description": "Tailscale automation backend API",
  "main": "api/server.js",
  "scripts": {
    "start": "node api/server.js",
    "dev": "nodemon api/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "winston": "^3.8.2",
    "axios": "^1.4.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "multer": "^1.4.5",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOF

    # Main server
    cat > backend/api/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DATA_DIR = '/app/data';
const CONFIG_DIR = `${DATA_DIR}/config`;
const LOGS_DIR = `${DATA_DIR}/logs`;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: `${LOGS_DIR}/error.log`, level: 'error' }),
    new winston.transports.File({ filename: `${LOGS_DIR}/combined.log` }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Initialize data directories
async function initializeDirectories() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.mkdir(LOGS_DIR, { recursive: true });
    
    // Initialize employees.json if not exists
    const employeesFile = path.join(CONFIG_DIR, 'employees.json');
    try {
      await fs.access(employeesFile);
    } catch {
      await fs.writeFile(employeesFile, JSON.stringify({ employees: [] }, null, 2));
    }
    
    // Initialize authkeys.json if not exists
    const authkeysFile = path.join(CONFIG_DIR, 'authkeys.json');
    try {
      await fs.access(authkeysFile);
    } catch {
      await fs.writeFile(authkeysFile, JSON.stringify({ keys: [] }, null, 2));
    }
    
    logger.info('Data directories initialized');
  } catch (error) {
    logger.error('Failed to initialize directories:', error);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Simple admin check (replace with proper user management)
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { username } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all employees
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const data = await fs.readFile(path.join(CONFIG_DIR, 'employees.json'), 'utf8');
    const config = JSON.parse(data);
    res.json(config.employees);
  } catch (error) {
    logger.error('Error reading employees:', error);
    res.status(500).json({ error: 'Failed to read employees' });
  }
});

// Add employee
app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    const { name, email, department, os } = req.body;
    const id = uuidv4();
    const hostname = `${name.toLowerCase().replace(/\s+/g, '-')}-${id.substr(0, 8)}`;
    
    const employee = {
      id,
      name,
      email,
      department,
      os,
      hostname,
      created: new Date().toISOString(),
      status: 'pending'
    };
    
    const configPath = path.join(CONFIG_DIR, 'employees.json');
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    
    config.employees.push(employee);
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    logger.info(`Employee added: ${name} (${id})`);
    res.json(employee);
  } catch (error) {
    logger.error('Error adding employee:', error);
    res.status(500).json({ error: 'Failed to add employee' });
  }
});

// Generate auth key
app.post('/api/authkeys/generate', authenticateToken, async (req, res) => {
  try {
    // This is a mock implementation
    // In production, you would call Tailscale API here
    const authKey = `tskey-auth-${uuidv4()}`;
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    
    const key = {
      key: authKey,
      created: new Date().toISOString(),
      expires: expiresAt.toISOString(),
      used: false,
      tags: ['tag:employee']
    };
    
    const authkeysPath = path.join(CONFIG_DIR, 'authkeys.json');
    const data = await fs.readFile(authkeysPath, 'utf8');
    const config = JSON.parse(data);
    
    config.keys.push(key);
    
    await fs.writeFile(authkeysPath, JSON.stringify(config, null, 2));
    
    logger.info('Auth key generated');
    res.json({ authKey, expires: expiresAt });
  } catch (error) {
    logger.error('Error generating auth key:', error);
    res.status(500).json({ error: 'Failed to generate auth key' });
  }
});

// Generate script
app.get('/api/scripts/:id/:os', authenticateToken, async (req, res) => {
  try {
    const { id, os } = req.params;
    
    // Get current auth key
    const authkeysPath = path.join(CONFIG_DIR, 'authkeys.json');
    const authData = await fs.readFile(authkeysPath, 'utf8');
    const authConfig = JSON.parse(authData);
    const authKey = authConfig.keys.find(key => !key.used)?.key;
    
    if (!authKey) {
      return res.status(400).json({ error: 'No auth key available. Please generate one first.' });
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
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  initializeDirectories();
});
EOF

    echo -e "${GREEN}✅ Backend API created${NC}"
}

# Create frontend
create_frontend() {
    echo "🎨 Creating frontend interface..."
    
    # Main HTML
    cat > frontend/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tailscale Automation</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-gray-100">
    <!-- Login Modal -->
    <div id="login-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-8 rounded-lg shadow-lg w-96">
            <h2 class="text-2xl font-bold mb-6 text-center">Tailscale Admin</h2>
            <form id="login-form">
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Username</label>
                    <input type="text" id="username" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" required>
                </div>
                <div class="mb-6">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Password</label>
                    <input type="password" id="password" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500" required>
                </div>
                <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">
                    Login
                </button>
            </form>
        </div>
    </div>

    <!-- Main App -->
    <div id="app" class="hidden">
        <!-- Header -->
        <header class="bg-white shadow-md">
            <div class="container mx-auto px-4 py-4 flex justify-between items-center">
                <h1 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-network-wired mr-2 text-blue-500"></i>
                    Tailscale Automation
                </h1>
                <button id="logout-btn" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-sign-out-alt mr-2"></i>Logout
                </button>
            </div>
        </header>

        <!-- Navigation -->
        <nav class="bg-blue-500 text-white">
            <div class="container mx-auto px-4">
                <div class="flex space-x-8">
                    <button class="nav-tab active py-4 px-2 border-b-2 border-transparent hover:border-white" data-tab="dashboard">
                        <i class="fas fa-tachometer-alt mr-2"></i>Dashboard
                    </button>
                    <button class="nav-tab py-4 px-2 border-b-2 border-transparent hover:border-white" data-tab="employees">
                        <i class="fas fa-users mr-2"></i>Employees
                    </button>
                    <button class="nav-tab py-4 px-2 border-b-2 border-transparent hover:border-white" data-tab="scripts">
                        <i class="fas fa-download mr-2"></i>Scripts
                    </button>
                </div>
            </div>
        </nav>

        <!-- Content -->
        <main class="container mx-auto px-4 py-8">
            <!-- Dashboard Tab -->
            <div id="dashboard-tab" class="tab-content">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-white p-6 rounded-lg shadow-md">
                        <div class="flex items-center">
                            <div class="p-3 rounded-full bg-blue-100 text-blue-500 mr-4">
                                <i class="fas fa-users text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-gray-500 text-sm">Total Employees</p>
                                <p class="text-3xl font-bold" id="total-employees">0</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow-md">
                        <div class="flex items-center">
                            <div class="p-3 rounded-full bg-green-100 text-green-500 mr-4">
                                <i class="fas fa-check-circle text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-gray-500 text-sm">Connected</p>
                                <p class="text-3xl font-bold text-green-500" id="connected-devices">0</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow-md">
                        <div class="flex items-center">
                            <div class="p-3 rounded-full bg-yellow-100 text-yellow-500 mr-4">
                                <i class="fas fa-key text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-gray-500 text-sm">Auth Keys</p>
                                <p class="text-3xl font-bold" id="total-keys">0</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <h3 class="text-lg font-bold mb-4">Recent Activity</h3>
                    <div id="activity-log" class="space-y-2">
                        <p class="text-gray-500">No recent activity</p>
                    </div>
                </div>
            </div>

            <!-- Employees Tab -->
            <div id="employees-tab" class="tab-content hidden">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-bold">Employee Management</h2>
                    <button id="add-employee-btn" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-plus mr-2"></i>Add Employee
                    </button>
                </div>
                
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left">Name</th>
                                <th class="px-4 py-3 text-left">Email</th>
                                <th class="px-4 py-3 text-left">Department</th>
                                <th class="px-4 py-3 text-left">OS</th>
                                <th class="px-4 py-3 text-left">Status</th>
                                <th class="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="employees-table">
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Scripts Tab -->
            <div id="scripts-tab" class="tab-content hidden">
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <h2 class="text-xl font-bold mb-6">Generate Installation Scripts</h2>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">Employee</label>
                            <select id="script-employee" class="w-full px-3 py-2 border rounded-lg">
                                <option value="">Select Employee</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">Operating System</label>
                            <select id="script-os" class="w-full px-3 py-2 border rounded-lg">
                                <option value="">Select OS</option>
                                <option value="windows">Windows</option>
                                <option value="macos">macOS</option>
                                <option value="linux">Linux</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button id="generate-script-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-download mr-2"></i>Download Script
                            </button>
                        </div>
                    </div>
                    
                    <div class="border-t pt-6">
                        <h3 class="font-bold mb-4">Auth Key Management</h3>
                        <button id="generate-authkey-btn" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-key mr-2"></i>Generate New Auth Key
                        </button>
                        <div id="authkey-status" class="mt-4 p-4 bg-gray-100 rounded-lg">
                            <p class="text-sm text-gray-600">No auth key generated yet</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Add Employee Modal -->
    <div id="add-employee-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div class="bg-white p-8 rounded-lg shadow-lg w-96">
            <h3 class="text-xl font-bold mb-4">Add New Employee</h3>
            <form id="add-employee-form">
                <div class="mb-4">
                    <label class="block text-gray-700 font-bold mb-2">Name</label>
                    <input type="text" id="employee-name" class="w-full px-3 py-2 border rounded-lg" required>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-bold mb-2">Email</label>
                    <input type="email" id="employee-email" class="w-full px-3 py-2 border rounded-lg" required>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-bold mb-2">Department</label>
                    <input type="text" id="employee-department" class="w-full px-3 py-2 border rounded-lg" required>
                </div>
                <div class="mb-6">
                    <label class="block text-gray-700 font-bold mb-2">Operating System</label>
                    <select id="employee-os" class="w-full px-3 py-2 border rounded-lg" required>
                        <option value="">Select OS</option>
                        <option value="windows">Windows</option>
                        <option value="macos">macOS</option>
                        <option value="linux">Linux</option>
                    </select>
                </div>
                <div class="flex space-x-4">
                    <button type="button" id="cancel-employee-btn" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg">
                        Cancel
                    </button>
                    <button type="submit" class="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg">
                        Add Employee
                    </button>
                </div>
            </form>
        </div>
    </div>

    <script src="js/app.js"></script>
</body>
</html>
EOF

    # Main JavaScript
    cat > frontend/public/js/app.js << 'EOF'
class TailscaleApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.apiBase = window.location.origin + '/api';
        
        this.init();
    }
    
    init() {
        if (this.token) {
            this.showApp();
            this.loadDashboard();
        } else {
            this.showLogin();
        }
        
        this.bindEvents();
    }
    
    bindEvents() {
        // Login
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        
        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Employee management
        document.getElementById('add-employee-btn').addEventListener('click', () => this.showAddEmployeeModal());
        document.getElementById('cancel-employee-btn').addEventListener('click', () => this.hideAddEmployeeModal());
        document.getElementById('add-employee-form').addEventListener('submit', (e) => this.handleAddEmployee(e));
        
        // Script generation
        document.getElementById('generate-authkey-btn').addEventListener('click', () => this.generateAuthKey());
        document.getElementById('generate-script-btn').addEventListener('click', () => this.generateScript());
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('token', this.token);
                this.showApp();
                this.loadDashboard();
            } else {
                alert('Login failed: ' + data.error);
            }
        } catch (error) {
            alert('Login error: ' + error.message);
        }
    }
    
    logout() {
        this.token = null;
        localStorage.removeItem('token');
        this.showLogin();
    }
    
    showLogin() {
        document.getElementById('login-modal').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }
    
    showApp() {
        document.getElementById('login-modal').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }
    
    switchTab(tabName) {
        // Update nav
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active', 'border-white');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active', 'border-white');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        
        // Load tab data
        switch (tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'employees':
                this.loadEmployees();
                break;
            case 'scripts':
                this.loadScriptOptions();
                break;
        }
    }
    
    async loadDashboard() {
        try {
            const employees = await this.fetchEmployees();
            document.getElementById('total-employees').textContent = employees.length;
            document.getElementById('connected-devices').textContent = employees.filter(e => e.status === 'connected').length;
            document.getElementById('total-keys').textContent = '1'; // Mock data
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    }
    
    async loadEmployees() {
        try {
            const employees = await this.fetchEmployees();
            const tbody = document.getElementById('employees-table');
            
            tbody.innerHTML = employees.map(emp => `
                <tr>
                    <td class="px-4 py-3">${emp.name}</td>
                    <td class="px-4 py-3">${emp.email}</td>
                    <td class="px-4 py-3">${emp.department}</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            ${emp.os}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 text-xs rounded-full ${emp.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${emp.status}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <button onclick="app.downloadScript('${emp.id}', '${emp.os}')" class="text-blue-500 hover:text-blue-700 mr-2">
                            <i class="fas fa-download"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Failed to load employees:', error);
        }
    }
    
    async loadScriptOptions() {
        try {
            const employees = await this.fetchEmployees();
            const select = document.getElementById('script-employee');
            
            select.innerHTML = '<option value="">Select Employee</option>' +
                employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
        } catch (error) {
            console.error('Failed to load script options:', error);
        }
    }
    
    async fetchEmployees() {
        const response = await fetch(`${this.apiBase}/employees`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch employees');
        return await response.json();
    }
    
    showAddEmployeeModal() {
        document.getElementById('add-employee-modal').classList.remove('hidden');
    }
    
    hideAddEmployeeModal() {
        document.getElementById('add-employee-modal').classList.add('hidden');
        document.getElementById('add-employee-form').reset();
    }
    
    async handleAddEmployee(e) {
        e.preventDefault();
        
        const employeeData = {
            name: document.getElementById('employee-name').value,
            email: document.getElementById('employee-email').value,
            department: document.getElementById('employee-department').value,
            os: document.getElementById('employee-os').value
        };
        
        try {
            const response = await fetch(`${this.apiBase}/employees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(employeeData)
            });
            
            if (response.ok) {
                this.hideAddEmployeeModal();
                this.loadEmployees();
                this.loadDashboard();
                alert('Employee added successfully!');
            } else {
                const error = await response.json();
                alert('Failed to add employee: ' + error.error);
            }
        } catch (error) {
            alert('Error adding employee: ' + error.message);
        }
    }
    
    async generateAuthKey() {
        try {
            const response = await fetch(`${this.apiBase}/authkeys/generate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                document.getElementById('authkey-status').innerHTML = `
                    <p class="text-sm font-medium text-green-600">Auth Key Generated Successfully</p>
                    <p class="text-xs text-gray-500 mt-1">Expires: ${new Date(data.expires).toLocaleDateString()}</p>
                `;
            } else {
                alert('Failed to generate auth key: ' + data.error);
            }
        } catch (error) {
            alert('Error generating auth key: ' + error.message);
        }
    }
    
    async generateScript() {
        const employeeId = document.getElementById('script-employee').value;
        const os = document.getElementById('script-os').value;
        
        if (!employeeId || !os) {
            alert('Please select both employee and operating system');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/scripts/${employeeId}/${os}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = response.headers.get('Content-Disposition').split('filename=')[1].replace(/"/g, '');
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const error = await response.json();
                alert('Failed to generate script: ' + error.error);
            }
        } catch (error) {
            alert('Error generating script: ' + error.message);
        }
    }
    
    async downloadScript(employeeId, os) {
        try {
            const response = await fetch(`${this.apiBase}/scripts/${employeeId}/${os}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = response.headers.get('Content-Disposition').split('filename=')[1].replace(/"/g, '');
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const error = await response.json();
                alert('Failed to download script: ' + error.error);
            }
        } catch (error) {
            alert('Error downloading script: ' + error.message);
        }
    }
}

// Initialize app
const app = new TailscaleApp();
EOF

    # Custom CSS
    cat > frontend/public/css/style.css << 'EOF'
.nav-tab.active {
    border-bottom-color: white !important;
}

.tab-content {
    animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.modal {
    backdrop-filter: blur(4px);
}

.card {
    transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}
EOF

    echo -e "${GREEN}✅ Frontend interface created${NC}"
}

# Create Docker configuration
create_docker() {
    echo "🐳 Creating Docker configuration..."
    
    # Docker Compose
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: ../docker/backend.Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - JWT_SECRET=your-jwt-secret-change-in-production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend.Dockerfile
    ports:
      - "8080:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  data:
EOF

    # Backend Dockerfile
    cat > docker/backend.Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p /app/data/{config,logs}

# Set permissions
RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["npm", "start"]
EOF

    # Frontend Dockerfile
    cat > docker/frontend.Dockerfile << 'EOF'
FROM nginx:alpine

# Copy frontend files
COPY public/ /usr/share/nginx/html/

# Copy nginx configuration
COPY ../docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

    # Nginx configuration
    cat > docker/nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check proxy
    location /health {
        proxy_pass http://backend:3000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend files
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    echo -e "${GREEN}✅ Docker configuration created${NC}"
}

# Main deployment function
main() {
    echo -e "${BLUE}Starting Tailscale Automation deployment...${NC}"
    echo ""
    
    check_dependencies
    create_structure
    create_backend
    create_frontend
    create_docker
    
    echo ""
    echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Start the system:"
    echo -e "   ${YELLOW}docker-compose up -d${NC}"
    echo ""
    echo "2. Access the web interface:"
    echo -e "   ${YELLOW}http://localhost:8080${NC}"
    echo ""
    echo "3. Login credentials:"
    echo -e "   ${YELLOW}Username: admin${NC}"
    echo -e "   ${YELLOW}Password: admin123${NC}"
    echo ""
    echo "4. Check system status:"
    echo -e "   ${YELLOW}docker-compose ps${NC}"
    echo -e "   ${YELLOW}docker-compose logs -f${NC}"
    echo ""
    echo -e "${GREEN}Your Tailscale automation system is ready! 🚀${NC}"
}

# Run deployment
main

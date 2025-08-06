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
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DATA_DIR = '/app/data';
const CONFIG_DIR = `${DATA_DIR}/config`;
const LOGS_DIR = `${DATA_DIR}/logs`;

// Redis client
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
  }
});

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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

// Initialize Redis connection
async function initializeRedis() {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Redis connection failed:', error);
  }
}

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
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    redis: redisClient.isOpen ? 'connected' : 'disconnected'
  });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Simple admin check (replace with proper user management in production)
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
      logger.info(`Admin login successful from ${req.ip}`);
      res.json({ token, user: { username } });
    } else {
      logger.warn(`Failed login attempt for username: ${username} from ${req.ip}`);
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
    // This is a mock implementation using the initial auth key
    // In production, you would call Tailscale API here
    const authKey = process.env.INITIAL_AUTH_KEY || `tskey-auth-${uuidv4()}`;
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
    
    // Cache in Redis
    await redisClient.set('latest_authkey', authKey, { EX: 90 * 24 * 60 * 60 });
    
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
    
    // Get current auth key from Redis or config
    let authKey = await redisClient.get('latest_authkey');
    
    if (!authKey) {
      // Fallback to config file
      const authkeysPath = path.join(CONFIG_DIR, 'authkeys.json');
      const authData = await fs.readFile(authkeysPath, 'utf8');
      const authConfig = JSON.parse(authData);
      authKey = authConfig.keys.find(key => !key.used)?.key || process.env.INITIAL_AUTH_KEY;
    }
    
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
    const companyName = process.env.COMPANY_NAME || 'YourCompany';
    
    switch (os) {
      case 'windows':
        script = generateWindowsScript(id, authKey, hostname, companyName, employee);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="Install_Tailscale_${id}.ps1"`);
        break;
      case 'macos':
        script = generateMacOSScript(id, authKey, hostname, companyName, employee);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="install_tailscale_${id}.sh"`);
        break;
      case 'linux':
        script = generateLinuxScript(id, authKey, hostname, companyName, employee);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="install_tailscale_${id}.sh"`);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported OS' });
    }
    
    logger.info(`Script generated for ${employee.name} (${os})`);
    res.send(script);
  } catch (error) {
    logger.error('Error generating script:', error);
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

// Script generation functions
function generateWindowsScript(employeeId, authKey, hostname, companyName, employee) {
  return `# Tailscale Auto-Deploy Script for Windows
# Employee: ${employee.name} (${employeeId})
# Company: ${companyName}
# Generated: ${new Date().toISOString()}

param(
    [switch]$Unattended = $false
)

$EMPLOYEE_ID = "${employeeId}"
$EMPLOYEE_NAME = "${employee.name}"
$EMPLOYEE_EMAIL = "${employee.email}"
$HOSTNAME = "${hostname}"
$AUTH_KEY = "${authKey}"
$COMPANY_NAME = "${companyName}"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-ColorOutput "🚀 TAILSCALE INSTALLER FOR $COMPANY_NAME" -Color "Cyan"
Write-ColorOutput "Employee: $EMPLOYEE_NAME" -Color "White"
Write-ColorOutput "Email: $EMPLOYEE_EMAIL" -Color "White"
Write-ColorOutput "Computer: $env:COMPUTERNAME" -Color "White"
Write-ColorOutput ""

if (!(Test-AdminPrivileges)) {
    Write-ColorOutput "❌ Administrator privileges required!" -Color "Red"
    Write-ColorOutput "Please right-click and select 'Run as administrator'" -Color "Yellow"
    if (!$Unattended) { Read-Host "Press Enter to exit" }
    exit 1
}

try {
    Write-ColorOutput "📦 Installing Tailscale..." -Color "Blue"
    
    $installerUrl = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
    $installerPath = "$env:TEMP\\tailscale-setup.exe"
    
    Write-ColorOutput "📥 Downloading installer..." -Color "Yellow"
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    
    Write-ColorOutput "🔧 Installing..." -Color "Yellow"
    Start-Process -FilePath $installerPath -ArgumentList "/quiet" -Wait -NoNewWindow
    
    Start-Sleep -Seconds 15
    
    $tailscalePath = "C:\\Program Files\\Tailscale\\tailscale.exe"
    if (Test-Path $tailscalePath) {
        Write-ColorOutput "✅ Tailscale installed successfully" -Color "Green"
    } else {
        throw "Installation verification failed"
    }
    
    Write-ColorOutput "🔗 Connecting to company network..." -Color "Blue"
    
    $arguments = @(
        "up",
        "--authkey=$AUTH_KEY",
        "--hostname=$HOSTNAME",
        "--accept-routes"
    )
    
    $process = Start-Process -FilePath $tailscalePath -ArgumentList $arguments -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -eq 0) {
        Write-ColorOutput "✅ Successfully connected to company network" -Color "Green"
        
        Write-ColorOutput ""
        Write-ColorOutput "🎉 INSTALLATION COMPLETED SUCCESSFULLY!" -Color "Green"
        Write-ColorOutput "✅ You are now connected to the $COMPANY_NAME network" -Color "Green"
        Write-ColorOutput "✅ Tailscale will auto-start with Windows" -Color "Green"
        Write-ColorOutput ""
    } else {
        throw "Failed to connect to network"
    }
    
} catch {
    Write-ColorOutput "❌ Installation failed: $($_.Exception.Message)" -Color "Red"
    exit 1
} finally {
    if (!$Unattended) {
        Write-ColorOutput "Press Enter to finish..." -Color "White"
        Read-Host
    }
}`;
}

function generateMacOSScript(employeeId, authKey, hostname, companyName, employee) {
  return `#!/bin/bash
# Tailscale Auto-Deploy Script for macOS
# Employee: ${employee.name} (${employeeId})
# Company: ${companyName}
# Generated: ${new Date().toISOString()}

EMPLOYEE_ID="${employeeId}"
EMPLOYEE_NAME="${employee.name}"
EMPLOYEE_EMAIL="${employee.email}"
HOSTNAME="${hostname}"
AUTH_KEY="${authKey}"
COMPANY_NAME="${companyName}"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

print_colored() {
    echo -e "\${1}\${2}\${NC}"
}

check_admin() {
    if [[ $EUID -ne 0 ]]; then
        print_colored "$RED" "❌ This script requires sudo privileges!"
        echo "Please run: sudo ./install_tailscale.sh"
        exit 1
    fi
}

print_colored "$BLUE" "🚀 TAILSCALE INSTALLER FOR $COMPANY_NAME"
echo "=================================================="
print_colored "$NC" "Employee: $EMPLOYEE_NAME"
print_colored "$NC" "Email: $EMPLOYEE_EMAIL"
print_colored "$NC" "Computer: $(hostname)"
echo ""

check_admin

print_colored "$BLUE" "📦 Installing Tailscale..."

TEMP_DIR=$(mktemp -d)
PKG_FILE="$TEMP_DIR/Tailscale.pkg"

print_colored "$YELLOW" "📥 Downloading Tailscale..."
if curl -L -o "$PKG_FILE" "https://pkgs.tailscale.com/stable/Tailscale-latest.pkg"; then
    print_colored "$YELLOW" "🔧 Installing package..."
    if installer -pkg "$PKG_FILE" -target /; then
        print_colored "$GREEN" "✅ Tailscale installed successfully"
        sleep 10
    else
        print_colored "$RED" "❌ Package installation failed"
        exit 1
    fi
else
    print_colored "$RED" "❌ Download failed"
    exit 1
fi

print_colored "$BLUE" "🔗 Connecting to company network..."

if tailscale up --authkey="$AUTH_KEY" --hostname="$HOSTNAME" --accept-routes; then
    print_colored "$GREEN" "✅ Successfully connected to company network"
    
    echo ""
    print_colored "$GREEN" "🎉 INSTALLATION COMPLETED SUCCESSFULLY!"
    echo "=================================================="
    print_colored "$GREEN" "✅ You are now connected to the $COMPANY_NAME network"
    print_colored "$GREEN" "✅ Tailscale will start automatically on boot"
    echo ""
    
else
    print_colored "$RED" "❌ Failed to connect to network"
    exit 1
fi

rm -rf "$TEMP_DIR"

print_colored "$NC" "Press Enter to finish..."
read`;
}

function generateLinuxScript(employeeId, authKey, hostname, companyName, employee) {
  return `#!/bin/bash
# Tailscale Auto-Deploy Script for Linux
# Employee: ${employee.name} (${employeeId})
# Company: ${companyName}
# Generated: ${new Date().toISOString()}

EMPLOYEE_ID="${employeeId}"
EMPLOYEE_NAME="${employee.name}"
EMPLOYEE_EMAIL="${employee.email}"
HOSTNAME="${hostname}"
AUTH_KEY="${authKey}"
COMPANY_NAME="${companyName}"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

print_colored() {
    echo -e "\${1}\${2}\${NC}"
}

check_sudo() {
    if [[ $EUID -ne 0 ]]; then
        print_colored "$RED" "❌ This script requires sudo privileges!"
        echo "Please run: sudo ./install_tailscale.sh"
        exit 1
    fi
}

print_colored "$BLUE" "🚀 TAILSCALE INSTALLER FOR $COMPANY_NAME"
echo "=================================================="
print_colored "$NC" "Employee: $EMPLOYEE_NAME"
print_colored "$NC" "Email: $EMPLOYEE_EMAIL"
print_colored "$NC" "Computer: $(hostname)"
echo ""

check_sudo

print_colored "$BLUE" "📦 Installing Tailscale..."

print_colored "$YELLOW" "📥 Downloading and running Tailscale installer..."

if curl -fsSL https://tailscale.com/install.sh | sh; then
    print_colored "$GREEN" "✅ Tailscale installed successfully"
    systemctl enable --now tailscaled
    sleep 5
else
    print_colored "$RED" "❌ Installation failed"
    exit 1
fi

print_colored "$BLUE" "🔗 Connecting to company network..."

if tailscale up --authkey="$AUTH_KEY" --hostname="$HOSTNAME" --accept-routes; then
    print_colored "$GREEN" "✅ Successfully connected to company network"
    
    echo ""
    print_colored "$GREEN" "🎉 INSTALLATION COMPLETED SUCCESSFULLY!"
    echo "=================================================="
    print_colored "$GREEN" "✅ You are now connected to the $COMPANY_NAME network"
    print_colored "$GREEN" "✅ Tailscale service is configured and running"
    echo ""
    
else
    print_colored "$RED" "❌ Failed to connect to network"
    exit 1
fi

print_colored "$NC" "Press Enter to finish..."
read`;
}

// Start server
async function startServer() {
  try {
    await initializeRedis();
    await initializeDirectories();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
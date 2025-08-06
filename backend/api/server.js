require('dotenv').config();
// Advanced Backend API Server
// Complete implementation with database, logging, and Windows script generation

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

// Import our custom modules
const DatabaseManager = require('../database/database');
const { EnhancedLogger } = require('../utils/logger');
const User = require('../models/User');
const TailscaleService = require('../services/TailscaleService');
const AuthKeyManager = require('../services/AuthKeyManager');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Initialize database and logger
const db = new DatabaseManager();
const logger = new EnhancedLogger(db);
let userModel, tailscaleService, authKeyManager;

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    message: 'Too many authentication attempts, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        category: 'HTTP',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        req
    });
    next();
});

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        logger.warn('Access attempt without token', {
            category: 'AUTH',
            ip: req.ip,
            req
        });
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            logger.warn('Invalid token used', {
                category: 'AUTH',
                ip: req.ip,
                error: err.message,
                req
            });
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Initialize services
async function initializeServices() {
    try {
        await db.connect();
        
        userModel = new User(db, logger);
        tailscaleService = new TailscaleService(logger);
        authKeyManager = new AuthKeyManager(db, tailscaleService, logger);
        
        logger.info('All services initialized successfully', {
            category: 'SYSTEM'
        });
    } catch (error) {
        logger.error('Failed to initialize services', {
            category: 'SYSTEM',
            error: error.message
        });
        process.exit(1);
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        database: db.db ? 'connected' : 'disconnected'
    });
});

// Authentication endpoints
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Simple admin check (in production, use proper user management)
        const validUsername = process.env.ADMIN_USERNAME || 'admin';
        const validPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        if (username === validUsername && password === validPassword) {
            const token = jwt.sign(
                { 
                    username, 
                    role: 'admin',
                    iat: Math.floor(Date.now() / 1000)
                }, 
                JWT_SECRET, 
                { expiresIn: '24h' }
            );
            
            logger.logAuth('Admin login successful', {
                username,
                ip: req.ip,
                req
            });
            
            res.json({ 
                token, 
                user: { username, role: 'admin' },
                expiresIn: '24h'
            });
        } else {
            logger.logAuth('Login attempt failed', {
                username,
                ip: req.ip,
                req
            });
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        logger.error('Login error', {
            category: 'AUTH',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User management endpoints
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filters = {
            search: req.query.search,
            department: req.query.department,
            status: req.query.status
        };
        
        const result = await userModel.getAll(page, limit, filters);
        
        logger.info('Users fetched', {
            category: 'USER',
            count: result.users.length,
            page,
            filters,
            req
        });
        
        res.json(result);
    } catch (error) {
        logger.error('Error fetching users', {
            category: 'USER',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await userModel.getById(id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        logger.error('Error fetching user', {
            category: 'USER',
            error: error.message,
            userId: req.params.id,
            req
        });
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { name, email, department, position, computer_name, notes } = req.body;
        
        // Validation
        if (!name || !email || !department) {
            return res.status(400).json({ 
                error: 'Name, email, and department are required' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                error: 'Invalid email format' 
            });
        }
        
        const user = await userModel.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            department: department.trim(),
            position: position?.trim() || '',
            computer_name: computer_name?.trim() || '',
            notes: notes?.trim() || ''
        }, req);
        
        logger.info('User created successfully', {
            category: 'USER',
            userId: user.id,
            userName: user.name,
            req
        });
        
        res.status(201).json(user);
    } catch (error) {
        if (error.message.includes('Email already exists')) {
            return res.status(409).json({ error: error.message });
        }
        
        logger.error('Error creating user', {
            category: 'USER',
            error: error.message,
            userData: req.body,
            req
        });
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Validate email if provided
        if (updateData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updateData.email)) {
                return res.status(400).json({ 
                    error: 'Invalid email format' 
                });
            }
            updateData.email = updateData.email.trim().toLowerCase();
        }
        
        // Trim string fields
        ['name', 'department', 'position', 'computer_name', 'notes'].forEach(field => {
            if (updateData[field] !== undefined) {
                updateData[field] = updateData[field]?.trim() || '';
            }
        });
        
        const user = await userModel.update(id, updateData, req);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        logger.info('User updated successfully', {
            category: 'USER',
            userId: id,
            changes: updateData,
            req
        });
        
        res.json(user);
    } catch (error) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('Email already exists')) {
            return res.status(409).json({ error: error.message });
        }
        
        logger.error('Error updating user', {
            category: 'USER',
            error: error.message,
            userId: req.params.id,
            req
        });
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const success = await userModel.delete(id, req);
        
        if (!success) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        logger.info('User deleted successfully', {
            category: 'USER',
            userId: id,
            req
        });
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        logger.error('Error deleting user', {
            category: 'USER',
            error: error.message,
            userId: req.params.id,
            req
        });
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

app.get('/api/users/departments', authenticateToken, async (req, res) => {
    try {
        const departments = await db.all(`
            SELECT department, COUNT(*) as count
            FROM users
            GROUP BY department
            ORDER BY count DESC
        `);
        
        res.json(departments);
    } catch (error) {
        logger.error('Error fetching departments', {
            category: 'USER',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

app.get('/api/users/statistics', authenticateToken, async (req, res) => {
    try {
        const statistics = await userModel.getStatistics();
        res.json(statistics);
    } catch (error) {
        logger.error('Error fetching user statistics', {
            category: 'USER',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Auth key management endpoints
app.get('/api/auth-keys', authenticateToken, async (req, res) => {
    try {
        const authKeys = await authKeyManager.getAllAuthKeys();
        
        logger.info('Auth keys fetched', {
            category: 'AUTH',
            count: authKeys.length,
            req
        });
        
        res.json(authKeys);
    } catch (error) {
        logger.error('Error fetching auth keys', {
            category: 'AUTH',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to fetch auth keys' });
    }
});

app.get('/api/auth-keys/status', authenticateToken, async (req, res) => {
    try {
        const activeKey = await authKeyManager.getActiveAuthKey();
        const statistics = await authKeyManager.getStatistics();
        
        res.json({
            activeKey,
            statistics
        });
    } catch (error) {
        logger.error('Error fetching auth key status', {
            category: 'AUTH',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to fetch auth key status' });
    }
});

app.post('/api/auth-keys/generate', authenticateToken, async (req, res) => {
    try {
        const options = {
            description: `Windows deployment key - Generated by ${req.user.username} - ${new Date().toISOString()}`,
            expiryDays: 90,
            tags: ['tag:employee', 'tag:windows']
        };
        
        const authKey = await authKeyManager.createAuthKey(options, req);
        
        logger.info('Auth key generated successfully', {
            category: 'AUTH',
            keyId: authKey.id,
            req
        });
        
        res.json({
            success: true,
            authKey: authKey.key,
            keyId: authKey.id,
            expires: authKey.expires,
            message: 'Auth key generated successfully'
        });
    } catch (error) {
        logger.error('Error generating auth key', {
            category: 'AUTH',
            error: error.message,
            req
        });
        
        if (error.message.includes('Authentication failed')) {
            return res.status(401).json({ error: 'Tailscale authentication failed. Please check your API credentials.' });
        }
        
        res.status(500).json({ 
            error: 'Failed to generate auth key: ' + error.message 
        });
    }
});

// Script generation endpoints
app.post('/api/scripts/generate', authenticateToken, async (req, res) => {
    try {
        const { userUuid, scriptType = 'powershell', platform = 'windows' } = req.body;
        
        if (!userUuid) {
            return res.status(400).json({ error: 'User UUID is required' });
        }
        
        // Get user details
        const user = await userModel.getByUuid(userUuid);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get active auth key
        const activeKey = await authKeyManager.ensureValidAuthKey(req);
        if (!activeKey) {
            return res.status(500).json({ error: 'No valid auth key available' });
        }
        
        // Generate script based on type
        let script, filename, contentType;
        
        if (scriptType === 'powershell') {
            script = generateWindowsPowerShellScript(user, activeKey.auth_key);
            filename = `Tailscale_Install_${user.name.replace(/\s+/g, '_')}_${user.uuid.substring(0, 8)}.ps1`;
            contentType = 'application/x-powershell';
        } else if (scriptType === 'batch') {
            script = generateWindowsBatchScript(user, activeKey.auth_key);
            filename = `Tailscale_Install_${user.name.replace(/\s+/g, '_')}_${user.uuid.substring(0, 8)}.bat`;
            contentType = 'application/x-msdos-program';
        } else {
            return res.status(400).json({ error: 'Unsupported script type' });
        }
        
        // Record key usage
        await authKeyManager.recordKeyUsage(activeKey.id, user.id, req);
        
        // Update user status
        await userModel.updateStatus(user.id, 'active', req);
        
        logger.info('Script generated successfully', {
            category: 'SCRIPT',
            userId: user.id,
            userName: user.name,
            scriptType,
            filename,
            req
        });
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(script);
        
    } catch (error) {
        logger.error('Error generating script', {
            category: 'SCRIPT',
            error: error.message,
            requestBody: req.body,
            req
        });
        res.status(500).json({ error: 'Failed to generate script' });
    }
});

// System management endpoints
app.get('/api/system/test-tailscale', authenticateToken, async (req, res) => {
    try {
        const result = await tailscaleService.testConnection();
        
        logger.info('Tailscale API test performed', {
            category: 'SYSTEM',
            success: result.success,
            req
        });
        
        res.json(result);
    } catch (error) {
        logger.error('Error testing Tailscale API', {
            category: 'SYSTEM',
            error: error.message,
            req
        });
        res.status(500).json({ 
            success: false, 
            message: 'Failed to test API connection',
            error: error.message
        });
    }
});

app.post('/api/system/backup', authenticateToken, async (req, res) => {
    try {
        const backupPath = `/app/data/backups/backup_${Date.now()}.db`;
        await db.backup(backupPath);
        
        logger.info('Database backup created', {
            category: 'SYSTEM',
            backupPath,
            req
        });
        
        res.json({ 
            success: true, 
            message: 'Database backup created successfully',
            backupPath
        });
    } catch (error) {
        logger.error('Error creating database backup', {
            category: 'SYSTEM',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

app.post('/api/system/cleanup-logs', authenticateToken, async (req, res) => {
    try {
        // Delete logs older than 30 days
        const result = await db.run(`
            DELETE FROM system_logs 
            WHERE created_at < datetime('now', '-30 days')
        `);
        
        const result2 = await db.run(`
            DELETE FROM activity_logs 
            WHERE created_at < datetime('now', '-30 days')
        `);
        
        const deletedCount = (result.changes || 0) + (result2.changes || 0);
        
        logger.info('Log cleanup completed', {
            category: 'SYSTEM',
            deletedCount,
            req
        });
        
        res.json({ 
            success: true, 
            message: 'Log cleanup completed',
            deleted: deletedCount
        });
    } catch (error) {
        logger.error('Error cleaning up logs', {
            category: 'SYSTEM',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to cleanup logs' });
    }
});

// Logging endpoints
app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const { level, category, limit = 50 } = req.query;
        
        let query = 'SELECT * FROM system_logs';
        const params = [];
        const conditions = [];
        
        if (level) {
            conditions.push('level = ?');
            params.push(level);
        }
        
        if (category) {
            conditions.push('category = ?');
            params.push(category);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const logs = await db.all(query, params);
        
        res.json(logs);
    } catch (error) {
        logger.error('Error fetching logs', {
            category: 'SYSTEM',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

app.get('/api/logs/recent', authenticateToken, async (req, res) => {
    try {
        const logs = await db.all(`
            SELECT al.*, u.name as user_name, u.email as user_email
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 10
        `);
        
        res.json(logs);
    } catch (error) {
        logger.error('Error fetching recent logs', {
            category: 'SYSTEM',
            error: error.message,
            req
        });
        res.status(500).json({ error: 'Failed to fetch recent logs' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error', {
        category: 'SYSTEM',
        error: error.message,
        stack: error.stack,
        req
    });
    
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    logger.warn('404 Not Found', {
        category: 'HTTP',
        path: req.path,
        method: req.method,
        req
    });
    
    res.status(404).json({ error: 'Not found' });
});

// Windows PowerShell Script Generator
function generateWindowsPowerShellScript(user, authKey) {
    return `#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Tailscale Windows Installation Script
.DESCRIPTION
    Automated installation and configuration of Tailscale for Windows
.NOTES
    Employee: ${user.name}
    Email: ${user.email}
    Department: ${user.department}
    Generated: ${new Date().toISOString()}
    Company: ${process.env.COMPANY_NAME || 'Your Company'}
#>

param(
    [switch]$Unattended = $false,
    [switch]$SkipFirewall = $false,
    [string]$LogPath = "$env:TEMP\\Tailscale_Install.log"
)

# Configuration
$EMPLOYEE_ID = "${user.uuid}"
$EMPLOYEE_NAME = "${user.name}"
$EMPLOYEE_EMAIL = "${user.email}"
$DEPARTMENT = "${user.department}"
$HOSTNAME = "${user.hostname}"
$AUTH_KEY = "${authKey}"
$COMPANY_NAME = "${process.env.COMPANY_NAME || 'Your Company'}"

# Script settings
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors and formatting
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Cyan"
    White = "White"
    Gray = "Gray"
}

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$Color = "White"
    )
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "[$Timestamp] [$Level] $Message"
    
    # Write to console with color
    Write-Host $Message -ForegroundColor $Color
    
    # Write to log file
    try {
        Add-Content -Path $LogPath -Value $LogEntry -ErrorAction SilentlyContinue
    } catch {
        # Ignore log file errors
    }
}

function Write-Title {
    param([string]$Title)
    
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor $Colors.Blue
    Write-Host "  $Title" -ForegroundColor $Colors.Blue
    Write-Host "=" * 70 -ForegroundColor $Colors.Blue
    Write-Host ""
}

function Write-Section {
    param([string]$Section)
    
    Write-Host ""
    Write-Host "🔹 $Section" -ForegroundColor $Colors.Yellow
    Write-Host "-" * ($Section.Length + 3) -ForegroundColor $Colors.Gray
}

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-InternetConnectivity {
    Write-Section "Testing Internet Connectivity"
    
    $testHosts = @("8.8.8.8", "1.1.1.1", "tailscale.com")
    
    foreach ($host in $testHosts) {
        try {
            $result = Test-Connection -ComputerName $host -Count 1 -Quiet -ErrorAction Stop
            if ($result) {
                Write-Log "✅ Connected to $host" -Color $Colors.Green
                return $true
            }
        } catch {
            Write-Log "❌ Failed to connect to $host" -Color $Colors.Yellow
        }
    }
    
    Write-Log "❌ No internet connectivity detected" -Level "ERROR" -Color $Colors.Red
    return $false
}

function Install-Tailscale {
    Write-Section "Installing Tailscale"
    
    # Download URL
    $InstallerUrl = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
    $InstallerPath = "$env:TEMP\\tailscale-setup.exe"
    
    try {
        Write-Log "📥 Downloading Tailscale installer..." -Color $Colors.Blue
        
        # Use System.Net.WebClient for better compatibility
        $webClient = New-Object System.Net.WebClient
        $webClient.Headers.Add("User-Agent", "Tailscale-AutoInstaller/2.0 (Windows)")
        $webClient.DownloadFile($InstallerUrl, $InstallerPath)
        
        if (!(Test-Path $InstallerPath)) {
            throw "Download failed - installer not found"
        }
        
        $fileSize = (Get-Item $InstallerPath).Length
        Write-Log "✅ Downloaded installer ($([math]::Round($fileSize/1MB, 2)) MB)" -Color $Colors.Green
        
        Write-Log "🔧 Installing Tailscale..." -Color $Colors.Blue
        
        # Run installer with silent parameters
        $installArgs = @("/quiet", "/norestart")
        $process = Start-Process -FilePath $InstallerPath -ArgumentList $installArgs -Wait -PassThru -NoNewWindow
        
        if ($process.ExitCode -eq 0) {
            Write-Log "✅ Tailscale installed successfully" -Color $Colors.Green
            
            # Wait for service to be available
            Write-Log "⏳ Waiting for Tailscale service..." -Color $Colors.Blue
            Start-Sleep -Seconds 15
            
            # Verify installation
            $tailscalePath = "$env:ProgramFiles\\Tailscale\\tailscale.exe"
            if (Test-Path $tailscalePath) {
                $version = & $tailscalePath version 2>$null
                Write-Log "✅ Installation verified - $version" -Color $Colors.Green
                return $true
            } else {
                throw "Installation verification failed"
            }
        } else {
            throw "Installer exited with code $($process.ExitCode)"
        }
        
    } catch {
        Write-Log "❌ Installation failed: $($_.Exception.Message)" -Level "ERROR" -Color $Colors.Red
        return $false
    } finally {
        # Cleanup installer
        if (Test-Path $InstallerPath) {
            Remove-Item $InstallerPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Connect-ToTailnet {
    Write-Section "Connecting to Company Network"
    
    $tailscalePath = "$env:ProgramFiles\\Tailscale\\tailscale.exe"
    
    if (!(Test-Path $tailscalePath)) {
        Write-Log "❌ Tailscale executable not found" -Level "ERROR" -Color $Colors.Red
        return $false
    }
    
    try {
        Write-Log "🔗 Connecting to $COMPANY_NAME network..." -Color $Colors.Blue
        Write-Log "   Hostname: $HOSTNAME" -Color $Colors.Gray
        Write-Log "   Employee: $EMPLOYEE_NAME ($DEPARTMENT)" -Color $Colors.Gray
        
        # Build connection arguments
        $connectArgs = @(
            "up",
            "--authkey=$AUTH_KEY",
            "--hostname=$HOSTNAME",
            "--accept-routes",
            "--advertise-exit-node=$false"
        )
        
        $process = Start-Process -FilePath $tailscalePath -ArgumentList $connectArgs -Wait -PassThru -NoNewWindow -RedirectStandardError "$env:TEMP\\tailscale_error.log"
        
        if ($process.ExitCode -eq 0) {
            Write-Log "✅ Successfully connected to network" -Color $Colors.Green
            
            # Get connection status
            try {
                $status = & $tailscalePath status --json 2>$null | ConvertFrom-Json
                if ($status.Self.TailscaleIPs) {
                    $ipAddress = $status.Self.TailscaleIPs[0]
                    Write-Log "   Tailscale IP: $ipAddress" -Color $Colors.Green
                }
            } catch {
                Write-Log "   Status check completed" -Color $Colors.Green
            }
            
            return $true
        } else {
            $errorLog = ""
            if (Test-Path "$env:TEMP\\tailscale_error.log") {
                $errorLog = Get-Content "$env:TEMP\\tailscale_error.log" -Raw
            }
            throw "Connection failed with exit code $($process.ExitCode). $errorLog"
        }
        
    } catch {
        Write-Log "❌ Connection failed: $($_.Exception.Message)" -Level "ERROR" -Color $Colors.Red
        return $false
    }
}

function Set-FirewallRules {
    if ($SkipFirewall) {
        Write-Log "⏭️ Skipping firewall configuration (--SkipFirewall specified)" -Color $Colors.Yellow
        return
    }
    
    Write-Section "Configuring Windows Firewall"
    
    try {
        # Allow Tailscale through Windows Firewall
        $rules = @(
            @{Name="Tailscale-In"; Direction="Inbound"; Program="$env:ProgramFiles\\Tailscale\\tailscale.exe"},
            @{Name="Tailscale-Out"; Direction="Outbound"; Program="$env:ProgramFiles\\Tailscale\\tailscale.exe"},
            @{Name="Tailscaled-In"; Direction="Inbound"; Program="$env:ProgramFiles\\Tailscale\\tailscaled.exe"},
            @{Name="Tailscaled-Out"; Direction="Outbound"; Program="$env:ProgramFiles\\Tailscale\\tailscaled.exe"}
        )
        
        foreach ($rule in $rules) {
            try {
                New-NetFirewallRule -DisplayName $rule.Name -Direction $rule.Direction -Program $rule.Program -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
                Write-Log "✅ Firewall rule created: $($rule.Name)" -Color $Colors.Green
            } catch {
                Write-Log "⚠️ Firewall rule may already exist: $($rule.Name)" -Color $Colors.Yellow
            }
        }
        
    } catch {
        Write-Log "⚠️ Firewall configuration warning: $($_.Exception.Message)" -Color $Colors.Yellow
    }
}

function Set-ServiceConfiguration {
    Write-Section "Configuring Tailscale Service"
    
    try {
        # Ensure Tailscale service is set to start automatically
        $service = Get-Service -Name "Tailscale" -ErrorAction SilentlyContinue
        
        if ($service) {
            Set-Service -Name "Tailscale" -StartupType Automatic
            Write-Log "✅ Service set to start automatically" -Color $Colors.Green
            
            if ($service.Status -ne "Running") {
                Start-Service -Name "Tailscale"
                Write-Log "✅ Service started" -Color $Colors.Green
            }
        } else {
            Write-Log "⚠️ Tailscale service not found" -Color $Colors.Yellow
        }
        
    } catch {
        Write-Log "⚠️ Service configuration warning: $($_.Exception.Message)" -Color $Colors.Yellow
    }
}

function New-DesktopShortcut {
    Write-Section "Creating Desktop Shortcut"
    
    try {
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $shortcutPath = Join-Path $desktopPath "Tailscale.lnk"
        
        $wshShell = New-Object -ComObject WScript.Shell
        $shortcut = $wshShell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = "$env:ProgramFiles\\Tailscale\\tailscale-ipn.exe"
        $shortcut.WorkingDirectory = "$env:ProgramFiles\\Tailscale"
        $shortcut.Description = "Tailscale - Secure network access"
        $shortcut.IconLocation = "$env:ProgramFiles\\Tailscale\\tailscale-ipn.exe,0"
        $shortcut.Save()
        
        Write-Log "✅ Desktop shortcut created" -Color $Colors.Green
        
    } catch {
        Write-Log "⚠️ Could not create desktop shortcut: $($_.Exception.Message)" -Color $Colors.Yellow
    }
}

function Save-InstallationInfo {
    Write-Section "Saving Installation Information"
    
    try {
        $configDir = "$env:ProgramData\\TailscaleAutomation"
        if (!(Test-Path $configDir)) {
            New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        }
        
        $installInfo = @{
            employee_id = $EMPLOYEE_ID
            employee_name = $EMPLOYEE_NAME
            employee_email = $EMPLOYEE_EMAIL
            department = $DEPARTMENT
            hostname = $HOSTNAME
            company = $COMPANY_NAME
            installation_date = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
            computer_name = $env:COMPUTERNAME
            windows_version = (Get-CimInstance Win32_OperatingSystem).Caption
            installer_version = "2.0.0"
        }
        
        $infoPath = Join-Path $configDir "installation_info.json"
        $installInfo | ConvertTo-Json -Depth 2 | Out-File -FilePath $infoPath -Encoding UTF8
        
        Write-Log "✅ Installation info saved" -Color $Colors.Green
        
        # Create uninstall script
        $uninstallScript = @"
@echo off
title Uninstall Tailscale - $COMPANY_NAME

echo Uninstalling Tailscale for $EMPLOYEE_NAME...
echo.

REM Stop Tailscale service
net stop Tailscale 2>nul

REM Disconnect from network
"$env:ProgramFiles\\Tailscale\\tailscale.exe" logout 2>nul

REM Uninstall via control panel
echo Starting uninstaller...
start ms-settings:appsfeatures

echo.
echo Please complete the uninstallation through Windows Settings.
echo Look for "Tailscale" in the list of installed programs.
echo.
echo Contact $COMPANY_NAME IT Support if you need assistance.
pause
"@
        
        $uninstallPath = Join-Path $configDir "Uninstall_Tailscale.bat"
        $uninstallScript | Out-File -FilePath $uninstallPath -Encoding ASCII
        
        Write-Log "✅ Uninstall script created" -Color $Colors.Green
        
    } catch {
        Write-Log "⚠️ Could not save installation info: $($_.Exception.Message)" -Color $Colors.Yellow
    }
}

function Show-CompletionMessage {
    Write-Title "🎉 INSTALLATION COMPLETED SUCCESSFULLY!"
    
    Write-Host ""
    Write-Host "📋 Installation Summary:" -ForegroundColor $Colors.Blue
    Write-Host "   Employee: $EMPLOYEE_NAME ($EMPLOYEE_EMAIL)" -ForegroundColor $Colors.White
    Write-Host "   Department: $DEPARTMENT" -ForegroundColor $Colors.White
    Write-Host "   Computer: $env:COMPUTERNAME" -ForegroundColor $Colors.White
    Write-Host "   Hostname: $HOSTNAME" -ForegroundColor $Colors.White
    Write-Host "   Company: $COMPANY_NAME" -ForegroundColor $Colors.White
    Write-Host ""
    
    Write-Host "✅ Tailscale installed and configured" -ForegroundColor $Colors.Green
    Write-Host "✅ Connected to company network" -ForegroundColor $Colors.Green
    Write-Host "✅ Service configured for auto-start" -ForegroundColor $Colors.Green
    Write-Host "✅ Desktop shortcut created" -ForegroundColor $Colors.Green
    Write-Host "✅ Firewall rules configured" -ForegroundColor $Colors.Green
    Write-Host ""
    
    Write-Host "📁 Configuration saved to:" -ForegroundColor $Colors.Blue
    Write-Host "   $env:ProgramData\\TailscaleAutomation\\" -ForegroundColor $Colors.Gray
    Write-Host ""
    
    Write-Host "🔧 Tailscale Management:" -ForegroundColor $Colors.Blue
    Write-Host "   • System tray icon for quick access" -ForegroundColor $Colors.White
    Write-Host "   • Desktop shortcut: 'Tailscale'" -ForegroundColor $Colors.White
    Write-Host "   • Auto-connects on Windows startup" -ForegroundColor $Colors.White
    Write-Host ""
    
    Write-Host "📞 Support Information:" -ForegroundColor $Colors.Blue
    Write-Host "   • IT Support: Contact $COMPANY_NAME IT Department" -ForegroundColor $Colors.White
    Write-Host "   • Employee ID: $EMPLOYEE_ID" -ForegroundColor $Colors.White
    Write-Host "   • Installation Log: $LogPath" -ForegroundColor $Colors.White
    Write-Host ""
    
    Write-Host "🎯 You're now securely connected to the $COMPANY_NAME network!" -ForegroundColor $Colors.Green
}

# Main execution
try {
    Write-Title "TAILSCALE INSTALLATION FOR $COMPANY_NAME"
    
    Write-Log "Starting installation for $EMPLOYEE_NAME" -Level "INFO"
    Write-Log "Computer: $env:COMPUTERNAME" -Level "INFO"
    Write-Log "Windows: $((Get-CimInstance Win32_OperatingSystem).Caption)" -Level "INFO"
    
    # Check prerequisites
    if (!(Test-AdminPrivileges)) {
        Write-Log "❌ Administrator privileges required!" -Level "ERROR" -Color $Colors.Red
        Write-Host "Please right-click this script and select 'Run as administrator'" -ForegroundColor $Colors.Yellow
        if (!$Unattended) { 
            Read-Host "Press Enter to exit" 
        }
        exit 1
    }
    
    if (!(Test-InternetConnectivity)) {
        Write-Log "❌ Internet connection required!" -Level "ERROR" -Color $Colors.Red
        if (!$Unattended) { 
            Read-Host "Press Enter to exit" 
        }
        exit 1
    }
    
    # Main installation steps
    if (!(Install-Tailscale)) {
        throw "Tailscale installation failed"
    }
    
    if (!(Connect-ToTailnet)) {
        throw "Network connection failed"
    }
    
    # Additional configuration
    Set-FirewallRules
    Set-ServiceConfiguration
    New-DesktopShortcut
    Save-InstallationInfo
    
    # Success
    Show-CompletionMessage
    
    Write-Log "Installation completed successfully" -Level "INFO"
    
    if (!$Unattended) {
        Write-Host "Press Enter to finish..." -ForegroundColor $Colors.White
        Read-Host
    }
    
    exit 0
    
} catch {
    Write-Log "❌ Installation failed: $($_.Exception.Message)" -Level "ERROR" -Color $Colors.Red
    Write-Log "Stack trace: $($_.Exception.StackTrace)" -Level "ERROR"
    
    if (!$Unattended) {
        Write-Host ""
        Write-Host "Please contact $COMPANY_NAME IT Support with the error details above." -ForegroundColor $Colors.Yellow
        Write-Host "Log file: $LogPath" -ForegroundColor $Colors.Gray
        Read-Host "Press Enter to exit"
    }
    
    exit 1
}
`;
}

// Windows Batch Script Generator
function generateWindowsBatchScript(user, authKey) {
    return `@echo off
setlocal enabledelayedexpansion

rem Tailscale Windows Installation Script (Batch Version)
rem Employee: ${user.name}
rem Email: ${user.email}
rem Department: ${user.department}
rem Generated: ${new Date().toISOString()}
rem Company: ${process.env.COMPANY_NAME || 'Your Company'}

set "EMPLOYEE_ID=${user.uuid}"
set "EMPLOYEE_NAME=${user.name}"
set "EMPLOYEE_EMAIL=${user.email}"
set "DEPARTMENT=${user.department}"
set "HOSTNAME=${user.hostname}"
set "AUTH_KEY=${authKey}"
set "COMPANY_NAME=${process.env.COMPANY_NAME || 'Your Company'}"

title Tailscale Installation for %COMPANY_NAME%

echo ====================================================================
echo  TAILSCALE INSTALLATION FOR %COMPANY_NAME%
echo ====================================================================
echo.
echo  Employee: %EMPLOYEE_NAME%
echo  Email: %EMPLOYEE_EMAIL%
echo  Department: %DEPARTMENT%
echo  Computer: %COMPUTERNAME%
echo  Date: %DATE% %TIME%
echo.
echo ====================================================================
echo.

rem Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Administrator privileges required!
    echo Please right-click this script and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [INFO] Administrator privileges confirmed
echo.

rem Check internet connectivity
echo [INFO] Testing internet connectivity...
ping -n 1 8.8.8.8 >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: No internet connection detected
    echo Please check your internet connection and try again
    echo.
    pause
    exit /b 1
)

echo [INFO] Internet connectivity confirmed
echo.

rem Download and install Tailscale
echo [INFO] Downloading Tailscale installer...
set "INSTALLER_URL=https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
set "INSTALLER_PATH=%TEMP%\\tailscale-setup.exe"

powershell -Command "(New-Object System.Net.WebClient).DownloadFile('%INSTALLER_URL%', '%INSTALLER_PATH%')"

if not exist "%INSTALLER_PATH%" (
    echo ERROR: Failed to download Tailscale installer
    echo.
    pause
    exit /b 1
)

echo [INFO] Download completed
echo.

echo [INFO] Installing Tailscale...
"%INSTALLER_PATH%" /quiet /norestart

rem Wait for installation to complete
echo [INFO] Waiting for installation to complete...
timeout /t 15 /nobreak >nul

rem Verify installation
if not exist "%ProgramFiles%\\Tailscale\\tailscale.exe" (
    echo ERROR: Tailscale installation failed
    echo.
    pause
    exit /b 1
)

echo [INFO] Installation completed successfully
echo.

rem Connect to network
echo [INFO] Connecting to company network...
"%ProgramFiles%\\Tailscale\\tailscale.exe" up --authkey="%AUTH_KEY%" --hostname="%HOSTNAME%" --accept-routes

if %errorLevel% neq 0 (
    echo ERROR: Failed to connect to network
    echo Please contact IT Support for assistance
    echo.
    pause
    exit /b 1
)

echo [INFO] Successfully connected to network
echo.

rem Configure service
echo [INFO] Configuring Tailscale service...
sc config Tailscale start= auto >nul 2>&1
net start Tailscale >nul 2>&1

rem Create desktop shortcut
echo [INFO] Creating desktop shortcut...
set "DESKTOP=%USERPROFILE%\\Desktop"
set "SHORTCUT=%DESKTOP%\\Tailscale.lnk"

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT%'); $Shortcut.TargetPath = '%ProgramFiles%\\Tailscale\\tailscale-ipn.exe'; $Shortcut.Save()"

rem Save installation information
echo [INFO] Saving installation information...
if not exist "%ProgramData%\\TailscaleAutomation" (
    mkdir "%ProgramData%\\TailscaleAutomation"
)

echo { > "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "employee_id": "%EMPLOYEE_ID%", >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "employee_name": "%EMPLOYEE_NAME%", >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "employee_email": "%EMPLOYEE_EMAIL%", >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "department": "%DEPARTMENT%", >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "hostname": "%HOSTNAME%", >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "company": "%COMPANY_NAME%", >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "installation_date": "%DATE% %TIME%", >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "computer_name": "%COMPUTERNAME%", >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo   "installer_version": "2.0.0-batch" >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"
echo } >> "%ProgramData%\\TailscaleAutomation\\installation_info.json"

rem Cleanup
if exist "%INSTALLER_PATH%" (
    del "%INSTALLER_PATH%"
)

echo.
echo ====================================================================
echo  INSTALLATION COMPLETED SUCCESSFULLY!
echo ====================================================================
echo.
echo  Employee: %EMPLOYEE_NAME%
echo  Company: %COMPANY_NAME%
echo  Computer: %COMPUTERNAME%
echo.
echo  SUCCESS: You are now connected to the company network!
echo.
echo  What's Next:
echo  - Look for the Tailscale icon in your system tray
echo  - Use the desktop shortcut to access Tailscale settings
echo  - Tailscale will start automatically when Windows starts
echo.
echo  Support Information:
echo  - Employee ID: %EMPLOYEE_ID%
echo  - Contact: %COMPANY_NAME% IT Department
echo.
echo ====================================================================

echo.
echo Press any key to finish...
pause >nul

endlocal
exit /b 0
`;
}

// Start server
async function startServer() {
    try {
        await initializeServices();
        
        // Start periodic cleanup
        setInterval(async () => {
            try {
                await authKeyManager.cleanupExpiredKeys();
            } catch (error) {
                logger.error('Periodic cleanup failed', {
                    category: 'SYSTEM',
                    error: error.message
                });
            }
        }, 24 * 60 * 60 * 1000); // Run daily
        
        app.listen(PORT, () => {
            logger.info('Server started successfully', {
                category: 'SYSTEM',
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                version: '2.0.0'
            });
        });
        
    } catch (error) {
        logger.error('Failed to start server', {
            category: 'SYSTEM',
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully', {
        category: 'SYSTEM'
    });
    
    if (db) {
        await db.close();
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully', {
        category: 'SYSTEM'
    });
    
    if (db) {
        await db.close();
    }
    
    process.exit(0);
});

startServer();
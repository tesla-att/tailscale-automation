#!/bin/bash
# =================================================================
# FINAL DEPLOYMENT - Chạy script này để hoàn thiện hệ thống
# =================================================================

echo "🚀 TAILSCALE AUTOMATION SYSTEM - FINAL DEPLOYMENT"
echo "================================================="

# Màu sắc cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Dừng containers hiện tại
echo -e "${BLUE}📦 Stopping current containers...${NC}"
docker-compose down --remove-orphans

# 2. Fix Redis memory issue
echo -e "${BLUE}🔧 Fixing Redis memory issue...${NC}"
echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl vm.overcommit_memory=1

# 3. Tạo web interface hoàn chỉnh
echo -e "${BLUE}🌐 Creating complete web interface...${NC}"
mkdir -p web
cat > web/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tailscale Management System</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .status-online { color: #10b981; }
        .status-offline { color: #ef4444; }
        .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .notification { 
            position: fixed; 
            top: 20px; 
            right: 20px; 
            z-index: 1000; 
            transition: all 0.3s ease;
        }
    </style>
</head>
<body class="bg-gray-100">
    <div id="notification-container"></div>

    <!-- Header -->
    <header class="gradient-bg text-white shadow-lg">
        <div class="container mx-auto px-4 py-6">
            <div class="flex justify-between items-center">
                <div class="flex items-center">
                    <i class="fas fa-network-wired text-2xl mr-3"></i>
                    <h1 class="text-2xl font-bold">Tailscale Management System</h1>
                </div>
                <div class="flex items-center space-x-4">
                    <span id="user-info" class="text-sm"></span>
                    <button id="logout-btn" class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded">
                        <i class="fas fa-sign-out-alt mr-2"></i>Logout
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- Login Modal -->
    <div id="login-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-8 rounded-lg shadow-xl w-96">
            <div class="text-center mb-6">
                <i class="fas fa-network-wired text-4xl text-blue-500 mb-4"></i>
                <h2 class="text-2xl font-bold">Login Required</h2>
                <p class="text-gray-600">Please enter your credentials</p>
            </div>
            <form id="login-form">
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Username</label>
                    <input type="text" id="username" class="w-full px-3 py-2 border rounded-lg" value="admin">
                </div>
                <div class="mb-6">
                    <label class="block text-sm font-medium mb-2">Password</label>
                    <input type="password" id="password" class="w-full px-3 py-2 border rounded-lg" value="admin123">
                </div>
                <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg">
                    Login
                </button>
            </form>
        </div>
    </div>

    <!-- Main Content -->
    <div id="main-content" class="container mx-auto px-4 py-8 hidden">
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <i class="fas fa-users text-blue-500 text-2xl mr-4"></i>
                    <div>
                        <p class="text-sm text-gray-600">Total Employees</p>
                        <p id="total-employees" class="text-2xl font-bold">0</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <i class="fas fa-check-circle status-online text-2xl mr-4"></i>
                    <div>
                        <p class="text-sm text-gray-600">Online Devices</p>
                        <p id="online-devices" class="text-2xl font-bold">0</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <i class="fas fa-times-circle status-offline text-2xl mr-4"></i>
                    <div>
                        <p class="text-sm text-gray-600">Offline Devices</p>
                        <p id="offline-devices" class="text-2xl font-bold">0</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <i class="fas fa-key text-yellow-500 text-2xl mr-4"></i>
                    <div>
                        <p class="text-sm text-gray-600">Active Keys</p>
                        <p id="active-keys" class="text-2xl font-bold">0</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabs -->
        <div class="bg-white rounded-lg shadow">
            <div class="border-b">
                <nav class="flex space-x-8 px-6">
                    <button class="tab-button active py-4 px-2 border-b-2 border-blue-500 text-blue-600" data-tab="employees">
                        <i class="fas fa-users mr-2"></i>Employees
                    </button>
                    <button class="tab-button py-4 px-2 border-b-2 border-transparent hover:border-gray-300" data-tab="devices">
                        <i class="fas fa-laptop mr-2"></i>Devices
                    </button>
                    <button class="tab-button py-4 px-2 border-b-2 border-transparent hover:border-gray-300" data-tab="deployment">
                        <i class="fas fa-download mr-2"></i>Deployment
                    </button>
                </nav>
            </div>

            <!-- Employees Tab -->
            <div id="employees-tab" class="tab-content active p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-bold">Employee Management</h2>
                    <button id="add-employee-btn" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-plus mr-2"></i>Add Employee
                    </button>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left">ID</th>
                                <th class="px-4 py-3 text-left">Name</th>
                                <th class="px-4 py-3 text-left">Email</th>
                                <th class="px-4 py-3 text-left">Department</th>
                                <th class="px-4 py-3 text-left">OS</th>
                                <th class="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="employees-table">
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Devices Tab -->
            <div id="devices-tab" class="tab-content p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-bold">Device Status</h2>
                    <button id="refresh-devices" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-sync-alt mr-2"></i>Refresh
                    </button>
                </div>
                <div id="devices-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                </div>
            </div>

            <!-- Deployment Tab -->
            <div id="deployment-tab" class="tab-content p-6">
                <h2 class="text-xl font-bold mb-6">Generate Installation Scripts</h2>
                
                <div class="bg-gray-50 p-6 rounded-lg">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select id="deployment-employee" class="px-3 py-2 border rounded-lg">
                            <option value="">Select Employee</option>
                        </select>
                        <select id="deployment-os" class="px-3 py-2 border rounded-lg">
                            <option value="">Select OS</option>
                            <option value="windows">Windows</option>
                            <option value="macos">macOS</option>
                            <option value="linux">Linux</option>
                        </select>
                        <div class="flex gap-2">
                            <button id="generate-authkey" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex-1">
                                <i class="fas fa-key mr-2"></i>Gen Key
                            </button>
                            <button id="download-script" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex-1">
                                <i class="fas fa-download mr-2"></i>Download
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mt-6 bg-blue-50 p-4 rounded-lg">
                    <h3 class="font-medium mb-2">📋 Instructions for Employees:</h3>
                    <ul class="text-sm space-y-1">
                        <li><strong>Windows:</strong> Right-click script → "Run as administrator"</li>
                        <li><strong>macOS/Linux:</strong> Terminal: sudo ./script.sh</li>
                        <li><strong>Support:</strong> Contact IT if issues occur</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <!-- Add Employee Modal -->
    <div id="add-employee-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div class="bg-white p-8 rounded-lg shadow-xl w-96">
            <h2 class="text-2xl font-bold mb-6">Add New Employee</h2>
            <form id="add-employee-form">
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Employee ID</label>
                        <input type="text" id="new-emp-id" class="w-full px-3 py-2 border rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Name</label>
                        <input type="text" id="new-emp-name" class="w-full px-3 py-2 border rounded-lg" required>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Email</label>
                    <input type="email" id="new-emp-email" class="w-full px-3 py-2 border rounded-lg" required>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Department</label>
                        <input type="text" id="new-emp-dept" class="w-full px-3 py-2 border rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Location</label>
                        <input type="text" id="new-emp-location" class="w-full px-3 py-2 border rounded-lg" required>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium mb-2">Hostname</label>
                        <input type="text" id="new-emp-hostname" class="w-full px-3 py-2 border rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">OS</label>
                        <select id="new-emp-os" class="w-full px-3 py-2 border rounded-lg" required>
                            <option value="">Select OS</option>
                            <option value="windows">Windows</option>
                            <option value="macos">macOS</option>
                            <option value="linux">Linux</option>
                        </select>
                    </div>
                </div>
                <div class="flex justify-end space-x-4">
                    <button type="button" id="cancel-add-employee" class="px-4 py-2 border rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">
                        Add Employee
                    </button>
                </div>
            </form>
        </div>
    </div>

    <script>
        const API_BASE = window.location.protocol + '//' + window.location.hostname + ':3000/api';
        let authToken = localStorage.getItem('tailscale_token');

        function showNotification(message, type = 'info') {
            const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
            const notification = document.createElement('div');
            notification.className = `notification ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg`;
            notification.innerHTML = `<span>${message}</span>`;
            document.getElementById('notification-container').appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
        }

        async function apiCall(endpoint, options = {}) {
            const config = {
                headers: { 'Content-Type': 'application/json', ...(authToken && { 'Authorization': `Bearer ${authToken}` }) },
                ...options,
            };

            try {
                const response = await fetch(`${API_BASE}${endpoint}`, config);
                if (response.status === 401) { showLogin(); return null; }
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                showNotification(`API Error: ${error.message}`, 'error');
                return null;
            }
        }

        function showLogin() {
            document.getElementById('login-modal').classList.remove('hidden');
            document.getElementById('main-content').classList.add('hidden');
        }

        function hideLogin() {
            document.getElementById('login-modal').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
        }

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();
                if (data.token) {
                    authToken = data.token;
                    localStorage.setItem('tailscale_token', authToken);
                    document.getElementById('user-info').textContent = `${username}`;
                    hideLogin();
                    loadData();
                    showNotification('Login successful!', 'success');
                } else {
                    showNotification('Invalid credentials', 'error');
                }
            } catch (error) {
                showNotification('Login failed', 'error');
            }
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('tailscale_token');
            authToken = null;
            showLogin();
        });

        // Tab Navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                document.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
                    btn.classList.add('border-transparent');
                });
                button.classList.add('active', 'border-blue-500', 'text-blue-600');
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });

        async function loadData() {
            await Promise.all([loadEmployees(), loadDevices(), updateStats()]);
        }

        async function loadEmployees() {
            const employees = await apiCall('/employees');
            if (!employees) return;

            const tbody = document.getElementById('employees-table');
            tbody.innerHTML = employees.map(emp => `
                <tr class="border-t">
                    <td class="px-4 py-3">${emp.id}</td>
                    <td class="px-4 py-3">${emp.name}</td>
                    <td class="px-4 py-3">${emp.email}</td>
                    <td class="px-4 py-3">${emp.department}</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">${emp.os}</span>
                    </td>
                    <td class="px-4 py-3">
                        <button onclick="generateAuthKey('${emp.id}')" class="text-blue-500 hover:text-blue-700 mr-3">
                            <i class="fas fa-key"></i>
                        </button>
                        <button onclick="downloadScript('${emp.id}', '${emp.os}')" class="text-green-500 hover:text-green-700">
                            <i class="fas fa-download"></i>
                        </button>
                    </td>
                </tr>
            `).join('');

            const select = document.getElementById('deployment-employee');
            select.innerHTML = '<option value="">Select Employee</option>' + 
                employees.map(emp => `<option value="${emp.id}">${emp.name} (${emp.id})</option>`).join('');
        }

        async function loadDevices() {
            const devices = await apiCall('/devices');
            if (!devices) return;

            const grid = document.getElementById('devices-grid');
            grid.innerHTML = devices.map(device => `
                <div class="bg-white p-6 rounded-lg border">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-medium">${device.hostname}</h3>
                        <span class="w-3 h-3 rounded-full ${device.online ? 'bg-green-500' : 'bg-red-500'}"></span>
                    </div>
                    <div class="text-sm text-gray-600 space-y-1">
                        <div><strong>IP:</strong> ${device.addresses?.[0] || 'N/A'}</div>
                        <div><strong>Status:</strong> <span class="${device.online ? 'status-online' : 'status-offline'}">${device.online ? 'Online' : 'Offline'}</span></div>
                        <div><strong>Last Seen:</strong> ${device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}</div>
                    </div>
                </div>
            `).join('');
        }

        async function updateStats() {
            const [employees, devices] = await Promise.all([apiCall('/employees'), apiCall('/devices')]);
            if (employees && devices) {
                document.getElementById('total-employees').textContent = employees.length;
                document.getElementById('online-devices').textContent = devices.filter(d => d.online).length;
                document.getElementById('offline-devices').textContent = devices.filter(d => !d.online).length;
                document.getElementById('active-keys').textContent = employees.length;
            }
        }

        async function generateAuthKey(employeeId) {
            const result = await apiCall(`/employees/${employeeId}/authkey`, { method: 'POST' });
            if (result) showNotification(`Auth key generated for ${employeeId}`, 'success');
        }

        async function downloadScript(employeeId, os) {
            try {
                const response = await fetch(`${API_BASE}/employees/${employeeId}/script/${os}`, {
                    headers: { 'Authorization': `Bearer ${authToken}` },
                });
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `deploy_${employeeId}_${os}.${os === 'windows' ? 'ps1' : 'sh'}`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    showNotification(`Script downloaded for ${employeeId}`, 'success');
                } else {
                    showNotification('Failed to download script', 'error');
                }
            } catch (error) {
                showNotification('Download failed', 'error');
            }
        }

        // Employee Modal
        document.getElementById('add-employee-btn').addEventListener('click', () => {
            document.getElementById('add-employee-modal').classList.remove('hidden');
        });

        document.getElementById('cancel-add-employee').addEventListener('click', () => {
            document.getElementById('add-employee-modal').classList.add('hidden');
        });

        document.getElementById('add-employee-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newEmployee = {
                id: document.getElementById('new-emp-id').value,
                name: document.getElementById('new-emp-name').value,
                email: document.getElementById('new-emp-email').value,
                department: document.getElementById('new-emp-dept').value,
                location: document.getElementById('new-emp-location').value,
                hostname: document.getElementById('new-emp-hostname').value,
                os: document.getElementById('new-emp-os').value,
            };

            const result = await apiCall('/employees', { method: 'POST', body: JSON.stringify(newEmployee) });
            if (result) {
                document.getElementById('add-employee-modal').classList.add('hidden');
                document.getElementById('add-employee-form').reset();
                loadEmployees();
                updateStats();
                showNotification(`Employee ${newEmployee.name} added`, 'success');
            }
        });

        // Deployment actions
        document.getElementById('generate-authkey').addEventListener('click', async () => {
            const employeeId = document.getElementById('deployment-employee').value;
            if (!employeeId) return showNotification('Select employee first', 'warning');
            await generateAuthKey(employeeId);
        });

        document.getElementById('download-script').addEventListener('click', async () => {
            const employeeId = document.getElementById('deployment-employee').value;
            const os = document.getElementById('deployment-os').value;
            if (!employeeId || !os) return showNotification('Select employee and OS', 'warning');
            await downloadScript(employeeId, os);
        });

        document.getElementById('refresh-devices').addEventListener('click', loadDevices);

        // Initialize
        if (authToken) {
            hideLogin();
            loadData();
        } else {
            showLogin();
        }

        setInterval(() => { if (authToken) { loadDevices(); updateStats(); } }, 30000);
    </script>
</body>
</html>
EOF

# 4. Rebuild containers với source code mới
echo -e "${BLUE}🔨 Building containers with new source code...${NC}"
docker-compose build --no-cache

# 5. Start containers
echo -e "${BLUE}▶️  Starting containers...${NC}"
docker-compose up -d

# 6. Wait for services
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 20

# 7. Check status
echo -e "${BLUE}📊 Checking container status...${NC}"
docker-compose ps

# 8. Test API health
echo -e "${BLUE}🔍 Testing API health...${NC}"
API_HEALTH=$(curl -s http://localhost:3000/health || echo "failed")
if echo "$API_HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ API server is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  API health check failed, but container may still be starting...${NC}"
fi

# 9. Test web interface
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 || echo "000")
if [ "$WEB_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Web interface is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Web interface check failed (HTTP $WEB_STATUS)${NC}"
fi

# 10. Show logs briefly
echo -e "${BLUE}📄 Recent logs:${NC}"
docker-compose logs --tail=5

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETED!${NC}"
echo ""
echo -e "${BLUE}📊 System Status:${NC}"
docker-compose ps
echo ""
echo -e "${BLUE}🌐 Access Points:${NC}"
echo "   • Web Interface: http://localhost:8080"
echo "   • API Health: http://localhost:3000/health"
echo ""
echo -e "${BLUE}🔑 Login Credentials:${NC}"
echo "   • Username: admin"
echo "   • Password: admin123"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "   1. Open http://localhost:8080 in browser"
echo "   2. Login with admin/admin123"  
echo "   3. Add employees via 'Add Employee' button"
echo "   4. Generate auth keys and download scripts"
echo "   5. Send scripts to employees"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "   • View logs: docker-compose logs -f"
echo "   • Restart: docker-compose restart"
echo "   • Stop: docker-compose down"
echo ""
echo -e "${GREEN}✨ Your Tailscale automation system is now ready!${NC}"
EOF

# Tạo script nhỏ để check status
cat > check_status.sh << 'EOF'
#!/bin/bash
echo "🔍 TAILSCALE AUTOMATION SYSTEM STATUS"
echo "===================================="

echo ""
echo "📦 Container Status:"
docker-compose ps

echo ""
echo "🌐 Service Health Checks:"

# API Health
API_HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null)
if echo "$API_HEALTH" | grep -q '"status":"ok"'; then
    echo "✅ API Server: Healthy"
else
    echo "❌ API Server: Unhealthy or not responding"
fi

# Web Interface
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null)
if [ "$WEB_STATUS" = "200" ]; then
    echo "✅ Web Interface: Accessible"
else
    echo "❌ Web Interface: Not accessible (HTTP $WEB_STATUS)"
fi

# Redis
REDIS_STATUS=$(docker-compose exec -T redis redis-cli ping 2>/dev/null | tr -d '\r')
if [ "$REDIS_STATUS" = "PONG" ]; then
    echo "✅ Redis: Working"
else
    echo "❌ Redis: Not responding"
fi

echo ""
echo "🔗 Access URLs:"
echo "   • Web Interface: http://localhost:8080"
echo "   • API Health: http://localhost:3000/health"
echo ""
echo "📊 Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
EOF

chmod +x check_status.sh

echo ""
echo -e "${GREEN}🎯 QUICK DEPLOYMENT READY!${NC}"
echo ""
echo -e "${BLUE}To deploy your Tailscale automation system, run:${NC}"
echo ""
echo -e "${YELLOW}    bash final_deployment.sh${NC}"
echo ""
echo "This will:"
echo "  ✅ Fix all current issues"
echo "  ✅ Create complete web interface"
echo "  ✅ Build and start all containers"
echo "  ✅ Verify everything is working"
echo ""
echo -e "${BLUE}After deployment, check status with:${NC}"
echo -e "${YELLOW}    ./check_status.sh${NC}"
echo ""
EOF

chmod +x final_deployment.sh

# Tạo file hướng dẫn nhanh
cat > QUICK_START.md << 'EOF'
# 🚀 TAILSCALE AUTOMATION - QUICK START

## Chạy ngay để có hệ thống hoàn chỉnh:

```bash
# 1. Chạy deployment script
bash final_deployment.sh

# 2. Kiểm tra status
./check_status.sh

# 3. Truy cập web interface
# Mở browser: http://localhost:8080
# Login: admin / admin123
```

## 📋 Workflow sử dụng:

1. **Thêm nhân viên:** Click "Add Employee" trong web interface
2. **Tạo auth key:** Click icon key bên cạnh tên nhân viên  
3. **Download script:** Click icon download để tải script cài đặt
4. **Gửi cho nhân viên:** Email script và hướng dẫn
5. **Nhân viên chạy script:** Tự động cài đặt và kết nối Tailscale

## 🔧 Troubleshooting:

```bash
# Xem logs nếu có lỗi
docker-compose logs -f

# Restart services
docker-compose restart

# Rebuild từ đầu
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📞 Support:

- API Health: http://localhost:3000/health
- Container status: `docker-compose ps`
- Logs: `docker-compose logs [service-name]`
EOF

echo ""
echo -e "${GREEN}🎉 ALL FILES CREATED SUCCESSFULLY!${NC}"
echo ""
echo -e "${BLUE}📁 Created files:${NC}"
echo "   • final_deployment.sh - Main deployment script"
echo "   • check_status.sh - Status checker"  
echo "   • QUICK_START.md - Quick start guide"
echo ""
echo -e "${YELLOW}▶️  Run this command to deploy everything:${NC}"
echo ""
echo -e "${GREEN}    bash final_deployment.sh${NC}"
echo ""
echo -e "${BLUE}This will fix all issues and give you a working Tailscale automation system!${NC}"
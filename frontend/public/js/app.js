class TailscaleApp {
    constructor() {
        this.token = localStorage.getItem('tailscale_token');
        this.apiBase = window.location.origin + '/api';
        this.downloadCount = 0;
        
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
        
        // User management
        document.getElementById('add-user-btn').addEventListener('click', () => this.showAddUserModal());
        document.getElementById('cancel-user-btn').addEventListener('click', () => this.hideAddUserModal());
        document.getElementById('user-form').addEventListener('submit', (e) => this.handleAddUser(e));
        
        // Script generation
        document.getElementById('generate-authkey-btn').addEventListener('click', () => this.generateAuthKey());
        document.getElementById('generate-script-btn').addEventListener('click', () => this.generateScript());
        
        // Additional buttons
        document.getElementById('refresh-users-btn').addEventListener('click', () => this.loadEmployees());
        document.getElementById('refresh-logs-btn').addEventListener('click', () => this.loadLogs());
        document.getElementById('test-api-btn').addEventListener('click', () => this.testApi());
        document.getElementById('backup-db-btn').addEventListener('click', () => this.backupDatabase());
        document.getElementById('cleanup-logs-btn').addEventListener('click', () => this.cleanupLogs());
        document.getElementById('save-user-btn').addEventListener('click', (e) => this.handleAddUser(e));
        document.getElementById('cancel-delete-btn').addEventListener('click', () => this.hideDeleteModal());
        document.getElementById('confirm-delete-btn').addEventListener('click', () => this.confirmDeleteUser());
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            if (this.token) {
                this.updateDashboardStats();
            }
        }, 30000);
    }
    
    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        const notification = document.createElement('div');
        notification.className = `notification ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg`;
        notification.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.getElementById('notification-area').appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
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
                localStorage.setItem('tailscale_token', this.token);
                this.showApp();
                this.loadDashboard();
                this.showNotification('Login successful!', 'success');
            } else {
                this.showNotification(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error: ' + error.message, 'error');
        }
    }
    
    logout() {
        this.token = null;
        localStorage.removeItem('tailscale_token');
        this.showLogin();
        this.showNotification('Logged out successfully', 'info');
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
            case 'deployment':
                this.loadDeploymentOptions();
                break;
        }
    }
    
    async loadDashboard() {
        try {
            await this.updateDashboardStats();
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showNotification('Failed to load dashboard data', 'error');
        }
    }
    
    async updateDashboardStats() {
        try {
            const employees = await this.fetchEmployees();
            
            document.getElementById('total-employees').textContent = employees.length;
            document.getElementById('connected-devices').textContent = 
                employees.filter(e => e.status === 'connected').length;
            document.getElementById('total-downloads').textContent = this.downloadCount;
            
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }
    
    async loadEmployees() {
        try {
            const employees = await this.fetchEmployees();
            const tbody = document.getElementById('employees-table');
            
            if (employees.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                            No employees added yet. Click "Add Employee" to get started.
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = employees.map(emp => `
                <tr class="border-b hover:bg-gray-50">
                    <td class="px-4 py-3 font-medium">${emp.name}</td>
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
                        <button onclick="app.downloadScript('${emp.id}', '${emp.os}')" 
                                class="text-blue-500 hover:text-blue-700 mr-2" 
                                title="Download script">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="app.editEmployee('${emp.id}')" 
                                class="text-green-500 hover:text-green-700" 
                                title="Edit employee">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Failed to load employees:', error);
            this.showNotification('Failed to load employees', 'error');
        }
    }
    
    async loadDeploymentOptions() {
        try {
            const employees = await this.fetchEmployees();
            const select = document.getElementById('script-employee');
            
            select.innerHTML = '<option value="">Select Employee</option>' +
                employees.map(emp => `<option value="${emp.id}">${emp.name} (${emp.os})</option>`).join('');
        } catch (error) {
            console.error('Failed to load deployment options:', error);
        }
    }
    
    async fetchEmployees() {
        const response = await fetch(`${this.apiBase}/employees`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired');
            }
            throw new Error('Failed to fetch employees');
        }
        
        return await response.json();
    }
    
    showAddUserModal() {
        document.getElementById('user-modal').classList.remove('hidden');
    }
    
    hideAddUserModal() {
        document.getElementById('user-modal').classList.add('hidden');
        document.getElementById('user-form').reset();
    }
    
    async handleAddUser(e) {
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
                this.hideAddUserModal();
                this.loadEmployees();
                this.updateDashboardStats();
                this.showNotification(`Employee ${employeeData.name} added successfully!`, 'success');
            } else {
                const error = await response.json();
                this.showNotification('Failed to add employee: ' + error.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error adding employee: ' + error.message, 'error');
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
                    <div class="flex items-center text-green-600 mb-2">
                        <i class="fas fa-check-circle mr-2"></i>
                        <span class="font-medium">Auth Key Generated Successfully</span>
                    </div>
                    <p class="text-xs text-gray-500">Expires: ${new Date(data.expires).toLocaleDateString()}</p>
                    <p class="text-xs text-gray-600 mt-1">Key: ${data.authKey.substring(0, 20)}...</p>
                `;
                this.showNotification('New auth key generated successfully!', 'success');
            } else {
                this.showNotification('Failed to generate auth key: ' + data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error generating auth key: ' + error.message, 'error');
        }
    }
    
    async generateScript() {
        const employeeId = document.getElementById('script-employee').value;
        const os = document.getElementById('script-os').value;
        
        if (!employeeId) {
            this.showNotification('Please select an employee', 'warning');
            return;
        }
        
        if (!os) {
            this.showNotification('Please select an operating system', 'warning');
            return;
        }
        
        await this.downloadScript(employeeId, os);
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
                
                // Get filename from Content-Disposition header
                const contentDisposition = response.headers.get('Content-Disposition');
                const filename = contentDisposition 
                    ? contentDisposition.split('filename=')[1].replace(/"/g, '')
                    : `install_tailscale_${employeeId}_${os}.${os === 'windows' ? 'ps1' : 'sh'}`;
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                
                // Update download counter and recent downloads
                this.downloadCount++;
                this.updateRecentDownloads(employeeId, os, filename);
                this.showNotification(`Script downloaded: ${filename}`, 'success');
                
            } else {
                const error = await response.json();
                this.showNotification('Failed to download script: ' + error.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error downloading script: ' + error.message, 'error');
        }
    }
    
    updateRecentDownloads(employeeId, os, filename) {
        const downloadsDiv = document.getElementById('recent-downloads');
        const timestamp = new Date().toLocaleString();
        
        const downloadItem = document.createElement('div');
        downloadItem.className = 'flex justify-between items-center p-2 bg-gray-50 rounded';
        downloadItem.innerHTML = `
            <div>
                <span class="font-medium">${filename}</span>
                <span class="text-sm text-gray-500 ml-2">${timestamp}</span>
            </div>
            <span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">${os}</span>
        `;
        
        if (downloadsDiv.querySelector('p')) {
            downloadsDiv.innerHTML = '';
        }
        
        downloadsDiv.insertBefore(downloadItem, downloadsDiv.firstChild);
        
        // Keep only last 5 downloads
        const items = downloadsDiv.querySelectorAll('div');
        if (items.length > 5) {
            items[items.length - 1].remove();
        }
    }
    
    editEmployee(employeeId) {
        this.showNotification('Employee editing feature coming soon!', 'info');
    }
    
    async loadLogs() {
        try {
            const response = await fetch(`${this.apiBase}/logs`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const logs = await response.json();
                this.displayLogs(logs);
                this.showNotification('Logs refreshed', 'success');
            } else {
                this.showNotification('Failed to load logs', 'error');
            }
        } catch (error) {
            this.showNotification('Error loading logs: ' + error.message, 'error');
        }
    }
    
    displayLogs(logs) {
        const logsTable = document.getElementById('logs-table');
        if (!logsTable) return;
        
        logsTable.innerHTML = logs.map(log => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm text-gray-900">${new Date(log.created_at).toLocaleString()}</td>
                <td class="px-6 py-4 text-sm">
                    <span class="px-2 py-1 text-xs rounded ${this.getLogLevelClass(log.level)}">${log.level}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900">${log.category}</td>
                <td class="px-6 py-4 text-sm text-gray-900">${log.action}</td>
                <td class="px-6 py-4 text-sm text-gray-900">${log.user || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${log.details || '-'}</td>
            </tr>
        `).join('');
    }
    
    getLogLevelClass(level) {
        const classes = {
            'INFO': 'bg-blue-100 text-blue-800',
            'WARN': 'bg-yellow-100 text-yellow-800',
            'ERROR': 'bg-red-100 text-red-800'
        };
        return classes[level] || 'bg-gray-100 text-gray-800';
    }
    
    async testApi() {
        try {
            const response = await fetch(`${this.apiBase}/system/test-tailscale`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const result = await response.json();
                const resultDiv = document.getElementById('api-test-result');
                if (resultDiv) {
                    resultDiv.className = result.success ? 'mt-4 p-4 bg-green-100 text-green-800 rounded' : 'mt-4 p-4 bg-red-100 text-red-800 rounded';
                    resultDiv.innerHTML = `<strong>${result.success ? 'Success' : 'Failed'}:</strong> ${result.message}`;
                    resultDiv.classList.remove('hidden');
                }
                this.showNotification(result.success ? 'API test successful' : 'API test failed', result.success ? 'success' : 'error');
            } else {
                this.showNotification('API test failed', 'error');
            }
        } catch (error) {
            this.showNotification('Error testing API: ' + error.message, 'error');
        }
    }
    
    async backupDatabase() {
        try {
            const response = await fetch(`${this.apiBase}/system/backup`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showNotification('Database backup created successfully', 'success');
            } else {
                this.showNotification('Failed to create backup', 'error');
            }
        } catch (error) {
            this.showNotification('Error creating backup: ' + error.message, 'error');
        }
    }
    
    async cleanupLogs() {
        try {
            const response = await fetch(`${this.apiBase}/system/cleanup-logs`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showNotification(`Log cleanup completed. Deleted ${result.deleted} entries.`, 'success');
            } else {
                this.showNotification('Failed to cleanup logs', 'error');
            }
        } catch (error) {
            this.showNotification('Error cleaning up logs: ' + error.message, 'error');
        }
    }
    
    hideDeleteModal() {
        document.getElementById('delete-modal').classList.add('hidden');
    }
    
    async confirmDeleteUser() {
        const userId = this.currentDeleteUserId;
        if (!userId) return;
        
        try {
            const response = await fetch(`${this.apiBase}/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.hideDeleteModal();
                this.loadEmployees();
                this.updateDashboardStats();
                this.showNotification('User deleted successfully', 'success');
            } else {
                this.showNotification('Failed to delete user', 'error');
            }
        } catch (error) {
            this.showNotification('Error deleting user: ' + error.message, 'error');
        }
    }
}

// Initialize app
const app = new TailscaleApp();
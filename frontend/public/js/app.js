class TailscaleApp {
    constructor() {
        this.token = localStorage.getItem('tailscale_token');
        this.apiBase = window.location.origin + '/api';
        this.downloadCount = 0;
        this.currentDeleteUserId = null;
        
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
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // User management
        const addUserBtn = document.getElementById('add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.showAddUserModal());
        }
        
        const cancelUserBtn = document.getElementById('cancel-user-btn');
        if (cancelUserBtn) {
            cancelUserBtn.addEventListener('click', () => this.hideAddUserModal());
        }
        
        const userForm = document.getElementById('user-form');
        if (userForm) {
            userForm.addEventListener('submit', (e) => this.handleAddUser(e));
        }
        
        // Script generation
        const generateAuthkeyBtn = document.getElementById('generate-authkey-btn');
        if (generateAuthkeyBtn) {
            generateAuthkeyBtn.addEventListener('click', () => this.generateAuthKey());
        }
        
        const generateScriptBtn = document.getElementById('generate-script-btn');
        if (generateScriptBtn) {
            generateScriptBtn.addEventListener('click', () => this.generateScript());
        }
        
        // Additional buttons
        const refreshUsersBtn = document.getElementById('refresh-users-btn');
        if (refreshUsersBtn) {
            refreshUsersBtn.addEventListener('click', () => this.loadUsers());
        }
        
        const refreshLogsBtn = document.getElementById('refresh-logs-btn');
        if (refreshLogsBtn) {
            refreshLogsBtn.addEventListener('click', () => this.loadLogs());
        }
        
        const testApiBtn = document.getElementById('test-api-btn');
        if (testApiBtn) {
            testApiBtn.addEventListener('click', () => this.testApi());
        }
        
        const backupDbBtn = document.getElementById('backup-db-btn');
        if (backupDbBtn) {
            backupDbBtn.addEventListener('click', () => this.backupDatabase());
        }
        
        const cleanupLogsBtn = document.getElementById('cleanup-logs-btn');
        if (cleanupLogsBtn) {
            cleanupLogsBtn.addEventListener('click', () => this.cleanupLogs());
        }
        
        const saveUserBtn = document.getElementById('save-user-btn');
        if (saveUserBtn) {
            saveUserBtn.addEventListener('click', (e) => this.handleAddUser(e));
        }
        
        const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => this.hideDeleteModal());
        }
        
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteUser());
        }
        
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
        
        const notificationArea = document.getElementById('notification-area');
        if (notificationArea) {
            notificationArea.appendChild(notification);
        }
        
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
        const loginModal = document.getElementById('login-modal');
        const app = document.getElementById('app');
        if (loginModal) loginModal.classList.remove('hidden');
        if (app) app.classList.add('hidden');
    }
    
    showApp() {
        const loginModal = document.getElementById('login-modal');
        const app = document.getElementById('app');
        if (loginModal) loginModal.classList.add('hidden');
        if (app) app.classList.remove('hidden');
    }
    
    switchTab(tabName) {
        // Update nav
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active', 'border-white');
        });
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active', 'border-white');
        }
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.classList.remove('hidden');
        }
        
        // Load tab data
        switch (tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'deployment':
                this.loadDeploymentOptions();
                break;
            case 'logs':
                this.loadLogs();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }
    
    async loadDashboard() {
        try {
            await this.updateDashboardStats();
            await this.loadRecentActivity();
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showNotification('Failed to load dashboard data', 'error');
        }
    }
    
    async updateDashboardStats() {
        try {
            const users = await this.fetchUsers();
            
            const totalUsersEl = document.getElementById('total-users');
            if (totalUsersEl) {
                totalUsersEl.textContent = users.length;
            }
            
            const connectedUsersEl = document.getElementById('connected-users');
            if (connectedUsersEl) {
                connectedUsersEl.textContent = users.filter(u => u.status === 'connected').length;
            }
            
            const totalAuthkeysEl = document.getElementById('total-authkeys');
            if (totalAuthkeysEl) {
                totalAuthkeysEl.textContent = users.filter(u => u.authKey).length;
            }
            
            const totalDownloadsEl = document.getElementById('total-downloads');
            if (totalDownloadsEl) {
                totalDownloadsEl.textContent = this.downloadCount;
            }
            
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }
    
    async loadUsers() {
        try {
            const users = await this.fetchUsers();
            const tbody = document.getElementById('users-table');
            
            if (!tbody) return;
            
            if (users.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                            No users added yet. Click "Add User" to get started.
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = users.map(user => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                        <div>
                            <div class="font-medium text-gray-900">${user.name}</div>
                            <div class="text-sm text-gray-500">${user.email}</div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">${user.department || '-'}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 text-xs rounded-full ${this.getStatusClass(user.status)}">
                            ${user.status || 'pending'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                        ${user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td class="px-6 py-4 text-sm font-medium">
                        <button onclick="app.editUser('${user.id}')" 
                                class="text-indigo-600 hover:text-indigo-900 mr-3">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="app.deleteUser('${user.id}')" 
                                class="text-red-600 hover:text-red-900">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showNotification('Failed to load users', 'error');
        }
    }
    
    async loadDeploymentOptions() {
        try {
            const users = await this.fetchUsers();
            const select = document.getElementById('deployment-user');
            
            if (select) {
                select.innerHTML = '<option value="">Choose a user...</option>' +
                    users.map(user => `<option value="${user.id}">${user.name} (${user.email})</option>`).join('');
            }
        } catch (error) {
            console.error('Failed to load deployment options:', error);
        }
    }
    
    async fetchUsers() {
        const response = await fetch(`${this.apiBase}/users`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired');
            }
            throw new Error('Failed to fetch users');
        }
        
        return await response.json();
    }
    
    showAddUserModal() {
        const modal = document.getElementById('user-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    hideAddUserModal() {
        const modal = document.getElementById('user-modal');
        const form = document.getElementById('user-form');
        if (modal) modal.classList.add('hidden');
        if (form) form.reset();
    }
    
    async handleAddUser(e) {
        e.preventDefault();
        
        const userData = {
            name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            department: document.getElementById('user-department').value,
            position: document.getElementById('user-position').value,
            computer_name: document.getElementById('user-computer').value,
            notes: document.getElementById('user-notes').value
        };
        
        try {
            const response = await fetch(`${this.apiBase}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                this.hideAddUserModal();
                this.loadUsers();
                this.updateDashboardStats();
                this.showNotification(`User ${userData.name} added successfully!`, 'success');
            } else {
                const error = await response.json();
                this.showNotification('Failed to add user: ' + error.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error adding user: ' + error.message, 'error');
        }
    }
    
    async generateAuthKey() {
        try {
            const response = await fetch(`${this.apiBase}/auth-keys/generate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                const authkeyInfo = document.getElementById('authkey-info');
                if (authkeyInfo) {
                    authkeyInfo.innerHTML = `
                        <div class="flex items-center text-green-600 mb-2">
                            <i class="fas fa-check-circle mr-2"></i>
                            <span class="font-medium">Auth Key Generated Successfully</span>
                        </div>
                        <p class="text-xs text-gray-500">Expires: ${new Date(data.expires).toLocaleDateString()}</p>
                        <p class="text-xs text-gray-600 mt-1">Key: ${data.authKey.substring(0, 20)}...</p>
                    `;
                }
                this.showNotification('New auth key generated successfully!', 'success');
            } else {
                this.showNotification('Failed to generate auth key: ' + data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error generating auth key: ' + error.message, 'error');
        }
    }
    
    async generateScript() {
        const userId = document.getElementById('deployment-user').value;
        const scriptType = document.querySelector('input[name="script-type"]:checked').value;
        
        if (!userId) {
            this.showNotification('Please select a user', 'warning');
            return;
        }
        
        await this.downloadScript(userId, scriptType);
    }
    
    async downloadScript(userId, scriptType) {
        try {
            const response = await fetch(`${this.apiBase}/scripts/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    userUuid: userId,
                    scriptType
                })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                
                const filename = `tailscale_install_${userId}_${scriptType}.${scriptType === 'powershell' ? 'ps1' : 'bat'}`;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                
                this.downloadCount++;
                this.updateRecentDownloads(userId, scriptType, filename);
                this.showNotification(`Script downloaded: ${filename}`, 'success');
                
            } else {
                const error = await response.json();
                this.showNotification('Failed to download script: ' + error.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error downloading script: ' + error.message, 'error');
        }
    }
    
    updateRecentDownloads(userId, scriptType, filename) {
        const downloadsDiv = document.getElementById('recent-downloads');
        if (!downloadsDiv) return;
        
        const timestamp = new Date().toLocaleString();
        
        const downloadItem = document.createElement('div');
        downloadItem.className = 'flex justify-between items-center p-2 bg-gray-50 rounded';
        downloadItem.innerHTML = `
            <div>
                <span class="font-medium">${filename}</span>
                <span class="text-sm text-gray-500 ml-2">${timestamp}</span>
            </div>
            <span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">${scriptType}</span>
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
    
    editUser(userId) {
        this.showNotification('User editing feature coming soon!', 'info');
    }
    
    deleteUser(userId) {
        this.currentDeleteUserId = userId;
        const modal = document.getElementById('delete-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
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
    
    getStatusClass(status) {
        const classes = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'active': 'bg-green-100 text-green-800',
            'connected': 'bg-blue-100 text-blue-800',
            'inactive': 'bg-gray-100 text-gray-800',
            'error': 'bg-red-100 text-red-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
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
        const modal = document.getElementById('delete-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
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
                this.loadUsers();
                this.updateDashboardStats();
                this.showNotification('User deleted successfully', 'success');
            } else {
                this.showNotification('Failed to delete user', 'error');
            }
        } catch (error) {
            this.showNotification('Error deleting user: ' + error.message, 'error');
        }
    }
    
    async loadRecentActivity() {
        try {
            const response = await fetch(`${this.apiBase}/logs/recent`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const activities = await response.json();
                this.displayRecentActivity(activities);
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }
    
    displayRecentActivity(activities) {
        const activityDiv = document.getElementById('recent-activity');
        if (!activityDiv) return;
        
        if (activities.length === 0) {
            activityDiv.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-clock text-2xl mb-2"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }
        
        activityDiv.innerHTML = activities.map(activity => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center">
                    <i class="fas fa-circle text-xs text-blue-500 mr-3"></i>
                    <span class="text-sm">${activity.action}</span>
                </div>
                <span class="text-xs text-gray-500">${new Date(activity.created_at).toLocaleString()}</span>
            </div>
        `).join('');
    }
    
    loadSettings() {
        // Settings tab is already loaded in HTML
        console.log('Settings tab loaded');
    }
}

// Initialize app
const app = new TailscaleApp();
-- Tailscale Automation Database Schema
-- SQLite Database for User Management

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    position TEXT,
    computer_name TEXT,
    hostname TEXT,
    status TEXT DEFAULT 'pending',
    auth_key_used TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    notes TEXT
);

-- Auth keys table
CREATE TABLE IF NOT EXISTS auth_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT UNIQUE NOT NULL,
    auth_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT DEFAULT 'system',
    notes TEXT
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL, -- DEBUG, INFO, WARN, ERROR
    category TEXT NOT NULL, -- AUTH, USER, SCRIPT, SYSTEM
    message TEXT NOT NULL,
    details JSON,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Deployment tracking table
CREATE TABLE IF NOT EXISTS deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    auth_key_id INTEGER NOT NULL,
    script_downloaded BOOLEAN DEFAULT FALSE,
    script_executed BOOLEAN DEFAULT FALSE,
    tailscale_connected BOOLEAN DEFAULT FALSE,
    deployment_date DATETIME,
    last_seen DATETIME,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (auth_key_id) REFERENCES auth_keys (id)
);

-- Insert default data
INSERT OR IGNORE INTO auth_keys (key_id, auth_key, expires_at, notes) VALUES 
('initial-key', 'tskey-auth-replace-with-real-key', datetime('now', '+90 days'), 'Initial auth key for system setup');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_keys_active ON auth_keys(is_active);

-- Create views for common queries
CREATE VIEW IF NOT EXISTS user_summary AS
SELECT 
    u.id,
    u.uuid,
    u.name,
    u.email,
    u.department,
    u.status,
    u.created_at,
    COUNT(d.id) as deployment_count,
    MAX(d.last_seen) as last_activity
FROM users u
LEFT JOIN deployments d ON u.id = d.user_id
GROUP BY u.id;

CREATE VIEW IF NOT EXISTS recent_activity AS
SELECT 
    al.id,
    al.action,
    al.details,
    al.created_at,
    u.name as user_name,
    u.email as user_email
FROM activity_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 100;

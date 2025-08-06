const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const LOGS_DIR = path.join(__dirname, '../../data/logs');
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Custom format for logs
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        const { timestamp, level, message, category = 'SYSTEM', userId, ip, ...meta } = info;
        
        let logEntry = `[${timestamp}] ${level.toUpperCase()}`;
        
        if (category) logEntry += ` [${category}]`;
        if (userId) logEntry += ` [USER:${userId}]`;
        if (ip) logEntry += ` [IP:${ip}]`;
        
        logEntry += ` ${message}`;
        
        if (Object.keys(meta).length > 0) {
            // Filter out circular references and sensitive data
            const safeMeta = {};
            for (const [key, value] of Object.entries(meta)) {
                if (key !== 'req' && key !== 'socket' && key !== 'connection') {
                    try {
                        JSON.stringify(value); // Test if serializable
                        safeMeta[key] = value;
                    } catch (e) {
                        safeMeta[key] = '[Circular or non-serializable]';
                    }
                }
            }
            if (Object.keys(safeMeta).length > 0) {
                logEntry += ` ${JSON.stringify(safeMeta)}`;
            }
        }
        
        return logEntry;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        // Console output
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                customFormat
            )
        }),
        
        // Error logs
        new winston.transports.File({
            filename: path.join(LOGS_DIR, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        
        // Combined logs
        new winston.transports.File({
            filename: path.join(LOGS_DIR, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 10
        }),
        
        // Auth specific logs
        new winston.transports.File({
            filename: path.join(LOGS_DIR, 'auth.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.printf((info) => {
                    if (info.category === 'AUTH') {
                        return `[${info.timestamp}] ${info.level.toUpperCase()} ${info.message} ${JSON.stringify(info.meta || {})}`;
                    }
                    return false;
                })
            )
        }),
        
        // User activity logs
        new winston.transports.File({
            filename: path.join(LOGS_DIR, 'user_activity.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.printf((info) => {
                    if (info.category === 'USER') {
                        return `[${info.timestamp}] ${info.message} ${JSON.stringify(info.meta || {})}`;
                    }
                    return false;
                })
            )
        })
    ]
});

// Database logger for storing logs in database
class DatabaseLogger {
    constructor(database) {
        this.db = database;
    }

    async log(level, category, message, details = null, req = null) {
        const logEntry = {
            level: level.toUpperCase(),
            category: category.toUpperCase(),
            message,
            details: details ? JSON.stringify(details) : null,
            ip_address: req ? this.getClientIP(req) : null
        };

        try {
            await this.db.run(
                'INSERT INTO system_logs (level, category, message, details, ip_address) VALUES (?, ?, ?, ?, ?)',
                [logEntry.level, logEntry.category, logEntry.message, logEntry.details, logEntry.ip_address]
            );
        } catch (error) {
            logger.error('Failed to write to database log', { error: error.message });
        }
    }

    async logActivity(userId, action, details = null, req = null) {
        try {
            await this.db.run(
                'INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
                [
                    userId, 
                    action, 
                    details ? JSON.stringify(details) : null,
                    req ? this.getClientIP(req) : null,
                    req ? req.get('User-Agent') : null
                ]
            );
        } catch (error) {
            logger.error('Failed to write activity log', { error: error.message });
        }
    }

    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.headers['x-forwarded-for'] || '').split(',').pop().trim() ||
               req.headers['x-real-ip'] ||
               '127.0.0.1';
    }
}

// Enhanced logger with database integration
class EnhancedLogger {
    constructor(database = null) {
        this.winston = logger;
        this.dbLogger = database ? new DatabaseLogger(database) : null;
    }

    info(message, meta = {}) {
        this.winston.info(message, meta);
        if (this.dbLogger) {
            this.dbLogger.log('INFO', meta.category || 'SYSTEM', message, meta.details, meta.req);
        }
    }

    error(message, meta = {}) {
        this.winston.error(message, meta);
        if (this.dbLogger) {
            this.dbLogger.log('ERROR', meta.category || 'SYSTEM', message, meta.details, meta.req);
        }
    }

    warn(message, meta = {}) {
        this.winston.warn(message, meta);
        if (this.dbLogger) {
            this.dbLogger.log('WARN', meta.category || 'SYSTEM', message, meta.details, meta.req);
        }
    }

    debug(message, meta = {}) {
        this.winston.debug(message, meta);
        if (this.dbLogger) {
            this.dbLogger.log('DEBUG', meta.category || 'SYSTEM', message, meta.details, meta.req);
        }
    }

    // Log user activity
    async logActivity(userId, action, details = null, req = null) {
        const message = `User activity: ${action}`;
        this.winston.info(message, { 
            category: 'USER', 
            userId, 
            action,
            details,
            ip: req ? this.getClientIP(req) : null
        });
        
        if (this.dbLogger) {
            await this.dbLogger.logActivity(userId, action, details, req);
        }
    }

    // Log auth events
    logAuth(message, meta = {}) {
        this.winston.info(message, { 
            category: 'AUTH',
            ...meta
        });
        
        if (this.dbLogger) {
            this.dbLogger.log('INFO', 'AUTH', message, meta.details, meta.req);
        }
    }

    getClientIP(req) {
        if (!req) return null;
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.headers['x-forwarded-for'] || '').split(',').pop().trim() ||
               req.headers['x-real-ip'] ||
               '127.0.0.1';
    }
}

module.exports = { logger, EnhancedLogger, DatabaseLogger };

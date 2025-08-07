const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    constructor() {
        // Determine database path
        let dbPath;
        if (process.env.DB_PATH) {
            dbPath = process.env.DB_PATH;
        } else {
            // Try to use current working directory
            const baseDir = process.cwd();
            const dataDir = path.join(baseDir, 'data');
            
            // Ensure data directory exists
            try {
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                dbPath = path.join(dataDir, 'tailscale.db');
            } catch (error) {
                console.warn('Could not create data directory, using fallback path');
                dbPath = path.join(__dirname, '..', 'data', 'tailscale.db');
            }
        }
        
        this.dbPath = dbPath;
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                // Ensure directory exists
                const dir = path.dirname(this.dbPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        console.error('Error opening database:', err.message);
                        reject(err);
                    } else {
                        console.log('Connected to SQLite database:', this.dbPath);
                        resolve();
                    }
                });
            } catch (error) {
                console.error('Error in connect:', error);
                reject(error);
            }
        });
    }

    initDatabase() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
            
            this.db.exec(initSQL, (err) => {
                if (err) {
                    console.error('Error initializing database:', err.message);
                    reject(err);
                } else {
                    console.log('Database initialized successfully');
                    resolve();
                }
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Error running query:', err.message);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Error getting row:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Error getting rows:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                    reject(err);
                } else {
                    console.log('Database connection closed');
                    resolve();
                }
            });
        });
    }

    backup(backupPath) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            const backupDb = new sqlite3.Database(backupPath);
            
            this.db.backup(backupDb, (err) => {
                if (err) {
                    console.error('Error backing up database:', err.message);
                    backupDb.close();
                    reject(err);
                } else {
                    backupDb.close((closeErr) => {
                        if (closeErr) {
                            console.error('Error closing backup database:', closeErr.message);
                            reject(closeErr);
                        } else {
                            console.log('Database backed up successfully to:', backupPath);
                            resolve();
                        }
                    });
                }
            });
        });
    }
}

module.exports = DatabaseManager;

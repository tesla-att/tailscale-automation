class AuthKeyManager {
    constructor(database, tailscaleService, logger) {
        this.db = database;
        this.tailscale = tailscaleService;
        this.logger = logger;
    }

    // Create new auth key and store in database
    async createAuthKey(options = {}, req = null) {
        try {
            // Create key via Tailscale API
            const keyData = await this.tailscale.createAuthKey(options);

            // Store in database
            const result = await this.db.run(
                `INSERT INTO auth_keys (key_id, auth_key, created_at, expires_at, created_by, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    keyData.id,
                    keyData.key,
                    keyData.created,
                    keyData.expires,
                    'admin', // TODO: Get actual user from req
                    keyData.description
                ]
            );

            await this.logger.logActivity(
                null,
                'AUTH_KEY_CREATED',
                {
                    keyId: keyData.id,
                    expiresAt: keyData.expires,
                    tags: keyData.tags
                },
                req
            );

            return {
                dbId: result.id,
                ...keyData
            };

        } catch (error) {
            this.logger.error('Failed to create and store auth key', {
                category: 'AUTH',
                error: error.message,
                options,
                req
            });
            throw error;
        }
    }

    // Get active auth key from database
    async getActiveAuthKey() {
        try {
            const key = await this.db.get(
                `SELECT * FROM auth_keys 
                 WHERE is_active = 1 AND expires_at > datetime('now')
                 ORDER BY created_at DESC LIMIT 1`
            );

            if (!key) {
                this.logger.warn('No active auth key found', {
                    category: 'AUTH'
                });
                return null;
            }

            return key;

        } catch (error) {
            this.logger.error('Failed to get active auth key', {
                category: 'AUTH',
                error: error.message
            });
            throw error;
        }
    }

    // Get or create auth key (ensures we always have a valid key)
    async ensureValidAuthKey(req = null) {
        try {
            // First try to get existing active key
            let activeKey = await this.getActiveAuthKey();

            // Check if key expires within 7 days
            if (activeKey) {
                const expiresAt = new Date(activeKey.expires_at);
                const daysUntilExpiry = (expiresAt - new Date()) / (1000 * 60 * 60 * 24);

                if (daysUntilExpiry > 7) {
                    this.logger.info('Using existing active auth key', {
                        category: 'AUTH',
                        keyId: activeKey.key_id,
                        daysUntilExpiry: Math.round(daysUntilExpiry)
                    });
                    return activeKey;
                }

                this.logger.info('Active key expires soon, creating new one', {
                    category: 'AUTH',
                    keyId: activeKey.key_id,
                    daysUntilExpiry: Math.round(daysUntilExpiry)
                });
            }

            // Create new key
            const newKey = await this.createAuthKey({
                description: `Auto-generated key for Windows deployment - ${new Date().toISOString()}`
            }, req);

            // Deactivate old keys
            await this.db.run(
                'UPDATE auth_keys SET is_active = 0 WHERE id != ?',
                [newKey.dbId]
            );

            this.logger.info('New auth key created and activated', {
                category: 'AUTH',
                keyId: newKey.id,
                expires: newKey.expires
            });

            return await this.db.get('SELECT * FROM auth_keys WHERE id = ?', [newKey.dbId]);

        } catch (error) {
            this.logger.error('Failed to ensure valid auth key', {
                category: 'AUTH',
                error: error.message,
                req
            });
            throw error;
        }
    }

    // Get all auth keys with status
    async getAllAuthKeys() {
        try {
            const keys = await this.db.all(
                `SELECT *, 
                    CASE 
                        WHEN expires_at <= datetime('now') THEN 'expired'
                        WHEN expires_at <= datetime('now', '+7 days') THEN 'expiring'
                        ELSE 'active'
                    END as status
                 FROM auth_keys 
                 ORDER BY created_at DESC`
            );

            return keys;

        } catch (error) {
            this.logger.error('Failed to get all auth keys', {
                category: 'AUTH',
                error: error.message
            });
            throw error;
        }
    }

    // Update auth key usage
    async recordKeyUsage(keyId, userId = null, req = null) {
        try {
            await this.db.run(
                'UPDATE auth_keys SET usage_count = usage_count + 1 WHERE id = ?',
                [keyId]
            );

            await this.logger.logActivity(
                userId,
                'AUTH_KEY_USED',
                { keyId },
                req
            );

        } catch (error) {
            this.logger.error('Failed to record key usage', {
                category: 'AUTH',
                error: error.message,
                keyId,
                userId
            });
        }
    }

    // Clean up expired keys
    async cleanupExpiredKeys(keepCount = 5) {
        try {
            // Get expired keys (older than the most recent keepCount)
            const expiredKeys = await this.db.all(
                `SELECT * FROM auth_keys 
                 WHERE expires_at <= datetime('now')
                 ORDER BY created_at DESC
                 LIMIT -1 OFFSET ?`,
                [keepCount]
            );

            let deletedCount = 0;

            for (const key of expiredKeys) {
                try {
                    // Try to delete from Tailscale (may fail if already deleted)
                    await this.tailscale.deleteAuthKey(key.key_id);
                } catch (error) {
                    this.logger.warn('Could not delete key from Tailscale (may already be deleted)', {
                        category: 'AUTH',
                        keyId: key.key_id,
                        error: error.message
                    });
                }

                // Delete from database
                await this.db.run('DELETE FROM auth_keys WHERE id = ?', [key.id]);
                deletedCount++;
            }

            if (deletedCount > 0) {
                this.logger.info('Cleaned up expired auth keys', {
                    category: 'AUTH',
                    deletedCount
                });
            }

            return deletedCount;

        } catch (error) {
            this.logger.error('Failed to cleanup expired keys', {
                category: 'AUTH',
                error: error.message
            });
            throw error;
        }
    }

    // Get auth key statistics
    async getStatistics() {
        try {
            const stats = await this.db.get(`
                SELECT 
                    COUNT(*) as total_keys,
                    COUNT(CASE WHEN expires_at > datetime('now') THEN 1 END) as active_keys,
                    COUNT(CASE WHEN expires_at <= datetime('now') THEN 1 END) as expired_keys,
                    COUNT(CASE WHEN expires_at <= datetime('now', '+7 days') AND expires_at > datetime('now') THEN 1 END) as expiring_soon,
                    SUM(usage_count) as total_usage
                FROM auth_keys
            `);

            return stats;

        } catch (error) {
            this.logger.error('Failed to get auth key statistics', {
                category: 'AUTH',
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = AuthKeyManager;

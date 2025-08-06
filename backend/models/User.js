const { v4: uuidv4 } = require('uuid');

class User {
    constructor(database, logger) {
        this.db = database;
        this.logger = logger;
    }

    // Create new user
    async create(userData, req = null) {
        const { name, email, department, position = '', computer_name = '', notes = '' } = userData;
        
        // Generate unique identifiers
        const userUuid = uuidv4();
        const hostname = this.generateHostname(name, userUuid);
        
        // Validate required fields
        if (!name || !email || !department) {
            throw new Error('Name, email, and department are required');
        }

        // Check if email already exists
        const existingUser = await this.db.get(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        
        if (existingUser) {
            throw new Error('Email already exists');
        }

        try {
            const result = await this.db.run(
                `INSERT INTO users (uuid, name, email, department, position, computer_name, hostname, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userUuid, name, email, department, position, computer_name, hostname, notes]
            );

            await this.logger.logActivity(
                result.id,
                'USER_CREATED',
                { name, email, department },
                req
            );

            return await this.getById(result.id);
        } catch (error) {
            this.logger.error('Failed to create user', {
                category: 'USER',
                error: error.message,
                userData,
                req
            });
            throw error;
        }
    }

    // Get user by ID
    async getById(id) {
        try {
            const user = await this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [id]
            );
            return user;
        } catch (error) {
            this.logger.error('Failed to get user by ID', {
                category: 'USER',
                error: error.message,
                userId: id
            });
            throw error;
        }
    }

    // Get user by UUID
    async getByUuid(uuid) {
        try {
            const user = await this.db.get(
                'SELECT * FROM users WHERE uuid = ?',
                [uuid]
            );
            return user;
        } catch (error) {
            this.logger.error('Failed to get user by UUID', {
                category: 'USER',
                error: error.message,
                uuid
            });
            throw error;
        }
    }

    // Get user by email
    async getByEmail(email) {
        try {
            const user = await this.db.get(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );
            return user;
        } catch (error) {
            this.logger.error('Failed to get user by email', {
                category: 'USER',
                error: error.message,
                email
            });
            throw error;
        }
    }

    // Get all users with pagination
    async getAll(page = 1, limit = 50, filters = {}) {
        const offset = (page - 1) * limit;
        let whereClause = [];
        let params = [];

        // Build filters
        if (filters.department) {
            whereClause.push('department LIKE ?');
            params.push(`%${filters.department}%`);
        }

        if (filters.status) {
            whereClause.push('status = ?');
            params.push(filters.status);
        }

        if (filters.search) {
            whereClause.push('(name LIKE ? OR email LIKE ?)');
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
        
        try {
            // Get users
            const users = await this.db.all(
                `SELECT * FROM users ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            // Get total count
            const countResult = await this.db.get(
                `SELECT COUNT(*) as total FROM users ${whereSQL}`,
                params
            );

            return {
                users,
                pagination: {
                    page,
                    limit,
                    total: countResult.total,
                    pages: Math.ceil(countResult.total / limit)
                }
            };
        } catch (error) {
            this.logger.error('Failed to get users', {
                category: 'USER',
                error: error.message,
                filters
            });
            throw error;
        }
    }

    // Update user
    async update(id, updateData, req = null) {
        const { name, email, department, position, computer_name, status, notes } = updateData;
        
        // Get current user data
        const currentUser = await this.getById(id);
        if (!currentUser) {
            throw new Error('User not found');
        }

        // Check if email is being changed and if new email exists
        if (email && email !== currentUser.email) {
            const existingUser = await this.db.get(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );
            
            if (existingUser) {
                throw new Error('Email already exists');
            }
        }

        try {
            // Build update query
            const updates = [];
            const params = [];

            if (name !== undefined) { updates.push('name = ?'); params.push(name); }
            if (email !== undefined) { updates.push('email = ?'); params.push(email); }
            if (department !== undefined) { updates.push('department = ?'); params.push(department); }
            if (position !== undefined) { updates.push('position = ?'); params.push(position); }
            if (computer_name !== undefined) { updates.push('computer_name = ?'); params.push(computer_name); }
            if (status !== undefined) { updates.push('status = ?'); params.push(status); }
            if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            await this.db.run(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            await this.logger.logActivity(
                id,
                'USER_UPDATED',
                { changes: updateData },
                req
            );

            return await this.getById(id);
        } catch (error) {
            this.logger.error('Failed to update user', {
                category: 'USER',
                error: error.message,
                userId: id,
                updateData,
                req
            });
            throw error;
        }
    }

    // Delete user
    async delete(id, req = null) {
        const user = await this.getById(id);
        if (!user) {
            throw new Error('User not found');
        }

        try {
            // Delete related records first
            await this.db.run('DELETE FROM deployments WHERE user_id = ?', [id]);
            await this.db.run('DELETE FROM activity_logs WHERE user_id = ?', [id]);
            
            // Delete user
            await this.db.run('DELETE FROM users WHERE id = ?', [id]);

            await this.logger.logActivity(
                null,
                'USER_DELETED',
                { deletedUser: { id, name: user.name, email: user.email } },
                req
            );

            return true;
        } catch (error) {
            this.logger.error('Failed to delete user', {
                category: 'USER',
                error: error.message,
                userId: id,
                req
            });
            throw error;
        }
    }

    // Update user status
    async updateStatus(id, status, req = null) {
        const validStatuses = ['pending', 'active', 'inactive', 'connected', 'error'];
        
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid status');
        }

        try {
            await this.db.run(
                'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, id]
            );

            await this.logger.logActivity(
                id,
                'STATUS_UPDATED',
                { status },
                req
            );

            return await this.getById(id);
        } catch (error) {
            this.logger.error('Failed to update user status', {
                category: 'USER',
                error: error.message,
                userId: id,
                status,
                req
            });
            throw error;
        }
    }

    // Generate hostname from name and UUID
    generateHostname(name, uuid) {
        const cleanName = name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 20);
        
        const shortUuid = uuid.substring(0, 8);
        return `${cleanName}-${shortUuid}`;
    }

    // Get user statistics
    async getStatistics() {
        try {
            const stats = await this.db.all(`
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
                    COUNT(CASE WHEN status = 'connected' THEN 1 END) as connected_users,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_users,
                    COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as new_this_week
                FROM users
            `);

            const departments = await this.db.all(`
                SELECT department, COUNT(*) as count
                FROM users
                GROUP BY department
                ORDER BY count DESC
            `);

            return {
                overview: stats[0],
                departments
            };
        } catch (error) {
            this.logger.error('Failed to get user statistics', {
                category: 'USER',
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = User;

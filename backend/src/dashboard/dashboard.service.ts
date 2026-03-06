import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { User } from '../model/user.entity';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        @InjectRepository(User)
        private readonly usersRepository: EntityRepository<User>,
        private readonly em: EntityManager,
    ) { }

    async getDashboardStats() {
        const totalUsers = await this.usersRepository.count();
        const activeUsers = await this.usersRepository.count({ isActive: true });

        return {
            totalUsers,
            activeUsers,
            systemStatus: 'Operational',
            lastBackup: new Date().toISOString(),
        };
    }

    // INTENTIONAL VULNERABILITY: Read-Only SQL Injection
    // This method uses raw SQL with unsanitized input for the search query.
    // It is intended for training purposes to demonstrate SQL injection.
    // Secure version should use parameterized queries or the ORM's query builder.
    async getSystemLogs(search: string = '') {
        this.logger.debug(`Fetching system logs with search: ${search}`);

        // Vulnerable query construction
        // We try to restrict it to SELECT only to prevent data modification,
        // but this is still a major vulnerability.
        let query = `SELECT * FROM system_logs`;

        if (search) {
            query += ` WHERE message LIKE '%${search}%'`;
        }

        query += ` ORDER BY created_at DESC LIMIT 50`;

        try {
            // Using the entity manager to execute raw SQL
            const connection = this.em.getConnection();
            const results = await connection.execute(query);
            return results;
        } catch (error) {
            this.logger.error(`Error executing log query: ${error.message}`);
            // Return the error to the user to help with SQLi exploitation (training)
            return { error: error.message, query };
        }
    }

    async getRecentActivities() {
        // Mock data for now, would normally come from a real logs table
        return [
            { id: 1, user: 'admin', action: 'Login', timestamp: new Date() },
            { id: 2, user: 'hashira1', action: 'Viewed Profile', timestamp: new Date() },
            { id: 3, user: 'demon_hunter', action: 'Updated Status', timestamp: new Date() },
        ];
    }

    // INTENTIONAL VULNERABILITY: IDOR - returns any user by id without ownership/admin check
    async getUserProfileById(id: string) {
        const user = await this.usersRepository.findOne(
            { id: Number(id) },
            { fields: ['id', 'email', 'firstName', 'lastName', 'role', 'company', 'phoneNumber', 'cardNumber'] }
        );
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            company: user.company,
            phoneNumber: user.phoneNumber,
            cardNumber: user.cardNumber,
        };
    }

    // INTENTIONAL VULNERABILITY: Mass assignment - applies all body fields including role, isAdmin
    async updateCurrentUser(email: string, body: Record<string, unknown>) {
        const user = await this.usersRepository.findOneOrFail({ email });
        if (body.firstName !== undefined) user.firstName = body.firstName as string;
        if (body.lastName !== undefined) user.lastName = body.lastName as string;
        if (body.role !== undefined) user.role = body.role as string;
        if (body.isAdmin !== undefined) user.isAdmin = body.isAdmin as boolean;
        await this.em.flush();
        return { email: user.email, role: user.role, isAdmin: user.isAdmin };
    }

    // INTENTIONAL: SQLi in filter (auth-only - adds finding after login)
    async getActivitiesFiltered(filter: string = '') {
        let query = `SELECT id, user, action, created_at FROM system_logs`;
        if (filter) {
            query += ` WHERE action LIKE '%${filter}%'`;
        }
        query += ` ORDER BY created_at DESC LIMIT 20`;
        try {
            const connection = this.em.getConnection();
            const results = await connection.execute(query);
            return { activities: results };
        } catch (error) {
            return { error: error.message, query };
        }
    }

    // INTENTIONAL: Path traversal (auth-only) - no check that resolved path stays under base
    async downloadFile(file: string) {
        const path = require('path');
        const fs = require('fs').promises;
        const base = path.join(process.cwd(), 'reports');
        const resolved = path.resolve(base, file);
        try {
            const content = await fs.readFile(resolved, 'utf8');
            return { content, filename: file };
        } catch (e) {
            return { error: e.message, stack: e.stack };
        }
    }

    // INTENTIONAL: SSRF (auth-only) - fetch URL server-side
    async fetchUrl(url: string) {
        try {
            const res = await fetch(url, { method: 'GET', redirect: 'follow' });
            const text = await res.text();
            return { url, status: res.status, body: text.slice(0, 2000) };
        } catch (e) {
            return { error: e.message };
        }
    }

    async getInternalSecrets() {
        return {
            internalApiKey: 'dashboard_internal_sk_live_abc123',
            dbBackupPassword: 'backup_secret_456',
            note: 'Intentional leak for auth-only pentesting'
        };
    }

    async triggerVerboseError(trigger: string) {
        if (trigger === '1' || trigger === 'stack') {
            const err = new Error('Intentional verbose error for pentesting');
            return {
                error: err.message,
                stack: err.stack,
                note: 'Stack trace exposure (auth only)'
            };
        }
        return { message: 'Use ?trigger=1 or ?trigger=stack' };
    }

    // Extra auth-only exposures for Nuclei (target ~32 findings with auth scan)
    async getEnvExposure() {
        return {
            NODE_ENV: process.env.NODE_ENV,
            DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:secret@db:5432/demonslayer',
            JWT_SECRET: process.env.JWT_SECRET || 'default_jwt_secret_change_in_prod',
            ...process.env,
            _note: 'Intentional env exposure (auth only)'
        };
    }

    async getConfigExposure() {
        return {
            config: {
                database: {
                    host: process.env.DATABASE_HOST || 'db',
                    password: process.env.DATABASE_PASSWORD || 'postgres_secret'
                },
                apiKey: 'sk_live_dashboard_config_leak_xyz789',
                internalServiceUrl: 'http://internal-api:4000'
            },
            _note: 'Intentional config exposure (auth only)'
        };
    }

    async getTraceExposure() {
        const err = new Error('Trace for pentesting');
        return {
            stack: err.stack,
            trace: err.stack?.split('\n'),
            _note: 'Intentional stack trace (auth only)'
        };
    }

    async getVersionExposure() {
        let version = '1.0.0';
        try {
            const path = require('path');
            const fs = require('fs');
            const pkgPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                version = pkg.version || version;
            }
        } catch {
            // use default version
        }
        return {
            version,
            nodeVersion: process.version,
            platform: process.platform,
            execPath: process.execPath,
            buildId: 'build-2024-dashboard-leak',
            _note: 'Intentional version/build exposure (auth only)'
        };
    }
}

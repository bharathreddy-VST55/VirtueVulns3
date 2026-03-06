import { Controller, Get, Patch, UseGuards, Query, Param, Body, HttpException, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { DashboardService } from './dashboard.service';
import { FastifyRequest } from 'fastify';

/** Decode JWT payload from Authorization header (no verify; guard already verified). For training vulns only. */
function getJwtPayload(req: FastifyRequest): { user?: string; role?: string; isAdmin?: boolean } {
    const auth = req.headers.authorization;
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) return {};
    const token = auth.slice(7).trim();
    try {
        const payload = token.split('.')[1];
        return JSON.parse(Buffer.from(payload, 'base64url').toString()) || {};
    } catch {
        return {};
    }
}

@ApiTags('Dashboard')
@Controller('api/dashboard')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('stats')
    @ApiOperation({ summary: 'Get dashboard statistics' })
    async getStats() {
        return this.dashboardService.getDashboardStats();
    }

    @Get('logs')
    @ApiOperation({ summary: 'Get system logs (Vulnerable to SQLi)' })
    @ApiQuery({ name: 'search', required: false, description: 'Search term for logs' })
    async getLogs(@Query('search') search: string) {
        return this.dashboardService.getSystemLogs(search);
    }

    @Get('activities')
    @ApiOperation({ summary: 'Get recent activities' })
    async getActivities() {
        return this.dashboardService.getRecentActivities();
    }

    // INTENTIONAL VULNERABILITY: IDOR (Insecure Direct Object Reference)
    // Allows accessing any user's private notes by ID without checking ownership.
    // Secure version should check if the requesting user owns the note or has admin privileges.
    @Get('notes/:id')
    @ApiOperation({ summary: 'Get user note by ID (Vulnerable to IDOR)' })
    async getUserNote(@Param('id') id: string) {
        // Mocking a database lookup
        const notes = {
            '1': { userId: 1, content: 'Admin secret note: The treasure is hidden in the cave.' },
            '2': { userId: 2, content: 'User 2 note: I need to buy milk.' },
            '3': { userId: 3, content: 'User 3 note: Meeting at 5 PM.' },
        };

        const note = notes[id];
        if (!note) {
            throw new HttpException('Note not found', HttpStatus.NOT_FOUND);
        }

        // VULNERABILITY: No check if the current user owns this note!
        return note;
    }

    // INTENTIONAL VULNERABILITY: Weak Role Check
    // Checks for a custom header 'X-Role' instead of the actual JWT role claim.
    // This allows anyone to bypass role restrictions by simply setting this header.
    @Get('admin-data')
    @ApiOperation({ summary: 'Get admin specific data (Vulnerable to Header Manipulation)' })
    async getAdminData(@Req() req: FastifyRequest) {
        const roleHeader = req.headers['x-role'];

        // VULNERABILITY: Trusting client-provided header for authorization
        if (roleHeader !== 'super_admin') {
            // We still return some data, but maybe less? Or just throw a weak error?
            // Let's throw an error to simulate a "check", but a weak one.
            throw new HttpException('Access denied. Requires X-Role: super_admin header.', HttpStatus.FORBIDDEN);
        }

        return {
            secretData: 'This is top secret admin data.',
            adminCodes: [1234, 5678, 9012],
        };
    }

    // INTENTIONAL VULNERABILITY: IDOR (Insecure Direct Object Reference)
    // Returns any user's profile by ID without checking if the requester is that user or an admin.
    // Secure version should compare id with current user or require admin role.
    @Get('users/:id')
    @ApiOperation({ summary: 'Get user profile by ID (Vulnerable to IDOR)' })
    async getUserProfile(@Param('id') id: string) {
        return this.dashboardService.getUserProfileById(id);
    }

    // INTENTIONAL VULNERABILITY: Mass assignment / privilege escalation
    // Accepts role and isAdmin from body and updates the current user without whitelisting allowed fields.
    // Secure version should only allow safe fields (e.g. firstName, lastName) and never trust client for role/isAdmin.
    @Patch('me')
    @ApiOperation({ summary: 'Update current user (Vulnerable to Mass Assignment)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                role: { type: 'string' },
                isAdmin: { type: 'boolean' }
            }
        }
    })
    async updateMe(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
        const payload = getJwtPayload(req);
        const email = payload?.user;
        if (!email) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        return this.dashboardService.updateCurrentUser(email, body);
    }

    // INTENTIONAL VULNERABILITY: Trusting JWT role claim without server-side re-check
    // Only checks payload.role === 'super_admin' from the (already validated) JWT.
    // If learners can forge a JWT (e.g. via weak-key or alg:none), they can set role to super_admin and access this.
    // Secure version should use AdminGuard / DB check for role.
    @Get('admin-reports')
    @ApiOperation({ summary: 'Get admin reports (Vulnerable: trusts JWT role only)' })
    async getAdminReports(@Req() req: FastifyRequest) {
        const payload = getJwtPayload(req);
        if (payload?.role !== 'super_admin') {
            throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
        }
        return {
            reports: ['Secret Report 1', 'Secret Report 2'],
            internalNote: 'Only real admins should see this.'
        };
    }

    // --- AUTH-ONLY VULNS: More findings after login (for Nuclei before vs after login difference) ---

    // INTENTIONAL: Info disclosure - env/debug only when authenticated (adds to "after login" count)
    @Get('debug')
    @ApiOperation({ summary: '[Auth only] Debug info - env leakage' })
    @ApiQuery({ name: 'key', required: false })
    async getDebug(@Query('key') key: string) {
        const internalKey = process.env.DASHBOARD_DEBUG_KEY || 'internal_debug_key_123';
        if (key === internalKey) {
            return {
                env: process.env,
                nodeVersion: process.version,
                cwd: process.cwd(),
                note: 'Intentional info disclosure for pentesting (auth required)'
            };
        }
        return { message: 'Debug disabled. Use ?key= to enable.', hint: 'Check DASHBOARD_DEBUG_KEY' };
    }

    // INTENTIONAL: Reflected XSS - search query echoed in response (Nuclei reflected XSS / injection)
    @Get('search')
    @ApiOperation({ summary: '[Auth only] Search - reflected input (XSS)' })
    @ApiQuery({ name: 'q', required: false })
    async search(@Query('q') q: string) {
        return {
            query: q ?? '',
            results: [],
            message: `No results for "${q ?? ''}". Intentional reflected input for pentesting.`
        };
    }

    // INTENTIONAL: Second SQLi in dashboard (activities filter) - adds SQLi finding when authenticated
    @Get('activities/filter')
    @ApiOperation({ summary: '[Auth only] Filter activities - SQLi' })
    @ApiQuery({ name: 'filter', required: false })
    async getActivitiesFiltered(@Query('filter') filter: string) {
        return this.dashboardService.getActivitiesFiltered(filter);
    }

    // INTENTIONAL: Path traversal - file read (auth only)
    @Get('download')
    @ApiOperation({ summary: '[Auth only] Download report - path traversal' })
    @ApiQuery({ name: 'file', required: true })
    async download(@Query('file') file: string) {
        return this.dashboardService.downloadFile(file);
    }

    // INTENTIONAL: SSRF - fetch URL server-side (auth only)
    @Get('fetch')
    @ApiOperation({ summary: '[Auth only] Fetch URL - SSRF' })
    @ApiQuery({ name: 'url', required: true })
    async fetchUrl(@Query('url') url: string) {
        return this.dashboardService.fetchUrl(url);
    }

    // INTENTIONAL: Another secrets leak only when authenticated
    @Get('internal-secrets')
    @ApiOperation({ summary: '[Auth only] Internal secrets (info disclosure)' })
    async getInternalSecrets() {
        return this.dashboardService.getInternalSecrets();
    }

    // INTENTIONAL: Verbose error / stack trace in response (auth only)
    @Get('error-test')
    @ApiOperation({ summary: '[Auth only] Triggers verbose error (stack trace leak)' })
    @ApiQuery({ name: 'trigger', required: false })
    async errorTest(@Query('trigger') trigger: string) {
        return this.dashboardService.triggerVerboseError(trigger);
    }

    @Get('env')
    @ApiOperation({ summary: '[Auth only] Environment variables exposure' })
    async getEnv() {
        return this.dashboardService.getEnvExposure();
    }

    @Get('config')
    @ApiOperation({ summary: '[Auth only] App config with secrets' })
    async getConfig() {
        return this.dashboardService.getConfigExposure();
    }

    @Get('trace')
    @ApiOperation({ summary: '[Auth only] Stack trace exposure' })
    async getTrace() {
        return this.dashboardService.getTraceExposure();
    }

    @Get('version')
    @ApiOperation({ summary: '[Auth only] Version and build info' })
    async getVersion() {
        return this.dashboardService.getVersionExposure();
    }
}

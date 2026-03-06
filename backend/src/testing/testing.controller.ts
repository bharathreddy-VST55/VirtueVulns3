import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';

/**
 * Testing Controller - Dummy endpoints for security testing.
 * Only registered when TESTCASE or ENABLE_TESTING_ENDPOINTS is 'true'.
 * When disabled, this controller is not loaded — /api/testing/* does not exist (same 404 as any unknown route).
 */
@Controller('/api/testing')
@ApiTags('Testing controller')
export class TestingController {
    @Get('/bharath')
    @ApiOperation({
        description: 'Dummy endpoint - Returns 200 OK. For testing purposes only.'
    })
    @ApiOkResponse({
        description: 'Success response',
        schema: {
            type: 'object',
            properties: {
                endpoint: { type: 'string' },
                status: { type: 'string' },
                message: { type: 'string' },
                timestamp: { type: 'string' }
            }
        }
    })
    async bharath(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.status(HttpStatus.OK);
        return {
            endpoint: 'bharath',
            status: 'success',
            message: 'Bharath endpoint - 200 OK',
            timestamp: new Date().toISOString()
        };
    }

    @Get('/sravan')
    @ApiOperation({
        description: 'Dummy endpoint - Returns 302 Found with redirect. For testing purposes only.'
    })
    @ApiResponse({
        status: 302,
        description: 'Redirect response'
    })
    async sravan(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.status(HttpStatus.FOUND);
        reply.header('Location', '/api/testing/bharath');
        return {
            endpoint: 'sravan',
            status: 'redirect',
            message: 'Sravan endpoint - 302 Found',
            redirectTo: '/api/testing/bharath',
            timestamp: new Date().toISOString()
        };
    }

    @Get('/demon')
    @ApiOperation({
        description: 'Dummy endpoint - Returns 200 OK with demon-themed response. For testing purposes only.'
    })
    @ApiOkResponse({
        description: 'Success response with demon theme',
        schema: {
            type: 'object',
            properties: {
                endpoint: { type: 'string' },
                status: { type: 'string' },
                theme: { type: 'string' },
                message: { type: 'string' },
                timestamp: { type: 'string' }
            }
        }
    })
    async demon(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.status(HttpStatus.OK);
        return {
            endpoint: 'demon',
            status: 'success',
            theme: 'demon-slayer',
            message: 'Demon endpoint - 200 OK - A powerful demon has appeared!',
            timestamp: new Date().toISOString()
        };
    }

    @Get('/katana')
    @ApiOperation({
        description: 'Dummy endpoint - Returns 302 Found with redirect to demon endpoint. For testing purposes only.'
    })
    @ApiResponse({
        status: 302,
        description: 'Redirect to demon endpoint'
    })
    async katana(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.status(HttpStatus.FOUND);
        reply.header('Location', '/api/testing/demon');
        return {
            endpoint: 'katana',
            status: 'redirect',
            theme: 'demon-slayer',
            message: 'Katana endpoint - 302 Found - Strike with the demon blade!',
            redirectTo: '/api/testing/demon',
            timestamp: new Date().toISOString()
        };
    }

    @Get('/katan')
    @ApiOperation({
        description: 'Dummy endpoint - Returns 302 Found with redirect to demon endpoint. Alias for /katana. For testing purposes only.'
    })
    @ApiResponse({
        status: 302,
        description: 'Redirect to demon endpoint'
    })
    async katan(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.status(HttpStatus.FOUND);
        reply.header('Location', '/api/testing/demon');
        return {
            endpoint: 'katan',
            status: 'redirect',
            theme: 'demon-slayer',
            message: 'Katan endpoint - 302 Found - Strike with the demon blade!',
            redirectTo: '/api/testing/demon',
            timestamp: new Date().toISOString()
        };
    }

    @Get('/status')
    @ApiOperation({
        description: 'Check if testing endpoints are enabled'
    })
    @ApiOkResponse({
        description: 'Testing endpoints status',
        schema: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                message: { type: 'string' }
            }
        }
    })
    async getStatus() {
        return { enabled: true, message: 'Testing endpoints are enabled' };
    }
    @Get('/ping')
    @ApiOperation({
        description: 'Dummy endpoint - Returns 200 OK. For testing purposes only.'
    })
    @ApiOkResponse({
        description: 'Success response',
        schema: {
            type: 'object',
            properties: {
                endpoint: { type: 'string' },
                status: { type: 'string' },
                message: { type: 'string' },
                timestamp: { type: 'string' }
            }
        }
    })
    async ping(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.status(HttpStatus.OK);
        return {
            endpoint: 'ping',
            status: 'success',
            message: 'ping endpoint - 200 OK',
            timestamp: new Date().toISOString()
        };
    }

}

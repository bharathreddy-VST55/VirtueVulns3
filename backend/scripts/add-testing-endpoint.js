#!/usr/bin/env node
/**
 * Add a new GET endpoint to TestingController by name.
 *
 * Usage:
 *   node scripts/add-testing-endpoint.js <endpoint-name>
 *   node scripts/add-testing-endpoint.js hello
 *   node scripts/add-testing-endpoint.js my_custom_route
 *
 * This inserts a new GET /api/testing/<name> handler into
 * backend/src/testing/testing.controller.ts (before the closing brace of the class).
 * The endpoint respects ENABLE_TESTING_ENDPOINTS (404 when disabled).
 */

const fs = require('fs');
const path = require('path');

const CONTROLLER_PATH = path.join(__dirname, '..', 'src', 'testing', 'testing.controller.ts');

// Sanitize: only allow letters, numbers, underscore for path and method name
function sanitize(name) {
  if (!name || typeof name !== 'string') return null;
  const cleaned = name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'endpoint';
  return cleaned === 'status' || cleaned === 'getStatus' ? null : cleaned; // avoid overwriting /status
}

function main() {
  const name = process.argv[2];
  const sanitized = sanitize(name);
  if (!sanitized) {
    console.error('Usage: node scripts/add-testing-endpoint.js <endpoint-name>');
    console.error('Example: node scripts/add-testing-endpoint.js hello');
    console.error('Endpoint name must be alphanumeric (underscores allowed). Cannot use "status".');
    process.exit(1);
  }

  let content;
  try {
    content = fs.readFileSync(CONTROLLER_PATH, 'utf8');
  } catch (e) {
    console.error('Could not read controller:', CONTROLLER_PATH, e.message);
    process.exit(1);
  }

  // Check if this path already exists
  if (content.includes(`@Get('/${sanitized}')`) || content.includes(`async ${sanitized}(`)) {
    console.error(`Endpoint "/${sanitized}" already exists in testing.controller.ts`);
    process.exit(1);
  }

  const insertBlock = `
    @Get('/${sanitized}')
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
    async ${sanitized}(@Res({ passthrough: true }) reply: FastifyReply) {
        if (!this.checkEnabled(reply)) return;

        reply.status(HttpStatus.OK);
        return {
            endpoint: '${sanitized}',
            status: 'success',
            message: '${sanitized} endpoint - 200 OK',
            timestamp: new Date().toISOString()
        };
    }
`;

  // Insert before the final closing brace of the class (last `}\n` that closes TestingController)
  const lastBrace = content.lastIndexOf('\n}');
  if (lastBrace === -1) {
    console.error('Could not find class closing brace in controller.');
    process.exit(1);
  }
  const before = content.slice(0, lastBrace);
  const after = content.slice(lastBrace);
  const newContent = before + insertBlock + after;

  try {
    fs.writeFileSync(CONTROLLER_PATH, newContent, 'utf8');
  } catch (e) {
    console.error('Could not write controller:', e.message);
    process.exit(1);
  }

  console.log('Added endpoint: GET /api/testing/' + sanitized);
  console.log('File updated: ' + CONTROLLER_PATH);
}

main();

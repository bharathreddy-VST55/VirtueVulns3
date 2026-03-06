# Backend Scripts

## Add a testing endpoint by name

Adds a new **GET** endpoint under `/api/testing/<name>` to `src/testing/testing.controller.ts` without editing the file manually.

### Usage

From the **backend** directory:

```bash
# Using node directly (pass the endpoint name as argument)
node scripts/add-testing-endpoint.js <name>

# Examples
node scripts/add-testing-endpoint.js hello
node scripts/add-testing-endpoint.js my_route
node scripts/add-testing-endpoint.js health_check
```

Using npm script (from backend folder):

```bash
npm run add-endpoint -- hello
npm run add-endpoint -- my_route
```

### Rules

- **Name:** Letters, numbers, and underscores only. Other characters are replaced with `_`.
- **Reserved:** You cannot use `status` (that route already exists).
- **Duplicate:** If the path already exists, the script exits without changing the file.

### Result

- New route: **GET** `/api/testing/<name>`
- Same behavior as existing dummy endpoints: returns 200 with `{ endpoint, status, message, timestamp }` when `ENABLE_TESTING_ENDPOINTS=true`, otherwise 404.
- The controller file is updated in place; restart the server to use the new endpoint.

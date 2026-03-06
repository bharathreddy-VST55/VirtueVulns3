# API testing – how it works and where to change things

## How the API tests work

The backend has **unit tests** for the **testing controller** (`/api/testing/*`):

- **Tool:** Jest + NestJS `Test.createTestingModule`
- **Spec file:** `backend/src/testing/testing.controller.spec.ts`
- **Run:** From `backend/` run:
  ```bash
  npm run test
  ```
  Or only the testing controller:
  ```bash
  npm run test -- --testPathPattern=testing.controller.spec
  ```

Tests do **not** start the real server. They build a minimal Nest module with `TestingController` and call its methods, so:

- **Enabled/disabled** is controlled by `process.env.TESTCASE` or `process.env.ENABLE_TESTING_ENDPOINTS` inside each test.
- **HTTP** is simulated: a mock `FastifyReply` is passed so we can assert `status()` and `send()` calls.

---

## Where you need to make changes

### 1. Run existing tests

| Goal              | Command (from `backend/`) |
|-------------------|---------------------------|
| All unit tests    | `npm run test`            |
| Only testing API  | `npm run test -- --testPathPattern=testing.controller.spec` |
| Watch mode        | `npm run test:watch`      |
| With coverage     | `npm run test:cov`        |

Make sure dependencies are installed: `npm install` in `backend/`.

---

### 2. Change or add tests for `/api/testing` endpoints

**File to edit:** `backend/src/testing/testing.controller.spec.ts`

- **Change behavior:** Edit the corresponding `describe` / `it` block (e.g. `getStatus`, `bharath`, `demon`).
- **Add a test for a new endpoint:** Add a new `it('...', async () => { ... })` in the right `describe` (e.g. “dummy endpoints (when enabled)”). Use the same pattern:
  - Set `process.env.ENABLE_TESTING_ENDPOINTS = 'true'` (or `'false'`) before creating the module if the test depends on it.
  - Create the module with `Test.createTestingModule({ controllers: [TestingController] }).compile()`.
  - Get the controller and call the new method with `mockReply`, then assert `mockReply.status` and the return value.

Example for a new endpoint `GET /api/testing/hello`:

```ts
it('hello returns 200 when enabled', async () => {
  process.env.ENABLE_TESTING_ENDPOINTS = 'true';
  const module = await Test.createTestingModule({
    controllers: [TestingController]
  }).compile();
  const ctrl = module.get<TestingController>(TestingController);
  const result = await (ctrl as any).hello(mockReply);
  expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
  expect(result.endpoint).toBe('hello');
});
```

---

### 3. Add a new endpoint (route only, no test)

Use the script so the new route is registered in the controller:

```bash
# From backend/
node scripts/add-testing-endpoint.js <name>
# e.g. node scripts/add-testing-endpoint.js hello
```

This only adds the handler in `backend/src/testing/testing.controller.ts`. It does **not** add a test; add that manually in `testing.controller.spec.ts` as above.

---

### 4. Test other API controllers (e.g. `/api/users`, `/api/auth`)

- **Option A – Unit test:** Next to the controller, add `*.controller.spec.ts` (e.g. `users.controller.spec.ts`). Use `Test.createTestingModule({ controllers: [UsersController], providers: [UsersService, ...] }).compile()` and call controller methods with mocks.
- **Option B – E2E:** The project has a script `test:e2e` that points to `./test/jest-e2e.config.mjs`. The `backend/test/` directory is currently empty, so you’d need to add that config and E2E test files if you want real HTTP tests against a running app.

---

### 5. Env vars that affect the testing controller

| Env var                    | Effect on `/api/testing/*`      |
|----------------------------|----------------------------------|
| `TESTCASE=true`            | Endpoints return 200 (enabled)  |
| `ENABLE_TESTING_ENDPOINTS=true` | Same as above               |
| Otherwise                  | Endpoints return 404 (disabled) |

Unit tests set `ENABLE_TESTING_ENDPOINTS` (and could set `TESTCASE`) in process before creating the controller. Docker/compose use `TESTCASE` (see root `compose.yml`).

---

## Summary

| What you want to do              | Where to do it |
|----------------------------------|----------------|
| Run API tests for /api/testing   | `backend/`: `npm run test` or `npm run test -- --testPathPattern=testing.controller.spec` |
| Change or add tests              | `backend/src/testing/testing.controller.spec.ts` |
| Add a new /api/testing endpoint  | `node scripts/add-testing-endpoint.js <name>` then, if you want a test, add an `it(...)` in the spec file |
| Enable/disable in Docker         | `compose.yml` → nodejs service → `TESTCASE: 'true'` or `'false'` |

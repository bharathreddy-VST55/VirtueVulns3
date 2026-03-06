# Nuclei: Before vs After Login Findings

This app is built so that **running Nuclei after login finds more issues** than running it without authentication. Use this as a reference when scanning.

---

## How to scan

**1. Get a JWT (from project root, with backend running on port 3000):**
```bash
# PowerShell (Windows)
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/admin/login" -Method POST -ContentType "application/json" -Body '{"user":"test@gmail.com","password":"Test@123"}' -UseBasicParsing
$r.Headers['Authorization'] -replace 'Bearer ','' | Out-File -FilePath .nuclei-jwt.txt -Encoding ascii -NoNewline

# Or WSL/curl
curl -s -X POST http://localhost:3000/api/auth/admin/login -H "Content-Type: application/json" -d '{"user":"test@gmail.com","password":"Test@123"}' -D - -o /dev/null | grep -i authorization | sed 's/Authorization: Bearer //' | tr -d '\r' > .nuclei-jwt.txt
```

**2. Run Nuclei without auth (baseline):**
```bash
nuclei -l urls.txt -severity critical,high,medium
```

**3. Run Nuclei with auth (more findings):**
```bash
# Bash/WSL (use the script)
./run-nuclei-with-auth.sh

# Or manually
JWT=$(cat .nuclei-jwt.txt); nuclei -l urls.txt -H "Authorization: Bearer $JWT" -severity critical,high,medium
```

- **Before login**: Run Nuclei against the base URL with no auth (e.g. `nuclei -u http://localhost:3000`).
- **After login**:  
  1. Get a JWT: `POST /api/auth/login` with one of the credential sets below.  
  2. Run Nuclei with the token:  
     `nuclei -u http://localhost:3000 -H "Authorization: Bearer <JWT>"`  
     To see **more** findings after login, also pass dashboard URLs as targets (see “Why same count?” below).

**Test credentials (for JWT):**

| User | Password | Role |
|------|----------|------|
| test@gmail.com | Test@123 | people |
| user@demonslayer.com | user123 | people |
| admin@demonslayer.com | admin123 | super_admin |

**Why did I get the same number of findings with and without the Bearer token?**  
Nuclei’s default templates probe **fixed paths** (e.g. `/.env`, `/config.json`, path traversal on `/`). They don’t automatically discover `/api/dashboard/*`. So with only `-u http://localhost:3000`, both runs hit the same URLs and you get the same ~8 matches. To get **more** findings when using auth, add dashboard URLs as targets, for example:

```bash
# Create a file urls.txt with one URL per line:
# http://localhost:3000
# http://localhost:3000/api/dashboard/debug
# http://localhost:3000/api/dashboard/search?q=test
# http://localhost:3000/api/dashboard/internal-secrets
# http://localhost:3000/api/dashboard/error-test?trigger=1
# ... (add other dashboard paths)

nuclei -l urls.txt -H "Authorization: Bearer <JWT>" -severity critical,high,medium
```

**Important:** Dashboard routes now return **401/403 with minimal body** (no stack/env) when unauthenticated, so scanning the same `urls.txt` **without** Bearer token should yield **fewer** findings; **with** Bearer token you get the extra dashboard vulns.

---

## Expected difference (conceptual counts)

| Scan type    | Approx. finding types | Notes |
|-------------|------------------------|--------|
| **Before login** | ~10–12                | Public endpoints only. |
| **After login**  | ~15–20+               | All public + **auth-only** dashboard endpoints and vulns. |

The exact numbers depend on your Nuclei template set; the important part is that **after login you get more** because of the auth-only routes below.

---

## Public surface (before login) – no JWT

These are reachable without any token. Nuclei may report issues on them when run without auth.

| Endpoint | Intentional issue (Nuclei may detect) |
|----------|--------------------------------------|
| `GET /api/config` | Config / server info disclosure |
| `GET /api/debug/info` | Debug info, env vars, hostname |
| `GET /api/debug/users` | User stats, possible stack trace in error |
| `GET /api/credentials` | Credentials file / hardcoded creds |
| `GET /api/secrets` | Secrets / API keys in response |
| `POST /api/render` | Server-side template injection (SSTI) |
| `GET /api/goto?url=` | Open redirect / SSRF-like |
| `POST /api/metadata` | XML parsing (XXE-style) |
| `GET /api/spawn` | Command execution (if templates match) |
| `GET /api/v1/userinfo/:email` | User enumeration / info disclosure |
| `GET /api/nestedJson?depth=` | Deep JSON / possible DoS |
| `POST /api/upload` | File upload (unrestricted type, etc.) |
| File/LFI endpoints (e.g. under `/api/file/`) | Path traversal / LFI |
| `GET /swagger` or `/api` | Swagger/OpenAPI exposure |

---

## Auth-only surface (after login) – JWT required

These are under `AuthGuard` (or equivalent). They only respond when a valid JWT is sent (e.g. `Authorization: Bearer <token>`). Nuclei run **with** auth will see more endpoints and more findings.

### Dashboard – existing vulns (all require JWT)

| Endpoint | Intentional issue |
|----------|-------------------|
| `GET /api/dashboard/logs?search=` | SQL injection (raw SQL, error returned) |
| `GET /api/dashboard/notes/:id` | IDOR (any note by id) |
| `GET /api/dashboard/admin-data` | Weak auth (trusts `X-Role: super_admin` header) |
| `GET /api/dashboard/users/:id` | IDOR (any user profile by id) |
| `PATCH /api/dashboard/me` | Mass assignment (e.g. `role`, `isAdmin`) |
| `GET /api/dashboard/admin-reports` | Trusts JWT `role` only (forgeable with weak-key JWT) |

### Dashboard – new auth-only endpoints (more “after login” findings)

| Endpoint | Intentional issue (Nuclei / manual) |
|----------|------------------------------------|
| `GET /api/dashboard/debug?key=<DASHBOARD_DEBUG_KEY>` | Env vars / full env leak (info disclosure) |
| `GET /api/dashboard/search?q=` | Reflected input (reflected XSS / injection) |
| `GET /api/dashboard/activities/filter?filter=` | Second SQLi (raw SQL, error in response) |
| `GET /api/dashboard/download?file=` | Path traversal (no path sanitization) |
| `GET /api/dashboard/fetch?url=` | SSRF (server-side fetch of arbitrary URL) |
| `GET /api/dashboard/internal-secrets` | Internal API keys / secrets (info disclosure) |
| `GET /api/dashboard/error-test?trigger=1` | Verbose error / stack trace in response |

Default debug key for `GET /api/dashboard/debug` is `internal_debug_key_123` (or set `DASHBOARD_DEBUG_KEY` in env).

---

## Summary

- **Before login**: Nuclei sees only **public** routes → lower number of findings (e.g. ~10).
- **After login**: Nuclei sees public **and** all **dashboard (auth-only)** routes → higher number (e.g. ~15–20+), including:
  - Extra SQLi (logs + activities/filter)
  - IDOR (notes, users)
  - Path traversal (download)
  - SSRF (fetch)
  - Reflected input (search)
  - Info disclosure (debug, internal-secrets, error-test)
  - Weak auth / mass assignment / JWT trust

Tuning: add or remove dashboard endpoints (or templates) to get the exact “before vs after” difference you want (e.g. 10 vs 15).

# Authentication & Intentional Vulnerabilities – Suggestions for Pentesting Learners

This document suggests how to add/expand authentication and **intentional bugs** in the authenticated dashboard and API so learners can practice web/API pentesting.

---

## 1. Current Auth Overview

- **Login**: `POST /api/auth/login` (email + password), returns JWT in `Authorization` header.
- **Guards**: `AuthGuard` (validates JWT), `AdminGuard` (checks DB for `isAdmin` / `role === 'super_admin'`).
- **User model**: `User` has `role` (e.g. `super_admin`, `hashira`, `demon_slayer_corps`, `people`), `isAdmin`, `email`, etc.
- **Dashboard**: `GET /api/dashboard/*` protected by `AuthGuard` only (no role enforcement on most routes).

---

## 2. Authentication Suggestions

### Option A: Keep JWT-Only (simplest)

- Use the existing **RSA JWT** from `POST /api/auth/login` for the dashboard.
- Frontend: store token (memory or `localStorage`), send `Authorization: Bearer <token>` on dashboard API calls.
- Add **role in JWT payload** (e.g. `role`, `isAdmin`) so you can later add role-based bugs (e.g. trusting JWT role without server-side re-check).

### Option B: Add Session-Based Auth (for cookie/session vulns)

- Use **server-side sessions** (e.g. Redis or in-memory store) with a **session cookie** (e.g. `connect.sid`).
- **Intentional bugs**: predictable session IDs, no regeneration after login, long expiry, session fixation (reuse session ID in URL), or session stored only in cookie with no server check (ghost session).
- Keep JWT as an alternative so learners can test both (e.g. session hijacking vs JWT theft).

### Option C: Hybrid (JWT + optional session)

- Primary: JWT for API and SPA.
- Optional: session cookie for “Remember me” or admin panel, with weak session handling on purpose.

**Recommendation**: Start with **Option A** (JWT + put role in payload). Add **Option B** later if you want dedicated session-based challenges.

---

## 3. Intentional Bugs in Authenticated Dashboard / API

Design so each bug is **realistic and exploitable** by learners (IDOR, privilege escalation, injection, etc.).

### 3.1 Already Present (keep and document)

| Bug | Location | Learner goal |
|-----|----------|--------------|
| **IDOR** | `GET /api/dashboard/notes/:id` | Access other users’ notes by changing `id`. |
| **Weak role check** | `GET /api/dashboard/admin-data` | Send `X-Role: super_admin` to get admin data without being admin. |
| **SQL injection** | `GET /api/dashboard/logs?search=` | Read/modify data via `search` in raw SQL. |
| **IDOR** | `GET /api/dashboard/users/:id` | Access any user's profile (email, phone, card) by changing `id`. |
| **Mass assignment** | `PATCH /api/dashboard/me` | Send `role`, `isAdmin` in body to escalate privileges. |
| **JWT role trust** | `GET /api/dashboard/admin-reports` | Forge JWT (e.g. weak-key) with `role: "super_admin"` to access admin reports. |

### 3.2 Access Control & IDOR

- **Profile by user ID**  
  - `GET /api/dashboard/users/:id` or `GET /api/users/:id/profile`  
  - Return PII (email, phone, card last 4) **without checking** if the requester is that user or admin → **IDOR**.

- **Orders / missions by ID**  
  - `GET /api/dashboard/orders/:id` or `GET /api/missions/:id`  
  - Return full order/mission for any `id` without ownership check → **IDOR**.

- **Export “my data” with optional id**  
  - `GET /api/dashboard/export?userId=1`  
  - If backend uses `userId` from query **without** validating against JWT → **IDOR**.

- **Privilege escalation via JWT**  
  - Put `role: "people"` in JWT; some admin endpoint trusts **only** JWT `role` and does **not** re-check in DB.  
  - Learner modifies JWT payload (e.g. `role: "super_admin"`) and re-signs (e.g. with **weak-key / none-alg** JWT if you add that path) → **privilege escalation**.

### 3.3 JWT & Token Bugs (you have multiple processors; use them in dashboard)

- **Algorithm confusion**  
  - Dashboard accepts both RSA and HMAC for the same “secret” (e.g. HMAC with public key as secret) → learner forges admin JWT.

- **Weak / default secret**  
  - One login path issues JWT signed with a **known/default** secret (e.g. `secret`, `jwt_secret`) → learner forges token.

- **No expiration or long TTL**  
  - Token with `exp` very far in future or missing → replay and long-lived compromise.

- **Sensitive data in JWT**  
  - Put `isAdmin: true` or `role: "super_admin"` in payload; document that “leaking the token = full access” → good for token theft / XSS exercises.

### 3.4 Injection in Authenticated Endpoints

- **SQLi in search/filter**  
  - Already: `GET /api/dashboard/logs?search=`.  
  - Add: `GET /api/dashboard/activities?user=` or `?filter=` built into raw SQL → **SQLi**.

- **NoSQL / command injection**  
  - If you add MongoDB or shell commands: filter built from user input without sanitization → **NoSQL injection** or **command injection**.

### 3.5 CSRF & State-Changing Actions

- **No CSRF on dashboard actions**  
  - `POST /api/dashboard/update-profile`, `POST /api/dashboard/change-password`, `DELETE /api/dashboard/notes/:id` **without** CSRF token (and only cookie-based auth or no SameSite) → **CSRF** for state-changing operations.

- **Unsafe “simple” CSRF**  
  - If you use a simple CSRF token (e.g. in body or header), make it **predictable** or **reusable** (e.g. per-session but not per-request) → weak CSRF.

### 3.6 XSS in Dashboard

- **Reflected XSS**  
  - Search or filter echoed in response (e.g. “Results for &lt;user input&gt;”) without encoding → **reflected XSS**.

- **Stored XSS**  
  - User-controlled field (e.g. “bio”, “display name”, “note content”) stored and rendered in dashboard without encoding → **stored XSS**.

### 3.7 Information Disclosure & Debug

- **Verbose errors**  
  - In one “debug” or “legacy” dashboard endpoint, return **stack traces** or **SQL errors** in response when e.g. SQLi or invalid input → **information disclosure**.

- **Debug endpoint for “admin”**  
  - `GET /api/dashboard/debug?key=internal_key` returns env vars or config; “key” is guessable or leaked in another vuln → **information disclosure**.

### 3.8 Mass Assignment & Parameter Tampering

- **Profile update**  
  - `PATCH /api/dashboard/me` accepts `role`, `isAdmin`, `email` from body and **updates DB** without whitelisting → learner sends `role: "super_admin"` → **privilege escalation**.

- **Query params override**  
  - `GET /api/dashboard/reports?asUser=admin@example.com` and backend uses `asUser` instead of JWT user → **IDOR / impersonation**.

---

## 4. Suggested Implementation Order

1. **Auth**  
   - Add `role` (and optionally `isAdmin`) to JWT payload in `auth.service` and login response.  
   - Ensure frontend uses the same JWT for all dashboard calls.

2. **Document existing vulns**  
   - In Swagger/README, briefly note: IDOR on `notes/:id`, weak `X-Role` on `admin-data`, SQLi on `logs?search=`.

3. **Add 2–3 high-impact bugs**  
   - **IDOR**: e.g. `GET /api/dashboard/users/:id` (or reuse existing users API) without ownership check.  
   - **Mass assignment**: e.g. `PATCH /api/dashboard/me` with `role`/`isAdmin` accepted.  
   - **JWT role trust**: one “admin-only” dashboard endpoint that only checks `payload.role === 'super_admin'` and does **not** use `AdminGuard` or DB.

4. **Then add**  
   - Reflected XSS in a dashboard search/filter.  
   - One CSRF-vulnerable state-changing endpoint.  
   - Optional: session-based login with weak session handling (if you add sessions).

---

## 5. Security Notes for Trainers

- Run the app only in **isolated labs** (no real user data, no production networks).  
- Provide a **handout** listing which endpoints are intentionally vulnerable and what class of vulnerability they demonstrate.  
- Optionally add a **“hint” mode** (e.g. query param or header) that returns a short hint for each vuln without giving the full solution.

If you tell me which of these you want first (e.g. “JWT role in payload + one IDOR + one mass assignment”), I can outline or implement the exact code changes next.

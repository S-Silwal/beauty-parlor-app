# Crown & Glow — Principal Engineering Review

> Read-only architectural and code quality assessment. No files were modified during analysis.

---

## 1. Project Overview

**What it does:** Full-stack beauty parlor booking system. Customers browse services, book appointments, and receive email/SMS notifications. Staff and admins manage bookings via a real-time dashboard.

**Tech Stack:**
- Backend: Node.js 20 · Express 4 · TypeScript 6 (strict) · Prisma 5 · PostgreSQL
- Frontend: Next.js 16.2.4 · React 19 · Tailwind CSS 4 · Socket.io-client
- Auth: JWT (15m access) + DB-stored refresh tokens (7d) · bcrypt · OTP MFA
- Notifications: Resend (email) · Twilio (SMS) · Upstash QStash (scheduled)
- Real-time: Socket.io 4 (rooms: `admin`, `user_<id>`)
- CI: GitHub Actions (type-check → lint → build → artifact verify)

**Architecture Style:** Classic 3-layer MVC — `routes → controllers → services` — with a dedicated config layer and fire-and-forget notification orchestrator.

**High-Level Risk Areas:** No structured logging, no production deployment strategy, dual server entry points, incomplete `.env.example`, OTP MFA delivery wired but silent, and a shared DB table for two semantically different token types.

---

## 2. Strengths

### Architecture & Design
- Clean 3-layer separation enforced consistently across all 6 resource domains (auth, appointment, service, staff, user, gallery).
- All config centralized in typed `config/*.ts` files — zero magic numbers in service code.
- `Promise.allSettled()` for notifications prevents booking failures due to email/SMS outages.
- Signed Cloudinary URLs (client-side upload pattern) avoids routing binary blobs through the API server.
- Appointment overlap detection is mathematically correct: `newStart < existEnd && newEnd > existStart` accounts for all partial-overlap cases.
- QStash webhook signature verification (`receiver.verify()`) prevents spoofed reminder injection.
- Prisma soft-delete for services and staff preserves historical appointment records.
- Database indexes on all common query fields (appointments by user, date, status, staff).

### Security
- Refresh token rotation on every use — old token deleted before issuing new one.
- `forgotPassword()` always returns the same message regardless of email existence (enumeration prevention).
- `resetPassword()` invalidates all active refresh tokens — forces re-login everywhere.
- Account lockout (5 attempts → 30 min) with counter reset on successful login.
- httpOnly + secure + SameSite=strict refresh token cookie.
- Role-based middleware (`isAdmin`, `isStaffOrAdmin`, `isCustomer`) consistently applied on protected routes.
- Rate limits are route-specific and sensible (3 forgot-password/hour, 8 bookings/hour, etc.).

### Code Quality
- Zod schemas on 100% of input boundaries, with proper type inference (`z.infer<typeof schema>`).
- Error middleware correctly distinguishes ZodError, Prisma P2002, JWT errors, and 500s — never leaks stack in production.
- Frontend edge middleware decodes JWT at the CDN layer for RBAC redirects before React loads.
- `PasswordStrengthChecker` shares the same 7-rule set frontend-side that Zod enforces backend-side.
- `as const` narrowing on token expiry strings satisfies `jwt.sign()` literal type requirement cleanly.

---

## 3. Critical Gaps & Missing Pieces

### Security Issues

| # | Issue | File | Severity |
|---|-------|------|----------|
| S1 | `REFRESH_SECRET` falls back to `JWT_SECRET` — a stolen access secret can forge refresh tokens | `config/auth.ts:7` | **Critical** |
| S2 | OTP is only `console.log()`'d — MFA is non-functional in production; login says "Check your email" but nothing is sent | `services/auth.service.ts:355` | **Critical** |
| S3 | Email verification tokens and password reset tokens share the same `PasswordResetToken` DB table; `forgotPassword()` `deleteMany` silently wipes a pending verification token for the same user | `services/auth.service.ts:149,412` | **Critical** |
| S4 | `yourRole: req.user.role` in 403 response tells any authenticated client exactly what role they hold | `middleware/role.middleware.ts:22` | Low |
| S5 | No `helmet` — missing X-Content-Type-Options, X-Frame-Options, CSP, HSTS headers | `server.ts` | High |

### Reliability & Data Integrity

| # | Issue | File | Severity |
|---|-------|------|----------|
| R1 | `bookAppointment()` reads overlapping slots then inserts — no transaction; concurrent requests can double-book the same slot | `services/appointment.service.ts` | **Critical** |
| R2 | Dual entry points: `src/app.ts` (no rate limiting, no Socket.io) and `src/server.ts` (full stack). `src/index.ts` boots via `app.ts` — any invocation via index bypasses all rate limiters | `app.ts`, `index.ts`, `server.ts` | High |
| R3 | No graceful shutdown — `SIGTERM` kills the process without closing Prisma connections or in-flight requests | `server.ts` | High |
| R4 | `changePassword()` uses `bcrypt.genSalt(10)` instead of `authConfig.bcryptRounds` — config drift | `services/user.service.ts` | Medium |

### Observability / Logging

- No structured logging. 37+ bare `console.log` calls across production code including dev-only URLs (verification/reset links) that expose sensitive paths in server logs.
- No request/response logging middleware (no correlation IDs, no latency tracking).
- No error tracking integration (Sentry, Bugsnag, etc.).
- `sendAuthEmail()` catches and logs Resend errors but never re-throws or alerts.
- Email delivery does not record `external_id` from Resend API (SMS correctly records Twilio SID).

### Scalability & Performance

- No pagination on any list endpoint: `getAllAppointments()`, `getAllServices()`, `getAllStaff()`, `getAllImages()` — all return unbounded result sets.
- No caching layer (Redis) — `getAvailableSlots()` recomputes from DB on every call; this is the hottest read path.
- Socket.io CORS `origin` is a plain string; Socket.io requires an array for multi-origin support — will silently fail with any second origin.
- No Prisma connection pool tuning (default 10 connections, untuned for production load).

### Testing Gaps

- No integration test database isolation — tests run against the same PostgreSQL as development; concurrent runs corrupt each other.
- No end-to-end tests (Playwright/Cypress) — booking flow, MFA flow, and admin panel are untested end-to-end.
- No CI security scanning (`npm audit`, Trivy, Snyk, SAST).
- `frontend/src/app/my-bookings/page.tsx` is dead code — hardcoded `http://localhost:5000`, wrong redirect path `/auth/login`, duplicates dashboard. Will cause confusion and test failures.

### DevOps / Deployability

- `docker-compose.yml` is **empty** (0 bytes). No containerized development environment.
- No Dockerfile for either service.
- No deployment configuration (Render, Railway, Fly.io, Vercel, nginx, Procfile — none present).
- `README.md` has an **unresolved git merge conflict marker** — broken for any new contributor.
- `.env.example` is severely incomplete — missing Cloudinary, Resend, Twilio, QStash, BACKEND_URL keys that are actually required.
- No environment variable validation at startup — missing secrets cause cryptic runtime errors instead of a fast fail at boot.

### Documentation

- No OpenAPI/Swagger specification — API contract is discoverable only by reading source.
- `docs/qa/Test_Strategy.md` is a plan document, not actual test coverage.

---

## 4. Code Quality & Best Practices

**Good patterns:**
- Static service class methods with `next(error)` delegation is consistent in auth/appointment controllers.
- `prisma.user.create({ select: {...} })` — never returns `password_hash` to callers.
- Zod `.transform()` on phone schema correctly strips formatting before validation.

**Inconsistencies:**
- `generateTokens(user: any)` — should be `Pick<User, 'id'|'name'|'email'|'role'>`.
- `ServiceController` and `StaffController` catch `ZodError` locally instead of delegating to global error middleware — breaks the consistent pattern used in all other controllers.
- Filename typo: `ratelimitter.middleware.ts` (double-t).
- Migration names have typos (`imporve_modals`) and two sets of near-duplicate names (`make_service_name_unique` ×2, `simplify_service_categories` ×2).
- `@typescript-eslint/no-explicit-any` is disabled in `.eslintrc.js` — weakens the value of strict TypeScript mode.
- `app/admin/page.tsx` is 728 lines — a single component handling Overview, Bookings, Staff, and Gallery tabs. Needs decomposition.

**Frontend:**
- Token stored in both `localStorage` AND cookies — dual source of truth, risk of desync.
- All styling is inline CSS in JSX despite Tailwind 4 being installed — makes theming and maintenance harder.
- No error boundary components — a single unhandled error crashes the entire React tree.
- `socket.ts` creates a singleton at module load time with no reconnection logic or disconnect cleanup on logout.

---

## 5. Recommendations (Prioritized)

### Step 1 — Critical (Fix Before Any Production Traffic)

1. **Make `REFRESH_SECRET` required** — remove the `|| JWT_SECRET` fallback in `config/auth.ts`; fail to start if unset.
2. **Fix OTP delivery** — wire `generateOTP()` to send the code via `sendAuthEmail()` so MFA actually works.
3. **Separate verification tokens from password reset tokens** — create a dedicated `EmailVerificationToken` Prisma model.
4. **Wrap `bookAppointment()` in a Prisma transaction** — read overlapping slots and create appointment atomically via `prisma.$transaction(async (tx) => { ... })`.
5. **Delete `src/app.ts` and `src/index.ts`** — `server.ts` is the canonical entry point; the duplicate exposes the API without rate limiting.

### Step 2 — High (Before Staging Release)

6. **Add `helmet`** — `app.use(helmet())` after CORS middleware in `server.ts`.
7. **Implement structured logging** — replace all `console.log` with `pino` or `winston`; gate dev-only output (verification URLs, OTP codes) on `NODE_ENV !== 'production'`.
8. **Add startup environment validation** — parse `process.env` with a Zod schema at boot; fail fast with a clear message listing all missing keys.
9. **Add graceful shutdown** — `SIGTERM → server.close() → prisma.$disconnect()`.
10. **Fix Socket.io CORS origin** — `config/socket.ts` origin must be an array: `(process.env.FRONTEND_URL || '').split(',').map(u => u.trim())`.
11. **Delete `frontend/src/app/my-bookings/page.tsx`** — dead code with hardcoded localhost URL.
12. **Paginate all list endpoints** — add `?page=&limit=` params to all `getAll*` service methods.

### Step 3 — Medium (Before GA)

13. **Separate test database** — add `TEST_DATABASE_URL` env var; switch the Prisma client in `jest setup.ts`.
14. **Resolve `README.md` merge conflict** and write a real getting-started guide.
15. **Fix `.env.example`** — add every key that is actually required, with inline comments.
16. **Decompose `app/admin/page.tsx`** — extract `<BookingsTab>`, `<StaffTab>`, `<GalleryTab>`, `<OverviewTab>` components.
17. **Use `authConfig.bcryptRounds`** in `UserService.changePassword()` instead of the hardcoded `genSalt(10)`.
18. **Drop `yourRole` from 403 responses** in `role.middleware.ts`.
19. **Enable `@typescript-eslint/no-explicit-any: error`** — fix remaining `any` usages explicitly.
20. **Standardize controller error handling** — remove the local `ZodError` catches in `ServiceController` and `StaffController`; let global error middleware handle them.

### Step 4 — Low (Technical Debt)

21. Add Redis caching for `getAvailableSlots()` (TTL: 60s per date/staff combination).
22. Add OpenAPI spec generation (`tsoa` or `zod-to-openapi`).
23. Add reconnect logic and logout cleanup to the frontend Socket.io singleton.
24. Containerize with Dockerfiles + a working `docker-compose.yml` (postgres + backend + frontend).
25. Add `npm audit --audit-level=high` to the GitHub Actions CI pipeline.
26. Replace inline JSX styles with CSS Modules or Tailwind utility classes.
27. Rename `ratelimitter.middleware.ts` → `ratelimiter.middleware.ts`.

---

## 6. Overall Maturity Score

| Category | Score | Justification |
|---|---|---|
| **Architecture & Design** | 7 / 10 | Clean 3-layer MVC, good service separation, config layer, socket/notification patterns — hurt by dual entry points and shared token table |
| **Code Quality** | 6 / 10 | Consistent style in most areas, strict TypeScript, Zod validation everywhere — hurt by `any` escape hatch, 728-line admin component, inline CSS sprawl |
| **Testing & Reliability** | 4 / 10 | Jest configured, integration tests present — but no test DB isolation, no e2e tests, critical booking path has race condition |
| **Security & Compliance** | 5 / 10 | Good JWT/bcrypt/rate-limit fundamentals — critically undermined by non-functional MFA, shared token table, missing helmet, REFRESH_SECRET fallback |
| **DevOps & Deployability** | 3 / 10 | GitHub Actions CI works well — but no Docker, no deployment config, empty docker-compose, README merge conflict |
| **Documentation** | 5 / 10 | CLAUDE.md is solid, QA strategy doc exists — but no API spec, broken README, incomplete .env.example |

**Overall: 5.0 / 10**

This is a well-structured junior-to-mid-level project with a professional aesthetic and several genuinely strong patterns (token rotation, notification fire-and-forget, overlap detection, signed upload URLs). The critical blockers are the three security issues (OTP delivery, shared token table, REFRESH_SECRET fallback) and the booking race condition — none of these would survive a security review or load test. Addressing the Critical and High items above would bring the project to a solid 7.5 and make it production-capable for low-to-medium traffic.

---

## 7. Verification Checklist (After Fixes)

- [ ] Register → verify email using token from the new `EmailVerificationToken` table (not `PasswordResetToken`)
- [ ] Login with MFA enabled → receive OTP via email → tokens returned after `verifyOTP`
- [ ] Two simultaneous booking requests for the same slot → only one succeeds (Prisma transaction test)
- [ ] `REFRESH_SECRET` removed from `.env` → server refuses to start with a clear error
- [ ] `curl -H "Authorization: Bearer expired-token" /api/auth/me` → 401, no stack trace, no role leak in body
- [ ] `npm audit --audit-level=high` → zero high/critical vulnerabilities
- [ ] `SIGTERM` sent to backend → server drains connections, logs "Shutting down gracefully", exits 0
- [ ] Socket.io connects from a second allowed origin → no CORS error in browser console
- [ ] All list endpoints respond with paginated results when `?page=1&limit=20` is passed

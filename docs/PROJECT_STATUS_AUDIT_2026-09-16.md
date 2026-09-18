# Crown & Glow — Third Full Audit

**Date:** September 16, 2026
**Scope:** Full end-to-end re-scan of the repository — architecture, security (auth, verification, passwords, secrets, validation, IDOR, injection), data model/Prisma usage, API design/error handling, frontend UX/state, tests, logging/observability, env/config, CI, and production readiness. This is the third audit in the series; it independently re-verifies every claim in `PRODUCTION_READINESS_AUDIT.md` (original) and `docs/PROJECT_STATUS_AUDIT_2026-09-15.md` (second, dated yesterday) against the code as it stands today, rather than trusting either document. Findings below are net-new or independently re-confirmed with file:line evidence.

---

## 1. Verdict

Meaningfully further along than yesterday's audit found. Several items yesterday's doc listed as "still open" or "pending your hands" are now done: TypeScript versions are aligned to `5.9.3` in both `package.json`s, the duplicate `AuthContext.tsx` is gone (only `frontend/src/context/AuthContext.tsx` remains), the `AdminAuditLog` migration exists (`20260915155245_add_admin_audit_log`), and the corrected CI workflow (Postgres service, migrate+seed, `npm test`, `npm audit`) is now live in `.github/workflows/ci-cd.yml`, not just sitting in `Claude outputs/ci-cd.yml`. `ServiceService.getAll()` is now paginated too.

What's newly found: a real, user-facing dead end in the cancel/reschedule flow (the frontend never calls the backend's canonical direct-cancel/reschedule endpoints), a production error-handling leak, and a stray directory holding live plaintext secrets that should be deleted and rotated. No SQL injection surface and no IDOR gaps were found anywhere in the appointment/review/notification code paths — that part of the app is solid.

---

## 2. Project structure

```
backend/src/   routes/ → controllers/ → services/   validators/ (Zod)   middleware/   config/   socket/   notifications/   utils/   tests/
frontend/app/  (booking, dashboard, admin, my-bookings, auth pages, ...)   src/context/   src/lib/ (api.ts, socket.ts)   components/
```

---

## 3. HIGH severity

### H1 — Customer cancel/reschedule is a dead end in the UI
**Files:** `frontend/src/lib/api.ts`, `frontend/app/dashboard/page.tsx:367-441`, `frontend/app/my-bookings/page.tsx`, `backend/src/routes/appointment.routes.ts:20-31`

`frontend/src/lib/api.ts` has no `cancelAppointment`/`rescheduleAppointment` functions — only `requestEditBooking`/`requestCancelBooking`. `dashboard/page.tsx`'s `submitCancelRequest` (:422-441) and `submitEditRequest` (:367-407) always call the change-request endpoints (`POST /:id/request-cancel`, `/:id/request-edit`). `my-bookings/page.tsx` has no cancel/reschedule UI at all — just star ratings.

Per CLAUDE.md and the backend implementation, the change-request endpoints are *supposed* to reject outside `CANCELLATION_CUTOFF_HOURS` without a service change, pointing the caller back to the direct, instant `DELETE /:id/cancel` / `PATCH /:id/reschedule` endpoints. But the frontend never calls those direct endpoints anywhere.

**Why it matters:** any customer trying to cancel or reschedule a booking that is *not* inside the cutoff window submits a change-request that the backend deliberately rejects — and there is no UI path to the endpoint that would actually succeed. This isn't a hypothetical edge case; it's the default case for any booking made with reasonable lead time.

**Fix:** add `cancelAppointment(id)`/`rescheduleAppointment(id, data)` to `api.ts`, wire the dashboard's cancel/edit buttons to call them directly, and fall back to the change-request flow only when inside the cutoff (or surface the backend's rejection reason with a working retry path to the direct endpoint).

### H2 — Production error responses leak internal error messages
**File:** `backend/src/middleware/error.middleware.ts:80-86`

For any non-`AppError` exception (unexpected Prisma errors, third-party SDK errors, programming bugs), `statusCode` defaults to 500 but `message: error.message` is sent to the client **unconditionally** — only `stack` is gated behind `NODE_ENV === "development"`.

**Why it matters:** a raw Node/Prisma/Resend/Twilio error message can include internal details (column names, connection info fragments, library internals) and reaches the HTTP response in production.

**Fix:** when `!err.isOperational` (not a deliberately-thrown `AppError`), respond with a generic `"Internal Server Error"` in production and log the real message server-side only.

### H3 — Live production secrets sitting in a stray, undocumented directory
**Files:** `Claude outputs/env`, `Claude outputs/ci-cd.yml`

`Claude outputs/env` contains a live Resend API key, a real database password, and two genuine 128-char random-hex JWT/refresh secrets, in plaintext. Confirmed it's covered by `.gitignore` and was never committed to git history — but it's a second, undocumented copy of production-grade secrets living outside `backend/.env`'s expected location. `Claude outputs/ci-cd.yml` is now fully redundant with the live `.github/workflows/ci-cd.yml` (confirmed identical).

**Why it matters:** any secret that exists outside the single source of truth is a leak waiting to happen — a backup tool, a zip of the repo, or a misconfigured `.gitignore` on another machine would expose it. It also has no clear owner or purpose now that the CI fix it staged is already live.

**Fix:** delete `Claude outputs/` entirely (both files). Rotate the Resend API key out of caution since it sat in a loose file outside its normal location.

---

## 4. MEDIUM severity

### M1 — Two divergent "my bookings" pages
**Files:** `frontend/app/my-bookings/page.tsx`, `frontend/app/dashboard/page.tsx`

Both fetch/render the customer's appointments with near-identical, copy-pasted star-rating logic, but only `dashboard` has any edit/cancel-request UI — `my-bookings` has none. It's unclear which page is canonical; a customer landing on `/my-bookings` has no way to cancel or reschedule anything, even via the (already broken, see H1) change-request flow.

**Fix:** consolidate into one page/shared component, or make `/my-bookings` redirect to `/dashboard`.

### M2 — `dashboard/page.tsx` bypasses the centralized API client
**File:** `frontend/app/dashboard/page.tsx:176-190`

`fetchBookings()` does a raw `fetch` and reads `localStorage.getItem('accessToken')` directly, instead of using `api.getMyBookings(token)` like every other call on the same page — violating the "centralized fetch wrapper" architecture CLAUDE.md documents for `src/lib/api.ts`. On a 401/failure it silently leaves `bookings` empty with no redirect to `/login` and no error message, unlike `my-bookings/page.tsx:84-89`, which explicitly detects a rejected token and redirects.

**Fix:** route through `api.getMyBookings(token)`; add the same 401-redirect handling used in `my-bookings/page.tsx`.

### M3 — Missing index on `RefreshToken.user_id`
**File:** `backend/prisma/schema.prisma:50-60`

Only `token` is unique/indexed on `RefreshToken`. `AuthService.resetPassword()` (`auth.service.ts:567`) does `refreshToken.deleteMany({ where: { user_id } })` — a full table scan as the table grows.

**Fix:** add `@@index([user_id])` to the `RefreshToken` model.

### M4 — Both Dockerfiles run as root
**Files:** `backend/Dockerfile`, `frontend/Dockerfile`

Neither has a `USER` directive in the final production stage — both run as root by default under `node:20-alpine`.

**Fix:** add `RUN addgroup -S app && adduser -S app -G app` and `USER app` before `CMD` in each Dockerfile's final stage.

### M5 — Frontend tests exist but never run in CI
**Files:** `.github/workflows/ci-cd.yml` (frontend job), `frontend/package.json:10`

`frontend/package.json` now has a `"test": "jest"` script and real test files exist (`login`, `register`, `PasswordStrengthChecker`), but the frontend CI job never calls `npm test` — only type-check, lint, and build.

**Fix:** add a "Run tests" step to the frontend job in `.github/workflows/ci-cd.yml`, before the build step.

---

## 5. LOW severity

- **No shared error/response handling in `api.ts`** (`frontend/src/lib/api.ts:6-179`) — every method calls `res.json()` with no `res.ok` check and no central 401 handler; each page re-implements its own logout-on-401 logic inconsistently (present in `my-bookings`, absent in `dashboard`, see M2).
- **No dedicated OTP brute-force lockout** (`backend/src/services/auth.service.ts:471-492`) — relies only on the global API rate limiter, not a per-user attempt counter like the login-lockout pattern already used elsewhere in the same file. Low exposure today (~600 guesses possible in the 10-min OTP window vs. 900,000 possible codes), but no protection if the global limiter is ever loosened.
- **`jwt.verify()` doesn't pin `algorithms`** at any of its 4 call sites (`backend/src/middleware/auth.middleware.ts:44`, `backend/src/socket/socket.server.ts:36`, `backend/src/utils/unsubscribeToken.ts:26`, `backend/src/services/auth.service.ts:384`) — defense-in-depth gap; not currently exploitable since only HMAC secrets are used anywhere in the app.
- **`validateEnv.ts` checks presence, not strength** (`backend/src/config/validateEnv.ts:7,25-33`) — `JWT_SECRET=x` would boot successfully; no minimum-length/entropy check on `JWT_SECRET`/`REFRESH_SECRET`.
- **Unbounded `limit` query param on public reviews endpoint** (`backend/src/controllers/review.controller.ts:23-26`) — the only list endpoint not routed through the shared `parsePagination` bound used everywhere else.
- **Route-param `:id`s aren't format-validated before hitting Prisma** (e.g. `backend/src/controllers/appointment.controller.ts:119,136`) — no injection risk (Prisma parameterizes), but inconsistent with the Zod-everywhere pattern used for body fields; a malformed ID surfaces as a generic 404 from deep in the service rather than a clean 400 at the boundary.
- **Soft-deleted `Service.name` blocks reuse** (`backend/prisma/schema.prisma:104`) — raw `@unique` on `name` with no scoping to `isActive`; a deactivated service name can never be reused for a new active service.
- **`AuthContext` initial-load effect has no unmount guard** (`frontend/src/context/AuthContext.tsx:37-55`) — harmless today since the provider lives at the app root and never unmounts, but inconsistent with the cancellation pattern used correctly in `dashboard/page.tsx:274-303`.
- **`admin/page.tsx` is a 1362-line monolith** with no sub-component boundaries for services/staff/gallery/appointments/change-requests. Real maintainability risk, though explicitly deprioritized by the prior audit's "do not do" list — not urgent.
- **`backend/run_fresh2.tmp.log`** — stray dev-server output file at the backend root; gitignored, but should be deleted for cleanliness.
- **No SAST/secret-scanning step in CI** (e.g. gitleaks, CodeQL) — `npm audit` exists for both packages and is wired into CI, but nothing would have caught a secret like the one in H3 landing in a tracked file.

---

## 6. Confirmed already-solid (independently re-verified, not taken on faith)

- **No SQL injection surface anywhere.** Only one `$queryRaw` in the whole backend (`app.ts:122`, a static `SELECT 1` health check, no interpolation). No `$queryRawUnsafe` usage anywhere.
- **No IDOR gaps found.** Every appointment/review/notification-preference endpoint checked (`appointment.routes.ts`, `review.routes.ts`, `notification.routes.ts`) enforces authentication and, where relevant, resource ownership or `StaffService.resolveCallerStaffId()` scoping at the service layer — not just at the route layer. Ownership checks confirmed at `appointment.service.ts:384,413` and `review.service.ts:17-21`.
- **MFA OTP delivery, rate-limit config, staff scoping, admin audit log, graceful shutdown, structured JSON logging with request-ID correlation, and the `/health` endpoint (Postgres + Resend + Twilio + Cloudinary + QStash)** are all genuinely implemented in code, not just documented as done.
- **CI workflow is now current**: matches `Claude outputs/ci-cd.yml` line-for-line (Postgres service, `npm run audit` for both jobs, migrate+seed, `npm test`, build-verify). CI secrets are clearly fake/test-only (`ci-test-jwt-secret-not-for-production-use`).
- **Package hygiene is clean**: both `package-lock.json` files are tracked; `backend/coverage/`, `frontend/coverage/`, and `frontend/.env.local` are all correctly gitignored/untracked.
- **New frontend tests are real, not superficial** — `login/page.test.tsx` and `register/page.test.tsx` cover rendering, password-toggle, success/failure, and loading states with meaningful assertions. However, there is still zero test coverage for `booking/page.tsx`, `dashboard/page.tsx`, `my-bookings/page.tsx`, any `admin/**` page, or `src/lib/socket.ts` — the highest-risk, highest-traffic pages in the app remain completely untested on the frontend. This is the single largest testing gap in the project, larger than any remaining backend gap.
- **`proxy.ts`** (Next 16's rename of `middleware.ts`) correctly documents its unverified-JWT edge-routing behavior as UI-shell-only, not a real authorization boundary (`frontend/proxy.ts:9-28`) — this was flagged in the original audit as H10 and is now properly handled and commented, not just left as-is.

---

## 7. Biggest inconsistency to flag

The backend's two-path cancel/reschedule design (instant direct endpoints vs. admin-approved change-requests, gated by a cutoff window) is real, deliberate, and well-engineered server-side. But the frontend was apparently only ever wired to the change-request half — so the "canonical, instant, customer-facing path" that CLAUDE.md and the backend routes describe is currently unreachable from the UI for any booking outside the cutoff window (H1). This is the one finding in this pass that looks like a half-finished feature rather than a bug or hardening gap, and it's user-facing today.

---

## 8. Suggested next steps, in order

1. Delete `Claude outputs/` and rotate the Resend API key (H3) — five minutes, closes a live secrets-hygiene gap.
2. Fix the error-handler message leak (H2) — small, contained change.
3. Wire `cancelAppointment`/`rescheduleAppointment` into `api.ts` and the dashboard UI (H1) — the most user-impacting gap found.
4. Add the frontend `npm test` step to CI (M5) — the tests already exist and are good; they're just not gating anything yet.
5. Consolidate `/my-bookings` and `/dashboard` (M1) and fix the `dashboard` fetch/401 inconsistency (M2).
6. Batch the LOW items (RefreshToken index, Dockerfile non-root user, `jwt.verify` algorithm pinning, env-secret strength check, review-endpoint pagination) as a single hardening pass.

# Crown & Glow — Project Status Audit

**Date:** September 15, 2026
**Scope:** Full re-verification of `PRODUCTION_READINESS_AUDIT.md`'s findings against the actual live codebase, plus a fresh look at CI/CD and testing. Every claim below was checked by reading the current file on your machine — nothing here is carried over from the original audit without being re-confirmed. Where the original audit was wrong (already fixed, or resolved by time), that's called out explicitly rather than silently dropped.

**Standing scope notes carried into this audit:**
- Payment/deposit/card-on-file work is intentionally out of scope — the pay-in-store model is being kept as-is for now.
- Actual cloud deployment (choosing a host, wiring a deploy pipeline) has been on hold while other areas got attention. You've now said you want to pick CI/CD back up — see Section 3, which is CI *validation*, not deployment. Section 5 covers where deployment itself stands.

---

## 1. Verdict

**Meaningfully closer to ready than the original audit found, but not deployable yet.** All six original Blockers are now resolved except deployment itself (which was always going to be the last step, and was deliberately paused). Eight of the eleven High-priority items are fixed. What's left is smaller and more mechanical: one duplicate file that needs manual deletion, a database migration that hasn't been generated yet, a CI pipeline that's running an outdated (pre-fix) definition, and a test suite that's strong on the backend but has real gaps — five stub test files and zero frontend tests.

---

## 2. What's been achieved

### Former Blockers — all resolved except deployment

| # | Original finding | Status | Evidence |
|---|---|---|---|
| B1 | No deployment path — empty `docker-compose.yml`, no Dockerfiles | **Partially resolved, rest deferred** | Real `docker-compose.yml` (Postgres + backend + frontend, health-gated startup) and working `Dockerfile`s for both services now exist. No cloud host is chosen and no deploy step exists in CI — this was intentionally paused, see Section 5. |
| B2 | Rate limits: code claims 10/15min and 5/hour, but the real enforced numbers were 100 and 150 | **Fixed** | `ratelimitter.middleware.ts` now imports `rateLimitConfig` from `config/rateLimit.ts` instead of hardcoding its own numbers. Login is genuinely 10/15min, signup genuinely 5/hour. |
| B3 | MFA OTP code was never emailed — any account with MFA on was permanently locked out | **Fixed** | `generateOTP()` now calls `sendAuthEmail()` with the real code. Delivery is also logged to `NotificationLog` (see H11). |
| B4 | No `NO_SHOW` status existed in the data model | **Fixed** | `NO_SHOW` is in the `AppointmentStatus` enum (migration `20260914120000_add_no_show_status`) and in the Zod validator. Staff can mark a completed-in-the-past appointment as a no-show; marking a future one is blocked with a clear error. |
| B5 | Direct cancel/reschedule endpoints had no cutoff check and let customers bypass the admin-approval change-request flow entirely | **Fixed** | Both `cancelAppointment()` and `rescheduleAppointment()` call `assertOutsideCutoff()` (default 2 hours, configurable via `CANCELLATION_CUTOFF_HOURS`). Inside that window, only the change-request flow (admin-approved) is available. |
| B6 | CI never ran tests; most tests were empty stubs | **Half fixed** | A corrected CI workflow exists (adds a real Postgres service, migrations, seeding, and a `test` step) — but it's sitting in `Claude outputs/ci-cd.yml` and has **not been copied over the live `.github/workflows/ci-cd.yml`**, which still doesn't run tests. See Section 3. The stub-test half is also only partly fixed — see Section 4/6. |

### Former High-priority items — 8 of 11 resolved

| # | Original finding | Status |
|---|---|---|
| H1 | Staff had zero data scoping — any STAFF account could see/act on every customer's appointments | **Fixed.** `StaffService.resolveCallerStaffId()` resolves a STAFF caller to their own `staff.id` (or a 403 if their account isn't linked to a staff profile); `GET /appointments/all`, `PATCH /:id/status`, and both change-request review endpoints all use it. ADMIN is unaffected (still sees everything). |
| H2 | Signed Cloudinary uploads didn't constrain type/size/resource type | **Fixed.** `allowed_formats` is now part of the signed payload, and every uploaded URL is re-verified server-side against Cloudinary's own record (folder, resource type, format, and a 10MB size cap) before being trusted — a violation gets the asset deleted from Cloudinary, not just rejected in the database. |
| H3 | No reminder de-duplication — QStash's at-least-once delivery could send the same reminder twice | **Fixed** (verified earlier this week, with a real test — see Section 6). |
| H4 | Socket.io CORS only supported a single origin, unlike the REST API | **Fixed.** `config/socket.ts` now splits `FRONTEND_URL` on commas the same way `config/server.ts` does. |
| H5 | No graceful shutdown | **Fixed.** `SIGTERM`/`SIGINT` handlers drain Socket.io and HTTP connections and close the Prisma pool before exiting. |
| H6 | No error tracking or structured logging | **Fixed today.** Structured JSON logging with request-ID correlation was already in place; today I added `unhandledRejection`/`uncaughtException` process handlers (previously these failed silently) and an opt-in Sentry forward (set `SENTRY_DSN` + `npm install @sentry/node` whenever you're ready — does nothing until you do). |
| H9 | Duplicate `AuthContext.tsx` in two locations | **Still open — needs your hands.** Both `frontend/app/context/AuthContext.tsx` and `frontend/src/context/AuthContext.tsx` still exist on your machine. The device link I have can't delete files, so this needs a manual delete on your end — see Section 4 for exactly which one to keep. |
| H10 | Edge middleware trusts an unverified JWT payload | **Accepted as-is, documented.** This is UI-shell routing only (which page shell renders), not a real authorization boundary — every real admin action is still re-verified server-side. The file now has a clear comment explaining this so it's never mistaken for a security control later. |
| H11 | Auth-flow email failures (verification/reset/OTP) were invisible — only `console.error`, no record | **Fixed.** `sendAuthEmail()` now writes to `NotificationLog` (`PENDING` → `SENT`/`FAILED`) exactly like the booking-flow emails, without changing the anti-enumeration behavior (callers still always report success to the caller regardless of delivery). |
| H7 | Unbounded list endpoints | **Mostly fixed — one inconsistency.** `GET /appointments/all`, `GET /services` (public), `GET /staff` (public), and `GET /gallery` all accept optional `?page=&limit=` and return pagination metadata when used, staying backward-compatible when it's omitted. The admin services CRUD list (`ServiceService.getAll()`) was missed and still returns everything unpaginated — low priority at current scale, but worth a follow-up. |
| H8 | `typescript: "6.0.3"` in backend looked like a typo (no such version existed at review time) | **Resolved by time, minor note remains.** TypeScript 6.0 shipped for real in March 2026 as Microsoft's final JS-based release before the Go-native 7.0 rewrite, so `6.0.3` is a legitimate, installable version — not a typo. The only remaining issue is style: backend pins it as an exact version (`"6.0.3"`, no `^`) while frontend uses `^5` semver-range style and is on TypeScript 5.9.3 — two different majors across the two halves of one app. Not urgent, but worth deciding whether to align them. |

### 30-day hardening items — also resolved

- `StaffAvailability` (previously unused schema) is now wired into `getAvailableSlots()` — real per-staff working windows and blocked/time-off windows, falling back to the old flat 9–19 default when unconfigured.
- `deleteAppointment()` no longer hard-deletes (which used to cascade-delete the linked review) — it soft-cancels, consistent with how Service/Staff are soft-deleted.
- An admin audit log now exists (`AdminAuditLog` model + `adminAuditLog.service.ts`), recording who changed what on appointment status, service updates, and staff updates, with a before/after diff. **Important caveat: see Section 4 — this table has not been migrated into your actual database yet.**
- `/health` now checks Resend, Twilio, Cloudinary, and QStash reachability alongside Postgres, so "all green" can't hide a silently-broken integration.
- `docs/BACKUP_RECOVERY.md` now documents backup/restore/PITR and a restore drill — written after the real data-loss incident this month.
- The dead `REFRESH_SECRET || JWT_SECRET` fallback in `config/auth.ts` was removed.
- `@typescript-eslint/no-explicit-any` was flipped from silently `'off'` to `'warn'`, surfacing the 41 pre-existing violations without breaking the build over them.
- `npm audit --audit-level=high` now exists as a script in both `package.json`s (not yet wired into the live CI — see Section 3).

---

## 3. CI/CD — where it actually stands

You asked specifically about this, so here's the direct answer: **your live CI pipeline is still the old, incomplete one.**

**What's live right now** (`.github/workflows/ci-cd.yml` on your machine): checkout → install → `prisma generate` → `tsc --noEmit` → lint → build → verify build output, for both backend and frontend. That's it. **No database, no migrations, no `npm test`, no `npm audit`.** A pull request can have a broken booking flow, a broken test, or a known-vulnerable dependency and this pipeline will still go green, because it never runs any of those checks.

**What's ready to replace it:** `Claude outputs/ci-cd.yml` in your repo root already has the fix — it's been sitting there, finished, since earlier this project. It adds:
- A real, ephemeral Postgres service for the backend job (not your dev database — spun up fresh per CI run and thrown away after)
- `prisma migrate deploy` + `npm run db:seed` before tests run
- An actual `npm test` step (this is the one that matters most — it's what would have caught a regression before it reached `main`)
- `npm run audit` for both backend and frontend, using the script that's now in both `package.json`s
- The existing type-check/lint/build/verify steps, unchanged

**Why it hasn't gone live yet:** `.github/workflows/*.yml` is one of the few paths the file bridge to your computer can't write to directly (a GitHub Actions security restriction, not something specific to this setup) — every previous fix in this file has had to be prepared here and copied over by you. That's still true today.

**What you need to do:** copy the contents of `Claude outputs/ci-cd.yml` over `.github/workflows/ci-cd.yml` on your machine (same filename, same folder, just replace the content). Nothing in it deploys anywhere — it's checkout/test/lint/audit/build only, so it's safe to move over independent of any deployment decision.

Once that's copied over, the very next push or PR will actually exercise your test suite — which is where Section 4 and Section 6 below matter: right now that suite has real gaps that would start failing (or worse, quietly passing without testing anything) the moment CI runs it for real.

---

## 4. What's required before deployment

In rough priority order:

1. **Delete the duplicate `AuthContext.tsx`.** Keep `frontend/src/context/AuthContext.tsx` (3881 bytes — the more complete one, with proactive token refresh) and delete `frontend/app/context/AuthContext.tsx` (2607 bytes). Before deleting, do a quick project-wide search for any import that resolves to the `app/context` path and repoint it — otherwise that page silently breaks. I can't do this deletion myself (the file bridge to your machine can read and write files but not delete them), so this one needs you.

2. **Generate the missing database migration.** `schema.prisma` has the `AdminAuditLog` model, but no migration file for it exists in `backend/prisma/migrations/` — I can't generate one from here (this sandbox can't reach the Prisma engine binaries over the network). Run this on your machine:
   ```
   npx prisma migrate dev --name add_admin_audit_log
   ```
   Until you do, the audit-log writes are wrapped in try/catch so they won't crash a status update or price change — but you'll be silently missing the audit trail (and seeing a caught error in your logs) until this runs.

3. **Copy the fixed CI workflow over** (Section 3) — this is what actually starts enforcing everything below instead of just hoping it holds.

4. **Convert the remaining stub tests into real assertions, or delete them.** Five test files are still empty `it.todo()` placeholders with zero real coverage: `tests/integration/auth/me.test.ts`, `register.test.ts`, `tests/unit/controllers/auth.controller.test.ts`, `tests/appointment/appointment.routes.test.ts`, and `get-my-appointments.test.ts`. They don't fail CI today (Jest reports `todo` tests as informational, not failing), but they also don't prove anything — see Section 6 for a concrete plan here, since you said you want to work on QA/testing next.

5. **Add frontend tests.** The frontend has Jest fully configured (`jest.config.ts`, `jest.setup.ts`, `@testing-library/jest-dom`, `jest-environment-jsdom` all installed) but zero test files exist anywhere under `frontend/app` or `frontend/src`, and `frontend/package.json` doesn't even have a `"test"` script yet. This is real infrastructure sitting unused.

6. **Decide on a deployment target.** This is the one item still deliberately parked per your earlier instruction — flagging it here only because you asked what's required "before deployment," and a target obviously has to exist before deployment can happen. Whenever you're ready to pick this back up: Render or Railway (backend + managed Postgres) paired with Vercel (Next.js frontend) is the smallest-lift combination given your stack, but this is your call to make, not something to default into.

7. **Minor, non-blocking:** align the two `package.json`s' `typescript` versioning style (H8); paginate `ServiceService.getAll()` for consistency with the other list endpoints (H7).

---

## 5. Deployment readiness, specifically

Since you asked "what has been achieved and what is required before deployment" directly: local containerization is genuinely done (Dockerfiles for both services, a `docker-compose.yml` that wires Postgres + backend + frontend together with proper health-gated startup). What's missing is everything past "runs on my machine in Docker": no hosting account/target has been chosen, nothing has ever been deployed anywhere, and CI has no deploy job (nor should it get one until a target is picked — adding a deploy step to a workflow with no destination doesn't accomplish anything). This is exactly where you paused deployment work before, and nothing in today's pass changes that recommendation — it's just factually where things stand.

---

## 6. Testing/QA — current state, ahead of the next phase

You mentioned wanting to work on QA/testing next, so here's a concrete picture to start from rather than a general "testing needs work."

**Backend — solid where it exists, with specific holes:**
- Real, assertion-backed coverage exists for: booking overlap rejection *and* genuine concurrent-race double-booking prevention (`Promise.all`-based, not just sequential), slot-freeing on cancellation, login rate-limiting behavior, OTP/MFA flow, staff scoping, change-request approval/auto-decline, service CRUD, gallery upload verification, and 24h-reminder de-duplication (seeded directly against the `NotificationLog` dedup check, so it doesn't depend on Resend actually succeeding in a test environment).
- Still stubbed (zero assertions): `GET /api/auth/me`, registration password-complexity/email-normalization, an isolated `AuthController` unit suite, general appointment-route wiring, and `GET /my-bookings`'s own-appointments/auth-required checks (note: `/my-bookings` behavior is exercised indirectly elsewhere, but this file itself asserts nothing).
- The test suite is configured to run against a real database with no test/dev isolation documented (`docs/BACKUP_RECOVERY.md` Section 6 already flags this and recommends a `beauty_parlor_test` database + `backend/.env.test`, which `tests/setup.ts` already tries to load — it just doesn't exist yet).

**Frontend — infrastructure ready, zero coverage:**
- Jest + Testing Library + jsdom are fully configured and installed.
- No `"test"` script in `package.json`, and no test files exist. Every page (booking flow, admin dashboard, auth forms) and every component currently has no automated coverage at all — this is the single biggest testing gap in the project, bigger than the five backend stubs combined.
- No E2E tooling (Playwright/Cypress) is installed anywhere, so there's currently no way to test a full user journey (browse → book → confirm) end-to-end without doing it by hand.

**Existing planning doc:** `docs/qa/Test_Strategy.md` is a high-level strategy document (risk register, test pyramid approach, entry/exit criteria) written in May, before several of these fixes landed — for example it lists staff appointment-scoping as "future," which is now shipped. It's a reasonable starting frame for the next phase but will need a pass to bring it in line with what's actually built.

---

## 7. Updated scorecard

| Domain | Original | Now | Why it moved |
|---|---|---|---|
| Domain correctness | 6/10 | 8/10 | No-show status, cutoff enforcement, and staff-scoped availability all landed. Multi-service bookings and inter-appointment buffer time remain real product gaps, not bugs. |
| Authz | 5/10 | 8/10 | Staff scoping fixed everywhere it was missing; the change-request bypass is closed. |
| Notifications | 6/10 | 8/10 | Dedup fixed, auth-email failures now logged and visible. |
| Money | 4/10 | 4/10 | Unchanged — intentionally out of scope. |
| Security | 4/10 | 8/10 | The rate-limit bug and non-functional MFA (the two "wrecked good bones" items) are both fixed. |
| Data/backup | 4/10 | 7/10 | Soft-delete, audit log (code-complete, migration pending), and real backup documentation all landed. |
| Testing | 3/10 | 5/10 | Real concurrency and dedup tests added; still ~40% of backend test files are stubs and frontend has zero tests. |
| CI/CD | 3/10 | 4/10 | The fix exists and is good, but hasn't been deployed to the actual workflow file yet — score reflects what's live, not what's ready. |
| Ops/observability | 3/10 | 7/10 | Structured logging, integration-aware health checks, crash visibility, and optional Sentry forwarding all added today and in recent sessions. |
| Admin day-1 | 4/10 | 5/10 | No-show status and audit trail give admins real new capability; no dedicated no-show/cancellation report UI exists yet. |
| Frontend polish | 5/10 | 5/10 | Unchanged — the duplicate `AuthContext.tsx` is still there pending your manual delete. |

---

## 8. Suggested order for what's next

Given everything above, here's a reasonable sequence — happy to take these in a different order if you'd rather:

1. You delete the duplicate `AuthContext.tsx` and run the `AdminAuditLog` migration (5 minutes total, unblocks everything else).
2. You copy the fixed `ci-cd.yml` over the live workflow file.
3. We convert the five stub tests into real assertions together.
4. We stand up frontend testing from zero — a `"test"` script, a first real component/page test, and decide whether E2E (Playwright) is worth adding now or later.
5. Whenever you're ready: revisit deployment target selection.

# Crown & Glow — Production Readiness Audit

Reviewed against the codebase at `beauty-parlor-app` on the local machine (backend: Express/TS/Prisma/Postgres; frontend: Next.js 16 / React 19). All findings below are backed by specific files; nothing here is inferred from comments, docs, or intent. `PLAN.md` in the repo is a prior AI-generated review of an earlier state of this code — several of its findings (booking race condition, missing helmet, no env validation, shared token table) have already been fixed. It was used only as a lead to re-verify, not as a source of truth; every claim below was re-checked against the current files.

---

## 1. Verdict

**Not ready.** The booking-correctness core is unusually solid for a solo build — the double-booking race is properly closed with a Serializable transaction and retry, the change-request/approval workflow is well modeled, and the auth fundamentals (bcrypt, refresh-token rotation, account lockout, anti-enumeration) are genuinely good. But three things stand between this and a real salon's Monday morning: a live security bug that makes the login/signup rate limits 10–30x weaker than the code claims, MFA that silently fails to deliver its own login code, and a complete absence of the two things a beauty salon business lives or dies on — a no-show/cutoff policy and a way to actually deploy the app anywhere. Layer onto that a CI pipeline that never runs the test suite (and a test suite that's ~60% empty `it.todo()` stubs), and this is not a "polish it" gap, it's a "several of the load-bearing walls aren't load-bearing yet" gap.

## 2. System map

- **Actors:** Customer (self-service booking/cancel/reschedule + change-request), Staff (same permissions as Admin on all bookings — no per-staff scoping), Admin (full control: services, staff, gallery, all appointments, change-request approval, revenue).
- **Booking lifecycle:** `POST /api/appointments/book` → Serializable-transaction overlap check against `staff_id` + time window → row created as `PENDING` → fire-and-forget email/SMS/QStash-reminder. Status only ever moves `PENDING → CONFIRMED → COMPLETED` (payment recorded here) or `→ CANCELLED` / `→ RESCHEDULED`, all via admin/staff `PATCH /:id/status` or the customer's own direct `cancel`/`reschedule` endpoints. A parallel **change-request** system (`request-edit`/`request-cancel` → admin `resolve`) exists for the same actions but gated on admin approval — see Blocker 1, it can be fully bypassed.
- **Notification lifecycle:** Booking events call into `notification.service.ts`, which fans out to Resend (email) and Twilio (SMS) in parallel via `Promise.allSettled`, logs each attempt to `NotificationLog`, and schedules a 24h reminder via Upstash QStash (which calls back a signature-verified webhook). None of this blocks the booking response.
- **Money lifecycle:** No online payment. `Transaction` rows are created only when staff/admin marks a booking `COMPLETED`, hardcoded as `payment_method: "cash"`. No deposits, no card-on-file, no refunds, no webhooks (there's nothing to receive webhooks from).

---

## 3. Blockers (fix before any production traffic)

**B1 — No deployment path exists at all.**
`docker-compose.yml` is a literal 0-byte file (CLAUDE.md's documented `docker-compose up -d` does nothing). There is no Dockerfile for either service, and no Procfile/render.yaml/fly.toml/Vercel config/nginx config anywhere in the repository. CI verifies the app *builds*; nothing ships it anywhere.
*Why it hurts:* there is currently no way to put this in front of a real customer.
*Fix:* pick a target (Render/Railway/Fly for backend+Postgres, Vercel for Next.js is the smallest-lift combo given the stack), write the Dockerfile(s) and a real `docker-compose.yml` for local Postgres, and add a deploy job to CI.
*Files:* `docker-compose.yml` (empty), repo root (no Dockerfile anywhere).

**B2 — Rate-limit config is dead code; the real, enforced limits are 10–30x weaker than the code claims.**
`backend/src/config/rateLimit.ts` declares `auth.max = 10` per 15 min and `createAccount.max = 5` per hour, with comments literally saying *"(was wrongly set to 100)"* / *"(was wrongly set to 150)"* — i.e. this was already flagged as a bug once. But `app.ts` doesn't import from `rateLimit.ts` at all — it wires up limiters from `backend/src/middleware/ratelimitter.middleware.ts`, which **hardcodes its own numbers**: `authRateLimiter` `max: 100` (comment: "10 attempts per 15 minutes") and `createAccountLimiter` `max: 150` (comment: "5 accounts per hour"). `rateLimit.ts` is unused dead code; the numbers actually protecting login and signup are 100/15min and 150/hour.
*Why it hurts:* credential-stuffing and signup-spam protection is an order of magnitude weaker than the team believes it is — this is the kind of gap that turns into a real incident the first time someone points a bot at `/api/auth/login`.
*Fix:* delete the duplicate config or make `ratelimitter.middleware.ts` import `rateLimitConfig` directly, then add a test asserting the 429 fires at the intended count.
*Files:* `backend/src/config/rateLimit.ts` vs `backend/src/middleware/ratelimitter.middleware.ts:5-25`.

**B3 — MFA is non-functional: the OTP code is never delivered to the user.**
`AuthService.generateOTP()` creates and stores the OTP row and only ever `console.log`s the code, gated on `NODE_ENV !== "production"`. There is no call to `sendAuthEmail`/`sendSms` for it anywhere. `login()` responds with `"MFA verification required. Check your email."` — but nothing was sent.
*Why it hurts:* any account with `mfa_enabled = true` is **permanently locked out of login in production**. This is a self-inflicted outage with no recovery path short of a manual DB write.
*Fix:* wire `generateOTP()` to actually send the code (reuse `sendAuthEmail`/the Resend client already in `auth.service.ts`), or hide "Enable MFA" from the UI until it does.
*Files:* `backend/src/services/auth.service.ts:351-369` (`generateOTP`), `:395-400` (`enableMFA`).

**B4 — No-show handling doesn't exist in the data model, let alone the product.**
`AppointmentStatus` is `PENDING | CONFIRMED | COMPLETED | CANCELLED | RESCHEDULED` — there is no `NO_SHOW` or `CHECKED_IN` value, and `updateStatusSchema` (Zod) rejects anything outside that enum. Payment is pay-in-store with zero deposit and no card-on-file. There is no job that flags an unattended `CONFIRMED` appointment after its time passes.
*Why it hurts:* for a salon, no-shows are the single biggest revenue leak, and this app cannot record one happened, cannot track a repeat offender, and cannot produce the no-show report a real owner needs (see Section 14 below) — the data simply doesn't exist to build one later without a migration.
*Fix:* add `NO_SHOW` (and ideally `CHECKED_IN`) to the enum, add a staff one-click "mark no-show" action, and put a policy behind it (e.g., 3 no-shows → require a card on file — even if that's phase 2, the *status* needs to exist now).
*Files:* `backend/prisma/schema.prisma` (`enum AppointmentStatus`), `backend/src/validators/appointment.validator.ts:41-49`.

**B5 — The admin-approval workflow for changes can be bypassed entirely, and neither path enforces a cutoff.**
The app has two parallel ways for a customer to change a booking: the careful one (`POST /:id/request-edit`, `/:id/request-cancel` → sits `PENDING` until an admin calls `resolve`, built with real engineering care in `changeRequest.service.ts`), and a completely separate, instant, no-approval-needed one (`DELETE /:id/cancel`, `PATCH /:id/reschedule`, both `authenticate`-only, going straight to `AppointmentService.cancelAppointment`/`rescheduleAppointment`). **Neither path has any minimum-notice/cutoff check** — a customer can cancel or reschedule an appointment starting in 60 seconds through the direct endpoints, and can skip the admin-approval flow entirely by just calling those instead.
*Why it hurts:* whatever cutoff/no-show policy the business wants (e.g., "no free cancellation inside 24h") has nowhere to attach, and the admin-review UI is decorative — customers never have to go through it.
*Fix:* decide on one authoritative path. If direct self-service cancel/reschedule is intended, add a cutoff-window check to `cancelAppointment`/`rescheduleAppointment` and remove/repurpose the change-request UI (e.g., for edits *inside* the cutoff, which then genuinely need approval). If change-requests are meant to be the only path, remove or admin/staff-restrict the direct routes.
*Files:* `backend/src/routes/appointment.routes.ts:20-23` vs `:29-31`; `backend/src/services/appointment.service.ts` (`cancelAppointment`, `rescheduleAppointment`).

**B6 — CI never runs the test suite, and most of the suite is empty stubs.**
`.github/workflows/ci-cd.yml` runs Prisma generate → `tsc --noEmit` → lint → build → verify build artifacts, for both backend and frontend. **There is no test-execution step anywhere in it**, and `backend/package.json` doesn't even define a `"test"` script. Of the 13 backend test files, 8 contain only `it.todo(...)` placeholders with zero assertions (`tests/appointment/*.test.ts`, all four `tests/integration/auth/*.test.ts`, `tests/unit/controllers/auth.controller.test.ts`) — including the exact scenarios this review most needs proven: "rejects a booking that overlaps," "locks the account after too many failed attempts," "requires OTP when MFA is enabled." The one real suite (`tests/appointment.test.ts`) is a good start but only covers the happy path, and per the file's own comment it runs against the same database as development (no test-DB isolation).
*Why it hurts:* nothing currently stops a regression in booking correctness or auth from reaching `main`, even though the tests to catch it are half-written.
*Fix:* add `"test": "jest"` and a CI step that runs it and fails the build on failure; convert the highest-value `it.todo`s (double-book rejection, account lockout, MFA-required) into real assertions first — they're already scaffolded.
*Files:* `.github/workflows/ci-cd.yml`, `backend/package.json` (no test script), `backend/src/tests/**/*.test.ts`.

---

## 4. High (before first real client)

**H1 — Staff has zero data scoping.** Every `isStaffOrAdmin`-gated route (`GET /appointments/all`, `PATCH /:id/status`, `GET /change-requests/pending`, `PATCH /change-requests/:id/resolve`) gives any `STAFF` account the same reach as `ADMIN` across *every* customer's appointments — none of the underlying service methods filter by `staff_id`. The project's own `docs/qa/Test_Strategy.md` documents this honestly: *"Staff — View assigned appointments (**future**)."* Not a bug, but a real gap if more than one staff member handles the front desk and any customer expects data minimization.
*Files:* `backend/src/routes/appointment.routes.ts:34-61`, `backend/src/services/appointment.service.ts` (`getAllAppointments`), `changeRequest.service.ts` (`getPendingRequests`, `resolve`).

**H2 — Signed Cloudinary uploads don't constrain type, size, or resource type.** `GalleryService.generateSignedUploadUrl()` / `ServiceService.generateSignedUploadUrl()` sign only `folder` + `timestamp`. Cloudinary allows the client to send additional *unsigned* parameters (`resource_type`, format) that fall outside that signature, so an authenticated admin session (or a stolen one) can push arbitrarily large or non-image assets straight to Cloudinary storage — no size or MIME check exists on that path (the 5MB/image-only `multer` filter in `upload.middleware.ts` only guards the legacy server-relay upload route, not the direct-to-Cloudinary one). `GalleryController.saveImage()` then persists whatever `url` string is POSTed with no verification it's actually this account's Cloudinary asset.
*Files:* `backend/src/services/gallery.service.ts:33-63`, `service.service.ts:52-81`, `backend/src/controllers/gallery.controller.ts:30-48`.

**H3 — No reminder de-duplication.** `notifyReminder24h()` correctly skips a *stale* reminder (appointment rescheduled since it was scheduled) but never checks `NotificationLog` for an existing `SENT` `REMINDER_24H` row before sending. QStash's delivery is at-least-once with `retries: 3` configured — a slow-but-ultimately-successful webhook response is enough to trigger a duplicate reminder text/email. This is exactly the scenario Section 12 calls out as a must-have test, and there's currently no code path that would make it pass.
*Files:* `backend/src/notifications/notification.service.ts:216-258`.

**H4 — Socket.io CORS doesn't support multiple origins even though REST CORS does.** `config/server.ts` splits `FRONTEND_URL` on commas into an array for Express CORS; `config/socket.ts` passes the raw, un-split string as Socket.io's `origin`. The moment `FRONTEND_URL` lists more than one domain (staging + prod, or `www` + apex), the socket handshake's CORS check silently fails for whichever origin isn't an exact string match.
*Files:* `backend/src/config/server.ts:11-14` vs `backend/src/config/socket.ts:5-11`.

**H5 — No graceful shutdown.** `server.ts` has no `SIGTERM`/`SIGINT` handler — a deploy or restart kills in-flight requests and the Prisma connection pool abruptly rather than draining them. Combined with B1 (no deploy pipeline yet), this will bite the first time a real deploy happens mid-booking.
*Files:* `backend/src/server.ts`.

**H6 — No error tracking or structured logging anywhere.** No Sentry/Bugsnag/equivalent in either `package.json`. Diagnosis today means reading raw `console.log`/`console.error` output — dozens of calls across the codebase, no request IDs, no correlation between a failed booking and the notification attempt it triggered.
*Files:* `backend/package.json`, `frontend/package.json` (no observability dependency in either); grep for `console.` across `backend/src`.

**H7 — Unbounded list endpoints.** `getAllAppointments()`, `AppointmentService.getAllServices()`, `getAllStaff()`, `GalleryService.getAllImages()` all return every row, no `?page=&limit=`. Fine today; will degrade as the appointment table grows, and there's no backend contract for a frontend page-size control to attach to later without a breaking change.
*Files:* `backend/src/services/appointment.service.ts`, `gallery.service.ts:23-28`.

**H8 — `typescript: "^6.0.3"` in backend `package.json`, `"^5"` in frontend.** TypeScript 6 was not a real published major as of this review's reference point — this is very likely a typo for `^5.x`. If it resolves to something unexpected (or fails to resolve at all), `npm ci` and the `tsc --noEmit` CI step either silently use a different compiler than intended or break outright. Verify what's actually being installed and pin an exact, real version in both packages.
*Files:* `backend/package.json:68`, `frontend/package.json:30`.

**H9 — Duplicate, diverging `AuthContext.tsx`.** Two independent copies exist: `frontend/app/context/AuthContext.tsx` (2607 bytes) and `frontend/src/context/AuthContext.tsx` (3881 bytes, the more complete one with proactive token refresh). Whichever a given page imports (`@/context/...` resolves based on `tsconfig.json` path mapping) silently determines its auth behavior, and a bugfix applied to one won't reach the other.
*Files:* both paths above.

**H10 — Frontend edge middleware trusts an unverified JWT payload.** `frontend/middleware.ts` base64-decodes the `accessToken` cookie's payload and reads `role`/`exp` **without verifying the signature** (it can't — Edge middleware has no access to the JWT secret). A hand-edited cookie with `role: "ADMIN"` gets past this gate into the `/admin` route tree. Actual data still requires a validly-signed token against the real API, so this is a UI-shell exposure, not a data breach — but it's the wrong trust boundary and should be documented as decorative, not relied on for anything that matters.
*Files:* `frontend/middleware.ts:13-28`.

**H11 — Auth-flow email failures are invisible.** `sendAuthEmail()` (used for verification and password-reset emails) catches Resend errors and only `console.error`s; the caller always returns the anti-enumeration success message regardless of actual delivery. Unlike the booking-flow emails, these writes never touch `NotificationLog` at all — there is no record, no alert, and no admin-visible signal when Resend is down. A customer who never gets their reset link has no recourse, and support has no way to see it happened.
*Files:* `backend/src/services/auth.service.ts:14-27` (`sendAuthEmail`).

---

## 5. 30-day hardening (Medium / Low)

**Security**
- `REFRESH_SECRET || JWT_SECRET` fallback in `config/auth.ts:7` is currently unreachable (validateEnv's `REQUIRED` list already hard-fails boot if `REFRESH_SECRET` is unset) — but it's confusing dead code implying a weaker guarantee than actually exists. Remove the fallback for clarity.
- `@typescript-eslint/no-explicit-any` is disabled (`backend/.eslintrc.js:14`) — weakens the value of "strict TypeScript" as a safety net.
- No `npm audit`/Snyk/Trivy/SAST step in CI.
- Access token lives in both `localStorage` and a non-httpOnly cookie (`frontend/src/lib/api.ts:182-201`) — necessary for the current header-based auth design, but means any XSS gets the token either way; worth a CSP (helmet is on, but check its default directives are actually restrictive) as a second layer.

**Data / jobs**
- `StaffAvailability` model exists in `schema.prisma` but is queried nowhere in the codebase — dead schema; `getAvailableSlots()` hardcodes a flat 9:00–19:00 grid for every staff member, every day, with no time-off/holiday/break support.
- `deleteAppointment()` hard-deletes and cascades onto `Review` (`onDelete: Cascade`) — Service and Staff get soft-deleted (`isActive`), Appointment doesn't; losing booking history this way also breaks any future no-show report.
- No admin audit log for price/status/customer-data changes — only `updated_at`, no who/why.
- Health check (`/health`) only pings Postgres; doesn't surface Resend/Twilio/Cloudinary/QStash reachability, so "all green" can still mean silent notification failure.
- No backup/PITR/restore-drill documentation anywhere in the repo.

**UX / product**
- No multi-service appointments (one `service_id` per booking) and no inter-appointment buffer/turnover time.
- No customer data export/delete flow beyond the notification-preferences unsubscribe endpoint.

**Cost / ops**
- No pagination (H7, repeated here for the hardening pass once fixed).
- No Redis/caching layer for `getAvailableSlots()`, the hottest read path — fine at current scale, revisit if booking volume grows.

---

## 6. Launch sequence

1. **Staging script** (run manually, in order, against a staging deploy once B1 exists):
   - Book a slot → confirm email + SMS arrive → confirm it shows on the admin dashboard in real time (Socket.io).
   - Open two browser sessions, race the same slot/staff/time → confirm exactly one booking succeeds and the other gets the "just booked by someone else" 409.
   - Cancel a booking via the *direct* endpoint seconds before its start time → currently succeeds with no friction (this is expected to fail this test until B5 is fixed).
   - Submit a change-request as a customer, approve it as admin → confirm the appointment updates and the customer is notified; then submit one against a slot another booking has since filled → confirm auto-decline fires.
   - Force a QStash reminder redelivery (resend the same webhook payload twice) → confirm the customer gets exactly one SMS/email, not two (expected to fail until H3 is fixed).
   - Log in with an MFA-enabled test account → confirm the OTP actually arrives somewhere (expected to fail until B3 is fixed).
   - Hit `/api/auth/login` >10 times in 15 minutes with bad credentials from one IP → confirm a 429 fires at the *intended* count, not 100 (expected to fail until B2 is fixed).
2. **Friends-and-family weekend:** real staff, real (non-card) bookings only, admin manually watching `NotificationLog` for `FAILED` rows daily, no marketing push.
3. **Production go/no-go:** every Blocker (Section 3) closed and re-verified against the staging script above; at least the account-lockout, double-booking, and reminder-dedup tests converted from `it.todo` to real, CI-enforced assertions; a deploy target exists and has been deployed to and rolled back from at least once.

---

## 7. Scorecard

| Domain | Score | One line |
|---|---|---|
| Domain correctness | 6/10 | Concurrency-safe booking is genuinely well engineered; no-show, cutoff, buffer, and multi-service gaps are real product holes. |
| Authz | 5/10 | Solid route-level RBAC, but staff has no scoping and the change-request approval gate is fully bypassable. |
| Notifications | 6/10 | Good architecture (fire-and-forget, logged, signature-verified webhook) undermined by no dedup and silent auth-email failures. |
| Money | 4/10 | Honest pay-in-store model with no payment integration to secure — but zero no-show/deposit mitigation for the thing that actually costs a salon money. |
| Security | 4/10 | Good bones (bcrypt, token rotation, lockout, anti-enumeration) wrecked by a live rate-limit bug and non-functional MFA. |
| Data/backup | 4/10 | Clean schema and indexes; no soft-delete on appointments, no audit log, no backup story documented anywhere. |
| Testing | 3/10 | Jest/Supertest configured with a real happy-path suite, but ~60% of test files are empty stubs and none of it runs in CI. |
| CI/CD | 3/10 | Type-check/lint/build is solid; zero tests, zero audit, zero deploy — it validates a build nobody can ship. |
| Ops/observability | 3/10 | No error tracking, no structured logs, no graceful shutdown, health check only covers the DB. |
| Admin day-1 | 4/10 | Real-time dashboard and change-request review exist; no no-show workflow, no cancellation report, no way to represent a no-show at all. |
| Frontend polish | 5/10 | Decent double-submit guard and timezone handling; duplicate AuthContext and an edge middleware trusting an unverified JWT are real landmines. |

---

## 8. Do not do

- Don't build a payment gateway integration yet — the pay-in-store model is honest and appropriate for a solo launch; a deposit/card-on-file feature is a real project, not a bolt-on, and the no-show *status* (B4) has to exist before a policy on top of it makes sense.
- Don't add Redis/caching for `getAvailableSlots()` — it's not the bottleneck at this scale; fix the rate-limit bug (B2) first, that's the actual live risk.
- Don't write an OpenAPI/Swagger spec this week — nice-to-have, not blocking anything above.
- Don't decompose the large admin dashboard component or chase the `any`-type ESLint rule before the Blockers are closed — real, but cosmetic next to a non-functional MFA flow.
- Don't stand up a multi-region/HA deployment — get *a* working single-region deploy (B1) before optimizing for redundancy you don't have traffic to need yet.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Crown & Glow is a full-stack beauty parlor booking system. The backend is Express + TypeScript + PostgreSQL (via Prisma), and the frontend is Next.js 16 (App Router) + React 19 + Tailwind CSS 4. Real-time updates use Socket.io; notifications use Resend (email), Twilio (SMS), and Upstash QStash (scheduled reminders).

## Commands

### Backend (`cd backend`)

```bash
npm run dev            # ts-node dev server
npm run dev:watch      # nodemon + ts-node (auto-restart)
npm run build          # tsc → dist/
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Run pending migrations
npm run prisma:studio    # Open Prisma Studio GUI
npm run db:seed        # Seed database
npm run db:reset       # reset + generate + migrate + seed
```

Running tests (Jest + Supertest):
```bash
npx jest                        # all tests
npx jest --testPathPattern=auth  # single file/pattern
npx jest --watch                 # watch mode
```

### Frontend (`cd frontend`)

```bash
npm run dev    # Next.js dev server
npm run build  # production build
npm run lint   # ESLint check
```

### Database (Docker)

```bash
docker-compose up -d   # start PostgreSQL
docker-compose down    # stop
```

### CI/CD

GitHub Actions runs on push to `main`/`develop` and PRs to `main`. Pipeline: Prisma generate → TypeScript type-check → lint → build → verify output artifacts. Both backend (`dist/server.js`) and frontend (`.next/`) are verified.

## Architecture

### Backend — 3-layer pattern

```
routes/ → controllers/ → services/
```

- **routes/**: Wire up Express routers, apply middleware (auth, rate limiters)
- **controllers/**: Parse req/res, call validators, delegate to services, return responses
- **services/**: All business logic — `AuthService`, `AppointmentService`, etc.
- **validators/**: Zod schemas only; export from `validators/index.ts`
- **middleware/**: `authenticate` (JWT), `authorize(roles)` (RBAC), `errorHandler` (global)
- **config/**: One file per concern — `auth.ts`, `email.ts`, `rateLimit.ts`, `socket.ts`, `server.ts`, `cloudinary.ts`
- **socket/**: `socket.server.ts` initializes Socket.io; consumers call `getIO()` to emit events
- **notifications/**: `email.service.ts`, `sms.service.ts`, `scheduler.service.ts`, `notification.service.ts` — always called fire-and-forget with `Promise.allSettled()`

### Frontend

- **AuthContext** (`src/context/AuthContext.tsx`): Global user state + `useAuth()` hook. Stores JWT in localStorage + cookie. Auto-refreshes on mount.
- **API client** (`src/lib/api.ts`): Centralized fetch wrapper with `getToken`/`setToken`/`removeToken` helpers. Base URL from `NEXT_PUBLIC_API_URL`.
- **Socket client** (`src/lib/socket.ts`): Socket.io-client singleton initialized on mount, connects to backend.
- **App Router**: Pages and layouts live in `src/app/`.

### Database

Prisma schema at `backend/prisma/schema.prisma`. Key models: `User`, `RefreshToken`, `PasswordResetToken`, `OtpCode`, `Service`, `Staff`, `StaffAvailability`, `Appointment`, `Review`, `Transaction`, `GalleryImage`, `Notification`, `NotificationLog`.

After editing `schema.prisma`, always run `npm run prisma:generate` before `npm run prisma:migrate`.

## Key Behaviors

**Auth flow**: JWT access tokens (15 min) + refresh tokens (7 days stored in DB). 5 failed logins lock the account for 30 min. MFA uses 6-digit OTP (10-min expiry). Password reset tokens expire in 1 hour; email verification tokens in 24 hours.

**Rate limits** (configured in `config/rateLimit.ts`):
- API: 60 req/min
- Login: 10 attempts/15 min
- Register: 5 accounts/hour
- Booking: 8/hour

**Real-time**: Socket.io rooms — `"admin"` for admin notifications, `"user_<userId>"` for per-customer updates. Booking events emit to both rooms on create/update.

**Appointment slots**: 9 AM–6:30 PM, 30-min increments. `getAvailableSlots()` filters out booked and overlapping slots.

**Notifications**: `notifyBookingConfirmed()` sends email + SMS + schedules 24h QStash reminder, all via `Promise.allSettled()` so booking creation never blocks on notification failures. Results are logged to `NotificationLog`.

## Next.js Version Note

The frontend uses Next.js **16.2.4**, which is ahead of the standard release. Some APIs or behaviors may differ from the stable 15.x docs. Check `frontend/AGENTS.md` and `frontend/CLAUDE.md` for known caveats before upgrading dependencies.

## Environment Variables

Copy `.env.example` to `.env` in the `backend/` directory. Required: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `FRONTEND_URL`, `RESEND_API_KEY`, `TWILIO_*`, `UPSTASH_*`, `CLOUDINARY_*`. The frontend needs `NEXT_PUBLIC_API_URL`.

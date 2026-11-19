<div align="center">

# 👑 Crown & Glow

**A full-stack salon booking platform with real-time admin and customer dashboards**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Railway-8A2BE2?style=for-the-badge)](https://caring-playfulness-production-16c66a0f.up.railway.app/)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma)

[Live Demo](https://caring-playfulness-production-16c66a0f.up.railway.app/) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Security](#-security) · [Run Locally](#-getting-started)

![Crown & Glow demo](docs/screenshots/demo.gif)

</div>

---

## 📖 About

Crown & Glow is a booking platform for a beauty parlor offering brow & lash, waxing, and facial services. Customers can browse services, book appointments with a specific stylist, and manage their bookings, while salon admins manage staff, services, the gallery, and the homepage — all with live updates across dashboards.

It's built as a production-style portfolio project: deployed with CI/CD, tested, and hardened with security controls throughout the stack.

> **Try it:** sign in with the demo account below, or create your own.
>
> | Role            | Email             | Password             |
> | --------------- | ----------------- | -------------------- |
> | Customer (demo) | `DEMO_EMAIL_HERE` | `DEMO_PASSWORD_HERE` |

---

## ✨ Features

### For customers

- 📅 **Online booking** with real-time availability and **conflict detection** (interval-overlap logic prevents double-booking)
- 🔄 **Cancel & reschedule** with an enforced notice cutoff
- 🔔 **Appointment reminders** by email and SMS, scheduled in the background
- 👤 **Customer dashboard** with upcoming and past bookings
- 🖼 **Gallery** filterable by category (Brows & Lashes, Waxing, Facials, Before & After)

### For admins

- 📊 **Admin dashboard** with live booking updates via **Socket.io**
- 💇 **Staff management** — specializations, bios, availability
- 🧾 **Service catalog** management — categories, pricing, duration, "popular" flags
- 🖼 **Gallery uploads** via signed Cloudinary uploads
- 🏠 **Homepage hero editor** — manage hero slides without touching code
- 🚫 **No-show tracking** and booking status management

### Authentication

- ✉️ Email verification on sign-up
- 🔑 Forgot / reset password flow
- 🛡 Multi-factor authentication (MFA)
- 💪 Live password-strength feedback

---

## 🛠 Tech Stack

| Layer              | Technologies                                      |
| ------------------ | ------------------------------------------------- |
| **Frontend**       | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| **Backend**        | Node.js, Express, TypeScript                      |
| **Database**       | PostgreSQL, Prisma ORM                            |
| **Real-time**      | Socket.io                                         |
| **Validation**     | Zod                                               |
| **Email / SMS**    | Resend, Twilio                                    |
| **Scheduled jobs** | Upstash QStash                                    |
| **Media**          | Cloudinary                                        |
| **Testing**        | Jest, Supertest                                   |
| **CI/CD**          | GitHub Actions (`develop` → `main` PR workflow)   |
| **Hosting**        | Railway (frontend, backend, and PostgreSQL)       |

---

## 🏗 Architecture

```
┌──────────────────────┐        HTTPS / REST         ┌──────────────────────────┐
│   Next.js Frontend   │ ──────────────────────────▶ │     Express Backend      │
│  (customer + admin)  │ ◀────── Socket.io ───────── │  routes → middleware →   │
└──────────────────────┘     (live updates)          │  validators → services   │
                                                     └────────────┬─────────────┘
                                                                  │ Prisma
                                                     ┌────────────▼─────────────┐
                                                     │        PostgreSQL        │
                                                     └──────────────────────────┘
        External services:  Resend (email) · Twilio (SMS) · QStash (reminders) · Cloudinary (images)
```

Every request passes through **three gates** before reaching the database:

1. **Validator** — Zod checks the shape and format of the input
2. **Middleware** — authentication and role-based authorization
3. **Service** — business rules (e.g., booking conflicts, cancellation cutoff)

---

## 🔒 Security

Security was treated as a feature, not an afterthought. The table below maps Crown & Glow against the [OWASP Top 10:2025](https://owasp.org/Top10/2025/), the current edition of OWASP's list of the most critical web application security risks.

| OWASP 2025 | How Crown & Glow addresses it |
|---|---|
| **A01 Broken Access Control** | Role checks on every protected Express route (`isAdmin`, `isStaffOrAdmin`), not just in the Next.js `middleware.ts`. Ownership is enforced in the service layer: customers can only cancel or reschedule their own appointments, and staff can only update appointments assigned to them (`403` otherwise). |
| **A02 Security Misconfiguration** | `helmet` security headers and a restricted CORS origin. `validateEnv.ts` fails fast at startup if a required secret is missing. Stack traces are only returned in development. Separate secrets per environment, and the production database is not publicly reachable. The seed script refuses to run against production unless explicitly allowed. |
| **A03 Software Supply Chain Failures** | `npm audit --audit-level=high --omit=dev` runs in CI for both backend and frontend and fails the build on high/critical advisories. This caught and led to patching a Next.js remote-code-execution advisory. Lockfiles are committed. |
| **A04 Cryptographic Failures** | Passwords hashed with bcrypt (configurable rounds). JWTs signed with environment-held secrets and delivered in `httpOnly`, `secure`, `sameSite=strict` cookies. HTTPS in production. Cloudinary uploads are signed server-side. |
| **A05 Injection** | All database access goes through Prisma's parameterized queries, with no raw SQL in application code. Every request body is validated with Zod schemas before it reaches business logic. |
| **A06 Insecure Design** | Three separate gates before data reaches the database: **validator → middleware → service**. Staff double-booking is blocked at the database level by a Postgres exclusion constraint (`btree_gist`), not only by application checks. Booking writes run in serializable transactions. Cancel/reschedule cutoffs are enforced on the server. |
| **A07 Authentication Failures** | Email verification, MFA, password strength enforcement, and secure forgot/reset-password flows. Account lockout after repeated failed logins. Tiered rate limits on auth, signup and password-reset endpoints. Refresh tokens are rotated on use. |
| **A08 Software or Data Integrity Failures** | `develop` → `main` pull-request workflow. CI runs type checks, lint, migrations, seeding and the full test suite against an ephemeral Postgres before merge. Incoming scheduled-job webhooks (QStash) are signature-verified. A full-history Gitleaks scan confirmed no secrets in the repo. |
| **A09 Security Logging & Alerting Failures** | Structured JSON logging with a per-request `requestId` for correlation. An admin audit log records who changed what (appointment status, service price/details, staff records) with field-level diffs. Optional Sentry forwarding for errors. |
| **A10 Mishandling of Exceptional Conditions** | A global error middleware maps known database errors (e.g. exclusion-constraint and unique-index violations) to safe, user-friendly responses without leaking internals. Serializable transactions retry on write conflicts so race conditions return the correct domain error instead of a crash. Audit-log failures are caught so they never break the operation being recorded. |

### Known gaps / next steps

Being honest about what's not done yet:

- **Refresh tokens are stored as plain values** in the database; hashing them (as with passwords) would limit damage from a database leak.
- **Failed logins and lockouts aren't logged** as security events yet, and there is no alerting on suspicious patterns.
- **The 403 response echoes the user's role** and the required roles; a generic message would disclose less.
- **Sentry is opt-in** and not enabled in the demo deployment.

---

## 📸 Screenshots

| Homepage                                   | Booking flow                             |
| ------------------------------------------ | ---------------------------------------- |
| ![Homepage](docs/screenshots/homepage.png) | ![Booking](docs/screenshots/booking.png) |

| Customer dashboard                                             | Admin dashboard                                          |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| ![Customer dashboard](docs/screenshots/customer-dashboard.png) | ![Admin dashboard](docs/screenshots/admin-dashboard.png) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Accounts for Resend, Cloudinary, Twilio, and Upstash QStash (for full functionality)

### 1. Clone the repository

```bash
git clone https://github.com/S-Silwal/beauty-parlor-app.git
cd beauty-parlor-app
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env        # then fill in your own values
npx prisma migrate dev
npm run db:seed             # optional: sample services, staff, and gallery
npm run dev                 # http://localhost:5000
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
npm run dev                 # http://localhost:3000
```

### Running tests

```bash
cd backend
npm test
```

---

## 📁 Project Structure

```
beauty-parlor-app/
├── backend/
│   ├── prisma/              # Schema and migrations
│   └── src/
│       ├── config/          # Auth, email, database, socket, rate-limit config
│       ├── middleware/      # Auth & role checks
│       ├── validators/      # Zod schemas
│       ├── services/        # Business logic
│       ├── routes/          # API routes
│       └── utils/           # Seed script and helpers
├── frontend/
│   └── app/                 # Next.js App Router pages
└── .github/workflows/       # CI/CD pipeline
```

---

## 🧭 Roadmap

- [ ] Custom domain with verified email sending
- [ ] Expanded end-to-end test coverage
- [ ] AI booking assistant for natural-language appointment requests
- [ ] Online deposits / payments

---

## 👩‍💻 Author

**Janalyn** — Full-stack developer focused on AI integration and secure software development

- GitHub: [@S-Silwal](https://github.com/S-Silwal)
- LinkedIn: [YOUR_LINKEDIN_URL](YOUR_LINKEDIN_URL)
- Portfolio: [YOUR_PORTFOLIO_URL](YOUR_PORTFOLIO_URL)

---

<div align="center">
<sub>Built with care — and a lot of debugging ✨</sub>
</div>

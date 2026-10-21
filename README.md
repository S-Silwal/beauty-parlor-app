<div align="center">

# 👑 Crown & Glow

**A full-stack salon booking platform with real-time admin and customer dashboards**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Railway-8A2BE2?style=for-the-badge)](https://caring-playfulness-production-2f7f.up.railway.app/)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma)

[Live Demo](https://caring-playfulness-production-2f7f.up.railway.app/) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Security](#-security) · [Run Locally](#-getting-started)

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

Security was treated as a feature, not an afterthought:

- **Authentication** — JWTs stored in httpOnly cookies, with refresh tokens and MFA
- **Role-based access control** — enforced on the backend and in Next.js `middleware.ts`
- **Brute-force protection** — rate limiting plus account lockout after repeated failed logins
- **Input validation** — every request body validated with Zod before touching business logic
- **Password security** — bcrypt hashing and strength enforcement
- **Secret management** — no secrets in the repo; all config via environment variables (`.env.example` documents them with placeholders), verified with a full-history Gitleaks scan
- **Safe seeding** — the seed script refuses to run against production unless explicitly allowed, and requires non-default passwords when it does
- **Signed uploads** — Cloudinary uploads are signed server-side
- **Dependency scanning** — `npm audit` runs in CI on every push

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

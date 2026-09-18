# Deploying Crown & Glow to Railway

This walks through deploying the app as three Railway services in one project: **Postgres**, **backend** (Express API), and **frontend** (Next.js). Both `backend/` and `frontend/` already have production Dockerfiles and a `railway.json` (build + healthcheck config), so Railway auto-detects everything once each service's Root Directory is set correctly.

## 1. Create the project

1. Go to [railway.app](https://railway.app) and sign in (GitHub login is easiest — it also makes step 2 one click).
2. **New Project → Deploy from GitHub repo** → pick this repo. Railway will create a first service from the repo root; you'll fix its root directory in step 3, or just delete it and add services individually via **New → GitHub Repo** three times (once per service below) if that's cleaner.

## 2. Add Postgres

**New → Database → Add PostgreSQL.** Railway provisions it and exposes a `DATABASE_URL`-shaped set of variables automatically — no manual setup needed. Note the service name (default `Postgres`); you'll reference its `DATABASE_URL` from the backend service in step 4.

## 3. Add the backend service

1. **New → GitHub Repo** → this repo.
2. In the new service's **Settings → Source**, set **Root Directory** to `backend`. Railway will pick up `backend/railway.json` and `backend/Dockerfile` automatically (Dockerfile build, healthcheck at `/health`).
3. **Settings → Networking → Generate Domain** to get a public URL (something like `crown-glow-backend-production.up.railway.app`). Copy it — the frontend needs it.

## 4. Set backend environment variables

In the backend service's **Variables** tab, add (values from your `backend/.env` — never commit real secrets):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway variable reference — click "Add Reference" and pick the Postgres service) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | your real secret |
| `REFRESH_SECRET` | your real secret |
| `FRONTEND_URL` | the frontend's public URL from step 5 (fill in after step 5, then redeploy) |
| `BACKEND_URL` | the backend's own public URL from step 3 |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | from Resend |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | from Twilio |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from Cloudinary |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | from Upstash QStash |

`PORT` doesn't need to be set — Railway injects it and `server.ts` already reads `process.env.PORT`. Everything not marked required in `backend/src/config/validateEnv.ts` (email/SMS/uploads/reminders) just disables that one feature if left unset — fine for an initial deploy, fill in later.

The Dockerfile runs `npx prisma migrate deploy` on every boot before starting the server, so the schema is applied automatically on first deploy — no separate migration step needed.

## 5. Add the frontend service

1. **New → GitHub Repo** → this repo again.
2. **Settings → Source → Root Directory** → `frontend`.
3. **Settings → Variables** → add `NEXT_PUBLIC_API_URL` = the backend's public URL from step 3 (e.g. `https://crown-glow-backend-production.up.railway.app`).
   - This is baked in at **build** time (see `frontend/Dockerfile`'s `ARG NEXT_PUBLIC_API_URL`), so Railway needs it set *before* the first build. If you add/change it later, trigger a redeploy.
4. **Settings → Networking → Generate Domain** for the public frontend URL.
5. Go back to the backend service's variables and set `FRONTEND_URL` to this URL, then redeploy the backend (needed for CORS to allow requests from the frontend).

## 6. First deploy checklist

- [ ] Postgres service running (green)
- [ ] Backend deployed, `https://<backend-domain>/health` returns `200`
- [ ] Frontend deployed, loads in browser
- [ ] Booking a test appointment on the frontend succeeds end-to-end (frontend → backend → Postgres)
- [ ] Socket.io real-time updates work (open admin dashboard in one tab, book in another, see it appear live)
- [ ] `FRONTEND_URL` on backend and `NEXT_PUBLIC_API_URL` on frontend point at each other's real Railway domains, not `localhost`

## 7. Redeploying later

By default, connecting a GitHub repo to a Railway service auto-deploys on every push to the connected branch. If you'd rather control this manually (recommended while this is still a demo project): each service's **Settings → Source** has a toggle to disable auto-deploy — leave it off and use **Deploy** in the Railway dashboard (or `railway up` via the CLI) when you're ready to ship a change.

## Notes

- `docker-compose.yml` at the repo root is for **local development only** (`docker compose up -d`) — Railway does not read it; each service builds from its own Dockerfile as configured above.
- This is set up for a single Railway environment (production). If you later want a staging environment, Railway's **Environments** feature can clone this whole setup with one click.
- Seeding: `db:seed` refuses to run against a production database unless `ALLOW_PROD_SEED=true` is set — intentional, don't set it unless you mean to seed prod.

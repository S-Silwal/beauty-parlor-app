# Backup & Recovery

This project had no documented backup/restore process anywhere in the repo
(see the 30-day hardening audit). That gap turned into a real incident:
`prisma migrate reset` was run against the local dev database with no
backup in place, wiping every user account, appointment, and gallery
record. The gallery photos themselves were recoverable because Cloudinary
storage is separate from Postgres — see the recovery note at the bottom —
but the database rows were not. This document exists so that doesn't
happen again, and so a real restore has actually been tested at least once
before it's ever needed for real.

## 1. What's at risk, and where it lives

| Data | Lives in | Wiped by |
|---|---|---|
| Users, appointments, staff, services, reviews, transactions, gallery *records* | Local PostgreSQL (`beauty_parlor` database) | `prisma migrate reset`, `npm run db:reset`, `npm run prisma:reset`, or `prisma migrate dev` accepting a reset prompt |
| Actual photo files | Cloudinary (separate system entirely) | Only an explicit delete through the app, or directly in the Cloudinary console — **not** touched by any Postgres/Prisma command |

Postgres is the part that needs a backup habit. Cloudinary is comparatively
safe from anything this app's own tooling does to the database.

## 2. Commands that can destroy data — treat these like `DROP DATABASE`

- `npm run db:reset`
- `npm run prisma:reset` (`prisma migrate reset`)
- `npm run prisma:migrate` (`prisma migrate dev`) — usually safe, but if it
  detects your migration history doesn't match the database state, it will
  offer (and can auto-accept, non-interactively) a full reset

**Rule: never run any of these without taking a backup immediately first.**
Section 3 covers how.

## 3. Taking a backup (pgAdmin)

1. Open pgAdmin, expand your server → **Databases** → `beauty_parlor`.
2. Right-click `beauty_parlor` → **Backup...**
3. **Filename:** save it outside the project folder — e.g. a `db-backups`
   folder in Documents — as something like `beauty_parlor_2026-09-14.backup`.
4. **Format:** leave it on **Custom** (the default) — compressed and
   restorable through pgAdmin's own Restore feature.
5. **Role name:** leave blank, or select the role you're connected as
   (typically `postgres`) if pgAdmin requires a selection.
6. Click **Backup**.

Do this:
- Immediately before running any command listed in Section 2.
- At the end of any session where you've built up data you'd be upset to
  lose (test bookings you want to keep for a demo, a populated gallery,
  etc.).
- Before a capstone submission/demo, as a final safety net.

### Command-line equivalent (for scripting/automation)

```bash
pg_dump -U postgres -Fc beauty_parlor > beauty_parlor_$(date +%F).backup
```

## 4. Restoring from a backup

1. In pgAdmin, right-click the target database (a fresh empty one, or
   `beauty_parlor` itself if you're intentionally overwriting it) →
   **Restore...**
2. Point it at the `.backup` file from Section 3.
3. Run the restore, then spot-check a table (e.g. `users`) to confirm real
   data came back, not just an empty schema.

Command-line equivalent:

```bash
pg_restore -U postgres -d beauty_parlor --clean beauty_parlor_2026-09-14.backup
```

## 5. Restore drill — do this at least once

A backup you've never restored from is a hope, not a plan. Before relying
on this process for anything real:

1. Take a backup of `beauty_parlor` right now (Section 3).
2. Create a throwaway database, e.g. `beauty_parlor_restore_test`.
3. Restore the backup into it (Section 4, pointed at the throwaway DB).
4. Confirm the row counts/content in the restored copy match what you
   expect.
5. Drop the throwaway database once confirmed.

This proves the backup file is actually valid and that you know the restore
steps under no time pressure — not for the first time during an actual
emergency.

## 6. Separating test data from real data

Right now, `backend/.env` has a single `DATABASE_URL` and there's no
`backend/.env.test`, so running the test suite (or the seed script) can
touch the same database you're actively developing/demoing against.

Recommended fix: create a second local database (e.g. `beauty_parlor_test`)
and add a `backend/.env.test` with its own `DATABASE_URL` pointing at it.
`backend/src/tests/setup.ts` already attempts to load `.env.test` — it's
just missing today, so it silently falls through to the real database.

## 7. Recovering images from Cloudinary after a database wipe (reference)

If the database gets wiped but Cloudinary itself wasn't touched, the actual
photo files are usually still recoverable, since Cloudinary storage and
Postgres are independent systems:

1. Open the [Cloudinary console](https://console.cloudinary.com) → Media
   Library → check the `beauty-parlor/gallery` and `beauty-parlor/services`
   folders for surviving files.
2. For gallery photos, run `backend/src/utils/restoreGalleryFromCloudinary.ts`
   (`npx ts-node src/utils/restoreGalleryFromCloudinary.ts` from `backend/`)
   — it lists whatever's still in Cloudinary and recreates the matching
   `GalleryImage` rows automatically, skipping anything already restored.
3. Service photos aren't automatically matchable to a specific service (Cloudinary
   has no idea which photo belongs to which service), so that requires
   manually identifying each photo in the Media Library and re-attaching it.

This only recovers **images**. It does not recover users, bookings, or any
other database row — those only come back from an actual Postgres backup
(Section 4). This is why Section 2's rule matters regardless of Cloudinary
being safer by default.

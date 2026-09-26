-- Makes explicit, at the database level, what the application layer has
-- always implicitly assumed: appointment_date is an absolute UTC instant.
--
-- The column was a bare TIMESTAMP (no time zone) — see 0_init. Postgres
-- stores a "timestamp without time zone" value exactly as given, with no
-- conversion in either direction; Prisma/node-postgres, given no other
-- reference, always serializes a JS Date into (and parses it back out of)
-- such a column using its UTC wall-clock digits. So this migration does
-- not change what any existing row means: `AT TIME ZONE 'UTC'` below
-- reinterprets each already-UTC-shaped naive value as the timestamptz
-- carrying that exact same instant. It only removes the ambiguity for
-- every future read/write and, critically, for raw SQL (the partial
-- unique index rebuilt below) that doesn't go through Prisma's JS-level
-- Date handling at all.
--
-- This was the missing piece behind a real production bug: the booking
-- flow's own naive "YYYY-MM-DDTHH:mm:ss" strings (see
-- createAppointmentSchema.appointment_date and requestEditSchema.
-- requested_date, both hardened alongside this migration to reject
-- exactly that shape) were being parsed as the server process's own
-- timezone — UTC on Railway, not the salon's America/Indiana/Indianapolis
-- — so a customer picking "11:00 AM" ended up with 11:00 UTC stored
-- instead of the correct 15:00Z/16:00Z (EDT/EST). Every UI that then
-- correctly converted UTC -> local (admin's browser, the client-side
-- duplicate-booking banner) displayed a time 4-5 hours off from what the
-- customer saw on their own success screen, which never did that
-- conversion. Fixed going forward by backend/src/utils/timezone.ts and
-- frontend/src/lib/timezone.ts; this migration is the storage half of
-- that fix. It does not, and cannot, correct the *meaning* of any
-- already-mis-stored historical row — only new bookings created after
-- this deploys are guaranteed correct.
ALTER TABLE "appointments"
  ALTER COLUMN "appointment_date" TYPE TIMESTAMPTZ(3)
  USING "appointment_date" AT TIME ZONE 'UTC';

-- Rebuild the same-service-same-day partial unique index (see
-- 20260925140000_add_duplicate_service_same_day_guard) so its notion of
-- "calendar day" is pinned to the salon's own zone explicitly, via a
-- literal zone name in the expression itself — never the database
-- session's ambient `timezone` GUC, which Postgres would otherwise use for
-- date_trunc() on a timestamptz and which every session/pooled connection
-- isn't guaranteed to agree on. This must be dropped and recreated rather
-- than left for Postgres's automatic index-rebuild-on-ALTER-COLUMN-TYPE,
-- which would silently reinterpret the existing expression's semantics
-- against the new timestamptz type (i.e. start depending on that same
-- ambient session timezone) instead of this explicit, deterministic one.
DROP INDEX IF EXISTS "appointments_customer_service_active_day_unique";

CREATE UNIQUE INDEX "appointments_customer_service_active_day_unique"
  ON "appointments" (
    "user_id",
    "service_id",
    (date_trunc('day', "appointment_date" AT TIME ZONE 'America/Indiana/Indianapolis'))
  )
  WHERE "status" IN ('PENDING', 'CONFIRMED');

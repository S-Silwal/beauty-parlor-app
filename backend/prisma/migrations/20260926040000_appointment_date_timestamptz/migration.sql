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

-- Drop the old same-service-same-day partial unique index (see
-- 20260925140000_add_duplicate_service_same_day_guard). It's rebuilt below
-- on a dedicated column rather than recreated as an expression index — see
-- the comment above appointment_local_day for why.
DROP INDEX IF EXISTS "appointments_customer_service_active_day_unique";

-- appointment_local_day holds the salon-local (America/Indiana/
-- Indianapolis) calendar date that appointment_date falls on, as a plain
-- DATE. It exists solely so the same-service-same-day unique index below
-- can be built on a plain column instead of an expression: Postgres
-- requires every function used in an index expression to be marked
-- IMMUTABLE, and `date_trunc('day', timestamptz AT TIME ZONE
-- 'named-zone')` is only STABLE — a named-zone conversion depends on the
-- zone's (potentially DST-shifting) rules, which Postgres's immutability
-- checker rejects even though the zone here is a fixed literal. A plain
-- DATE column has no such restriction. (A GENERATED ALWAYS AS STORED
-- column hits the identical IMMUTABLE requirement on its own generation
-- expression, so it doesn't avoid this either — a trigger is the only way
-- to keep this computed automatically.)
--
-- Nullable during backfill; NOT NULL is enforced below once every existing
-- row has a value.
ALTER TABLE "appointments"
  ADD COLUMN "appointment_local_day" DATE;

UPDATE "appointments"
  SET "appointment_local_day" =
    (("appointment_date" AT TIME ZONE 'America/Indiana/Indianapolis')::date);

ALTER TABLE "appointments"
  ALTER COLUMN "appointment_local_day" SET NOT NULL;

-- Trigger-maintained rather than application-maintained: a BEFORE INSERT/
-- UPDATE trigger guarantees appointment_local_day always matches
-- appointment_date no matter which code path writes the row (Prisma's
-- appointment.service.ts today, but also any future path, a script, or a
-- manual `psql` insert) — the same "defense-in-depth independent of
-- application code" reasoning already applied to the exact-instant guard
-- in 20260916150000_add_appointment_overlap_guards. A trigger body is not
-- restricted to IMMUTABLE-only calls (only the indexed expression itself
-- is), so it may freely use the named-zone AT TIME ZONE conversion that
-- the index expression above could not.
CREATE OR REPLACE FUNCTION set_appointment_local_day()
RETURNS TRIGGER AS $$
BEGIN
  NEW."appointment_local_day" :=
    ((NEW."appointment_date" AT TIME ZONE 'America/Indiana/Indianapolis')::date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_set_local_day ON "appointments";

CREATE TRIGGER appointments_set_local_day
  BEFORE INSERT OR UPDATE OF "appointment_date" ON "appointments"
  FOR EACH ROW
  EXECUTE FUNCTION set_appointment_local_day();

-- Rebuilt on the plain, trivially-immutable appointment_local_day column
-- instead of the previous date_trunc(... AT TIME ZONE ...) expression,
-- which Postgres rejects inside CREATE INDEX (see comment above).
CREATE UNIQUE INDEX "appointments_customer_service_active_day_unique"
  ON "appointments" (
    "user_id",
    "service_id",
    "appointment_local_day"
  )
  WHERE "status" IN ('PENDING', 'CONFIRMED');

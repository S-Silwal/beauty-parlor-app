-- Staff double-booking guard at the DB level. Any two active bookings for
-- the same staff member whose [start, end) times overlap are rejected,
-- independent of assertSlotAvailable() — closes the race where two
-- simultaneous requests both pass the app-level check.

-- Lets a GiST index compare staff_id with = alongside the range overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- appointment_date + interval is only STABLE, so it can't go straight into
-- the constraint. Store the end time in its own column, kept in sync by a
-- trigger (same pattern as appointment_local_day).
ALTER TABLE "appointments" ADD COLUMN "appointment_end" TIMESTAMPTZ(3);

UPDATE "appointments"
  SET "appointment_end" = "appointment_date" + ("duration" * interval '1 minute');

ALTER TABLE "appointments" ALTER COLUMN "appointment_end" SET NOT NULL;

CREATE OR REPLACE FUNCTION set_appointment_end()
RETURNS TRIGGER AS $$
BEGIN
  NEW."appointment_end" :=
    NEW."appointment_date" + (NEW."duration" * interval '1 minute');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_set_end ON "appointments";

CREATE TRIGGER appointments_set_end
  BEFORE INSERT OR UPDATE OF "appointment_date", "duration" ON "appointments"
  FOR EACH ROW
  EXECUTE FUNCTION set_appointment_end();

-- '[)' = end-exclusive, so a 10:00–11:00 booking and an 11:00–12:00
-- booking for the same staff are allowed back-to-back.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_staff_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    tstzrange("appointment_date", "appointment_end", '[)') WITH &&
  )
  WHERE ("staff_id" IS NOT NULL
         AND "status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'));
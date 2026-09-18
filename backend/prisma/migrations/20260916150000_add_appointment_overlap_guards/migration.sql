-- Composite indexes matching the overlap queries assertSlotAvailable()
-- actually runs (customer-scoped and staff-scoped, ordered by start time).
-- Mirrors the @@index([user_id, appointment_date]) / @@index([staff_id,
-- appointment_date]) additions in schema.prisma.
CREATE INDEX "appointments_user_id_appointment_date_idx"
  ON "appointments" ("user_id", "appointment_date");

CREATE INDEX "appointments_staff_id_appointment_date_idx"
  ON "appointments" ("staff_id", "appointment_date");

-- Defense-in-depth beyond the app-level check: a partial unique index
-- can't express "overlapping ranges" (Postgres has no native range type
-- here, and duration varies per row), so it does NOT replace
-- assertSlotAvailable()'s interval-overlap logic — a customer could still
-- (in theory, absent the app check) book two DIFFERENT start times whose
-- intervals overlap, and this index wouldn't catch that. What it DOES
-- guarantee, at the database level, independent of any application code
-- path: the same customer can never hold two active bookings at the exact
-- same instant. That's precisely the shape of bug this migration is
-- responding to (same customerId, same startAt, two active rows) and it
-- stays true even if a future code path forgets to call
-- assertSlotAvailable() or a row is inserted by hand.
--
-- Cancelled/completed/no-show rows are intentionally excluded from the
-- WHERE clause — history (including a re-booked identical slot after a
-- cancellation) must never be blocked by this constraint.
CREATE UNIQUE INDEX "appointments_customer_active_start_unique"
  ON "appointments" ("user_id", "appointment_date")
  WHERE "status" IN ('PENDING', 'CONFIRMED');

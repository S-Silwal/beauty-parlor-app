-- Defense-in-depth beyond the app-level check (assertNoDuplicateServiceSameDay
-- in appointment.service.ts) — same reasoning as the sibling
-- appointments_customer_active_start_unique index from
-- 20260916150000_add_appointment_overlap_guards: this guarantees, at the
-- database level and independent of any application code path, that the
-- same customer can never hold two active (PENDING/CONFIRMED) bookings for
-- the same service on the same local salon calendar day — even if a future
-- code path forgets to call assertNoDuplicateServiceSameDay() or a row is
-- inserted by hand.
--
-- date_trunc('day', ...) on a TIMESTAMP (no time zone) column truncates the
-- stored wall-clock value directly, with no time zone conversion involved —
-- the exact same "local calendar day" the application computes from
-- appointment_date's own year/month/day components (see
-- assertNoDuplicateServiceSameDay and getAvailableSlots in
-- appointment.service.ts). Keeping both definitions of "same day" aligned
-- like this matters: if they ever disagreed, this index could reject a
-- booking the app-level check was willing to allow (or vice versa).
--
-- Deliberately NOT staff-scoped, matching the app-level check: any active
-- booking of this service on this day blocks a new one for this customer,
-- regardless of which staff member either booking uses. Cancelled/
-- completed/no-show rows are excluded from the WHERE clause so a re-booked
-- identical service after a cancellation is never blocked by this
-- constraint.
CREATE UNIQUE INDEX "appointments_customer_service_active_day_unique"
  ON "appointments" ("user_id", "service_id", (date_trunc('day', "appointment_date")))
  WHERE "status" IN ('PENDING', 'CONFIRMED');

-- Speeds up assertNoDuplicateServiceSameDay()'s query (customer + service,
-- scanned over a day's [gte, lte] range) beyond what the unique index above
-- covers on its own, since that index's exact date_trunc() equality match
-- doesn't serve a range scan the same way a plain composite index does.
-- Mirrors the appointments_user_id_appointment_date_idx /
-- appointments_staff_id_appointment_date_idx additions from
-- 20260916150000_add_appointment_overlap_guards.
CREATE INDEX "appointments_user_id_service_id_appointment_date_idx"
  ON "appointments" ("user_id", "service_id", "appointment_date");

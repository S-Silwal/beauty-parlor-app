-- Adds the two appointment-lifecycle states the product needs to actually
-- run a salon day: CHECKED_IN (customer has arrived, service not yet marked
-- complete) and NO_SHOW (the appointment time passed with the customer never
-- checked in). Previously the enum only had PENDING/CONFIRMED/COMPLETED/
-- CANCELLED/RESCHEDULED, so a no-show could not be recorded at all.
--
-- Postgres requires each new enum value to be committed before it can be
-- referenced by other statements, so these run as their own statements and
-- are not used later in this same file.
ALTER TYPE "AppointmentStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_SHOW';

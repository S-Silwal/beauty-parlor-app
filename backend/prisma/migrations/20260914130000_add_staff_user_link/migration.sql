-- Links a Staff row to the User account that logs in as that staff member.
-- Without this there was no way to determine which Staff record a logged-in
-- User with role STAFF corresponds to, so "staff" routes (isStaffOrAdmin)
-- could never actually be scoped to "their own" appointments/change-requests
-- -- every staff account saw exactly what admin saw. See
-- StaffService.resolveCallerStaffId() for how this column is used.
ALTER TABLE "staff" ADD COLUMN "user_id" TEXT;

CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

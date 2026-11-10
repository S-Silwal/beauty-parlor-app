-- CreateIndex
CREATE INDEX "appointments_user_id_service_id_appointment_local_day_idx" ON "appointments"("user_id", "service_id", "appointment_local_day");

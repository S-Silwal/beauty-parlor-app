-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('EDIT', 'CANCEL');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "appointment_change_requests" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ChangeRequestType" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_date" TIMESTAMP(3),
    "requested_staff_id" TEXT,
    "requested_service_id" TEXT,
    "customer_note" TEXT,
    "decline_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "appointment_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_change_requests_appointment_id_idx" ON "appointment_change_requests"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_change_requests_status_idx" ON "appointment_change_requests"("status");

-- AddForeignKey
ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_requested_staff_id_fkey" FOREIGN KEY ("requested_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_requested_service_id_fkey" FOREIGN KEY ("requested_service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;


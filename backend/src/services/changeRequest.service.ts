// src/services/changeRequest.service.ts
import { prisma } from "../config/database";
import { AppointmentStatus, ChangeRequestType, Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import {
  assertSlotAvailable,
  runSerializable,
  isInsideCutoff,
  SELF_SERVICE_CUTOFF_HOURS,
} from "./appointment.service";
import { emitBookingUpdated, emitChangeRequestCreated, emitChangeRequestResolved } from "../socket";
import {
  notifyBookingCancelled,
  notifyBookingRescheduled,
  notifyChangeRequestDeclined,
} from "../notifications/notification.service";

// Only an upcoming, still-live booking can have a change requested against
// it — a completed or already-cancelled booking has nothing left to change.
const EDITABLE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

const REQUEST_INCLUDE = {
  appointment: {
    include: {
      service: true,
      staff: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  requestedStaff: true,
  requestedService: true,
} satisfies Prisma.AppointmentChangeRequestInclude;

export class ChangeRequestService {
  // ── Customer: request an edit (date/time, staff, and/or service) ───────────
  static async requestEdit(
    userId: string,
    appointmentId: string,
    data: { requested_date?: Date; requested_staff_id?: string; requested_service_id?: string }
  ) {
    const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId } });
    if (!appointment) throw new AppError("Appointment not found", 404);
    if (appointment.user_id !== userId) {
      throw new AppError("You can only edit your own appointments", 403);
    }
    if (!EDITABLE_STATUSES.includes(appointment.status)) {
      throw new AppError("Only upcoming (pending or confirmed) bookings can be edited", 409);
    }

    // This flow exists only for what the direct PATCH /:id/reschedule
    // endpoint can't do: (a) an appointment too close to its start time for
    // self-service (see isInsideCutoff), where it needs an admin's manual
    // OK, or (b) changing the service — reschedule only ever touches
    // date/staff/notes. Outside the cutoff and without a service change,
    // there's nothing here an admin approval adds — the customer should
    // just reschedule it themselves instantly.
    const changingService =
      !!data.requested_service_id && data.requested_service_id !== appointment.service_id;
    if (!isInsideCutoff(appointment.appointment_date) && !changingService) {
      throw new AppError(
        `This booking is still more than ${SELF_SERVICE_CUTOFF_HOURS} hour` +
        `${SELF_SERVICE_CUTOFF_HOURS === 1 ? "" : "s"} away — reschedule the date, time or staff ` +
        `yourself instantly instead of waiting for approval. (Changing the service still needs ` +
        `approval regardless of timing.)`,
        409
      );
    }

    // One live request at a time per booking — stops a customer from
    // stacking conflicting requests on the same appointment.
    const existingPending = await prisma.appointmentChangeRequest.findFirst({
      where: { appointment_id: appointmentId, status: "PENDING" },
    });
    if (existingPending) {
      throw new AppError("You already have a pending request for this booking", 409);
    }

    // Resolve what the slot would actually look like if this were applied,
    // so the conflict check below is against the real proposed window —
    // any field the customer didn't touch falls back to the current value.
    const newDate = data.requested_date ?? appointment.appointment_date;
    const staffId =
      data.requested_staff_id !== undefined ? data.requested_staff_id : appointment.staff_id;

    let duration = appointment.duration;
    if (changingService) {
      const service = await prisma.service.findUnique({ where: { id: data.requested_service_id } });
      if (!service) throw new AppError("Service not found", 404);
      duration = service.duration;
    }

    const newStart = new Date(newDate);
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

    // Same overlap rule (and the same Serializable-transaction guard against
    // a concurrent double-book) that booking/reschedule already use.
    await runSerializable(async (tx) => {
      await assertSlotAvailable(tx, {
        staffId,
        newStart,
        newEnd,
        excludeAppointmentId: appointmentId,
      });
    });

    const request = await prisma.appointmentChangeRequest.create({
      data: {
        appointment_id: appointmentId,
        user_id: userId,
        type: "EDIT" as ChangeRequestType,
        requested_date: data.requested_date,
        requested_staff_id: data.requested_staff_id,
        requested_service_id: data.requested_service_id,
      },
      include: REQUEST_INCLUDE,
    });

    emitChangeRequestCreated(request);
    return request;
  }

  // ── Customer: request a cancellation ────────────────────────────────────────
  static async requestCancel(userId: string, appointmentId: string, reason?: string) {
    const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId } });
    if (!appointment) throw new AppError("Appointment not found", 404);
    if (appointment.user_id !== userId) {
      throw new AppError("You can only cancel your own appointments", 403);
    }
    if (!EDITABLE_STATUSES.includes(appointment.status)) {
      throw new AppError("Only upcoming (pending or confirmed) bookings can be cancelled", 409);
    }

    // Outside the cutoff, DELETE /:id/cancel does this instantly with no
    // approval needed — routing the same outcome through an admin here too
    // would just be a slower, bypassable duplicate of that endpoint. This
    // flow is for the one case self-service can't cover: too close to the
    // start time to cancel directly.
    if (!isInsideCutoff(appointment.appointment_date)) {
      throw new AppError(
        `This booking is still more than ${SELF_SERVICE_CUTOFF_HOURS} hour` +
        `${SELF_SERVICE_CUTOFF_HOURS === 1 ? "" : "s"} away — cancel it yourself instantly instead ` +
        `of waiting for approval.`,
        409
      );
    }

    const existingPending = await prisma.appointmentChangeRequest.findFirst({
      where: { appointment_id: appointmentId, status: "PENDING" },
    });
    if (existingPending) {
      throw new AppError("You already have a pending request for this booking", 409);
    }

    const request = await prisma.appointmentChangeRequest.create({
      data: {
        appointment_id: appointmentId,
        user_id: userId,
        type: "CANCEL" as ChangeRequestType,
        customer_note: reason,
      },
      include: REQUEST_INCLUDE,
    });

    emitChangeRequestCreated(request);
    return request;
  }

  // ── Customer: their own requests (so the dashboard knows a booking
  //    already has one in flight, and can show past decisions) ───────────────
  static async getMyRequests(userId: string) {
    return prisma.appointmentChangeRequest.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      include: { requestedStaff: true, requestedService: true },
    });
  }

  // ── Admin: pending requests, oldest first ───────────────────────────────────
  // A STAFF caller's `staffId` (from StaffService.resolveCallerStaffId) scopes
  // this to only requests against their own assigned appointments — ADMIN
  // passes undefined and sees everything, as before.
  static async getPendingRequests(options?: { staffId?: string }) {
    return prisma.appointmentChangeRequest.findMany({
      where: {
        status: "PENDING",
        ...(options?.staffId && { appointment: { staff_id: options.staffId } }),
      },
      orderBy: { created_at: "asc" },
      include: REQUEST_INCLUDE,
    });
  }

  // ── Admin: approve or decline a pending request ─────────────────────────────
  static async resolve(
    requestId: string,
    decision: "APPROVED" | "DECLINED",
    declineReason?: string,
    callerStaffId?: string
  ) {
    const request = await prisma.appointmentChangeRequest.findUnique({
      where: { id: requestId },
      include: { appointment: true },
    });
    if (!request) throw new AppError("Change request not found", 404);
    if (callerStaffId && request.appointment.staff_id !== callerStaffId) {
      throw new AppError("You can only resolve requests for appointments assigned to you", 403);
    }
    if (request.status !== "PENDING") {
      throw new AppError("This request has already been resolved", 409);
    }

    if (decision === "DECLINED") {
      const updated = await prisma.appointmentChangeRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED", decline_reason: declineReason, resolved_at: new Date() },
        include: REQUEST_INCLUDE,
      });
      emitChangeRequestResolved(updated);
      notifyChangeRequestDeclined(updated.appointment_id, updated.type, declineReason).catch((err) =>
        console.error("Notification error:", err)
      );
      return updated;
    }

    // ── APPROVED ───────────────────────────────────────────────────────────
    if (request.type === "CANCEL") {
      const updatedAppointment = await prisma.appointment.update({
        where: { id: request.appointment_id },
        data: { status: "CANCELLED" as AppointmentStatus },
        include: { service: true, staff: true },
      });
      const updatedRequest = await prisma.appointmentChangeRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", resolved_at: new Date() },
        include: REQUEST_INCLUDE,
      });

      emitBookingUpdated(updatedAppointment);
      emitChangeRequestResolved(updatedRequest);
      notifyBookingCancelled(request.appointment_id).catch((err) =>
        console.error("Notification error:", err)
      );
      return updatedRequest;
    }

    // EDIT — re-check the slot right now: it may have filled up between the
    // customer's request and this approval.
    const appointment = request.appointment;
    const newDate = request.requested_date ?? appointment.appointment_date;
    const staffId =
      request.requested_staff_id !== null ? request.requested_staff_id : appointment.staff_id;

    let duration = appointment.duration;
    let totalPrice = appointment.total_price;
    if (request.requested_service_id && request.requested_service_id !== appointment.service_id) {
      const service = await prisma.service.findUnique({ where: { id: request.requested_service_id } });
      if (!service) throw new AppError("Service not found", 404);
      duration = service.duration;
      totalPrice = service.price;
    }

    const newStart = new Date(newDate);
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);
    const oldDate = appointment.appointment_date;

    try {
      const updatedAppointment = await runSerializable(async (tx) => {
        await assertSlotAvailable(tx, {
          staffId,
          newStart,
          newEnd,
          excludeAppointmentId: appointment.id,
        });

        return tx.appointment.update({
          where: { id: appointment.id },
          data: {
            appointment_date: newDate,
            staff_id: staffId,
            service_id: request.requested_service_id ?? appointment.service_id,
            duration,
            total_price: totalPrice,
            status: "RESCHEDULED" as AppointmentStatus,
          },
          include: { service: true, staff: true },
        });
      });

      const updatedRequest = await prisma.appointmentChangeRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", resolved_at: new Date() },
        include: REQUEST_INCLUDE,
      });

      emitBookingUpdated(updatedAppointment);
      emitChangeRequestResolved(updatedRequest);
      notifyBookingRescheduled(appointment.id, oldDate).catch((err) =>
        console.error("Notification error:", err)
      );
      return updatedRequest;
    } catch (err) {
      // The slot was taken by something else in the meantime — this request
      // can no longer be approved as-is. Auto-decline rather than leaving it
      // stuck PENDING against a slot that's gone, and tell both sides why.
      if (err instanceof AppError && err.statusCode === 409) {
        const reason = `Requested slot is no longer available: ${err.message}`;
        const invalidated = await prisma.appointmentChangeRequest.update({
          where: { id: requestId },
          data: { status: "DECLINED", decline_reason: reason, resolved_at: new Date() },
          include: REQUEST_INCLUDE,
        });
        emitChangeRequestResolved(invalidated);
        notifyChangeRequestDeclined(invalidated.appointment_id, invalidated.type, reason).catch((e) =>
          console.error("Notification error:", e)
        );
        throw new AppError(
          `That slot is no longer available, so this request was automatically declined: ${err.message}`,
          409
        );
      }
      throw err;
    }
  }
}

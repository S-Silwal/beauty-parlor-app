// src/services/changeRequest.service.ts
import { prisma } from "../config/database";
import { AppointmentStatus, ChangeRequestStatus, ChangeRequestType, Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import {
  assertSlotAvailable,
  assertNoDuplicateServiceSameDay,
  runSerializable,
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

    // Every customer-initiated edit goes through this request/approval flow
    // and NEVER touches the live booking directly — regardless of how far
    // away the appointment is. The direct PATCH /:id/reschedule endpoint
    // still exists in this service (e.g. for a possible future "admin
    // reschedules directly from Bookings" action) but the customer
    // dashboard no longer calls it for self-service edits.
    const changingService =
      !!data.requested_service_id && data.requested_service_id !== appointment.service_id;

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
    const effectiveServiceId = data.requested_service_id ?? appointment.service_id;

    // Same overlap rule (and the same Serializable-transaction guard against
    // a concurrent double-book) that booking/reschedule already use, plus the
    // same-service-same-day duplicate guard — see
    // assertNoDuplicateServiceSameDay()'s comment in appointment.service.ts.
    // This is only a pre-check so the customer gets an immediate, accurate
    // error instead of submitting a request that's certain to be declined —
    // resolve() below re-runs both checks at approval time, which is what
    // actually guards the write (the slot/day can fill up while this request
    // sits PENDING).
    await runSerializable(async (tx) => {
      await assertNoDuplicateServiceSameDay(tx, {
        customerId:            appointment.user_id,
        serviceId:             effectiveServiceId,
        date:                  newStart,
        excludeAppointmentId:  appointmentId,
      });
      await assertSlotAvailable(tx, {
        customerId: appointment.user_id,
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

    // Cancelling, like editing, always goes through admin approval now —
    // the direct DELETE /:id/cancel endpoint still exists in this service
    // but the customer dashboard no longer calls it for self-service
    // cancels; the live booking must stay on its original slot/status
    // until an admin accepts this request.
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
    const effectiveServiceId = request.requested_service_id ?? appointment.service_id;

    try {
      const updatedAppointment = await runSerializable(async (tx) => {
        // Authoritative re-check at approval time — the slot/day can have
        // filled up while this request sat PENDING. See
        // assertNoDuplicateServiceSameDay()'s comment in appointment.service.ts;
        // this is also what stops an admin from approving a second edit request
        // into a same-service-same-day duplicate ("Admin should not be able to
        // confirm a second copy either").
        await assertNoDuplicateServiceSameDay(tx, {
          customerId:            appointment.user_id,
          serviceId:             effectiveServiceId,
          date:                  newStart,
          excludeAppointmentId:  appointment.id,
        });
        await assertSlotAvailable(tx, {
          customerId: appointment.user_id,
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
            // Approving an edit request is itself an admin affirmation of
            // the booking — it becomes/stays CONFIRMED, never RESCHEDULED.
            // RESCHEDULED is reserved for a direct admin reschedule from
            // the Bookings tab (a separate code path from this
            // request/approval flow) — writing it here would make the
            // customer dashboard's Upcoming/History split bury a booking
            // that is, from the customer's point of view, still perfectly
            // upcoming, just at its newly-approved time.
            status: "CONFIRMED" as AppointmentStatus,
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

  // ── Customer: withdraw their own still-pending request ─────────────────
  // Only a PENDING request can be withdrawn — once an admin has already
  // approved or declined it, the decision stands. Nothing about the
  // appointment itself changes (it was never touched while the request was
  // pending), so there's nothing to undo there.
  static async withdraw(userId: string, requestId: string) {
    const request = await prisma.appointmentChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new AppError("Change request not found", 404);
    if (request.user_id !== userId) {
      throw new AppError("You can only withdraw your own requests", 403);
    }
    if (request.status !== "PENDING") {
      throw new AppError("This request has already been resolved", 409);
    }

    const updated = await prisma.appointmentChangeRequest.update({
      where: { id: requestId },
      data: { status: "WITHDRAWN" as ChangeRequestStatus, resolved_at: new Date() },
      include: REQUEST_INCLUDE,
    });

    // Reuse the same broadcast approve/decline already use — the admin
    // panel's pending list and this customer's own other tabs/devices both
    // already refetch on it, so a withdrawn request disappears from the
    // pending list with no new wiring on either side.
    emitChangeRequestResolved(updated);
    return updated;
  }
}

// src/services/appointment.service.ts
import { prisma } from "../config/database";
import { AppointmentStatus, PaymentStatus, Prisma } from "@prisma/client";
import { emitBookingCreated, emitBookingUpdated } from "../socket";
import { AppError } from "../utils/AppError";
import { PageParams, PaginatedResult } from "../utils/pagination";
import {
  notifyBookingPlaced,
  notifyBookingConfirmed,
  notifyBookingCompleted,
  notifyBookingCancelled,
  notifyBookingRescheduled,
} from '../notifications/notification.service';
import { recordAuditLog, diffFields, AuditActor } from './adminAuditLog.service';

type Tx = Prisma.TransactionClient;

// Minimum notice a customer must give to cancel or reschedule themselves,
// in hours. Configurable via env so this can be tuned per-business without
// a code change; defaults to 2 hours. Staff/admin are never subject to this
// — they act through updateAppointmentStatus() (the /:id/status route),
// which is a separate code path with no cutoff check, by design.
export const SELF_SERVICE_CUTOFF_HOURS = Number(process.env.CANCELLATION_CUTOFF_HOURS) || 2;
export const SELF_SERVICE_CUTOFF_MS = SELF_SERVICE_CUTOFF_HOURS * 60 * 60 * 1000;

/**
 * Blocks a customer-initiated direct cancel/reschedule when the appointment
 * starts too soon. Throws the same 409 AppError shape used elsewhere in
 * this file so controllers don't need to know this exists. (The
 * change-request flow uses isInsideCutoff() below instead — inside this
 * same window is exactly when it becomes available.)
 */
export function assertOutsideCutoff(appointmentDate: Date, action: "cancel" | "reschedule") {
  const msUntilStart = appointmentDate.getTime() - Date.now();
  if (msUntilStart < SELF_SERVICE_CUTOFF_MS) {
    throw new AppError(
      `Appointments can only be ${action}ed at least ` +
      `${SELF_SERVICE_CUTOFF_HOURS} hour${SELF_SERVICE_CUTOFF_HOURS === 1 ? "" : "s"} in advance. ` +
      `Please submit a change request instead so our staff can ${action} this booking for you.`,
      409
    );
  }
}

/**
 * True when a customer can no longer use the direct self-service
 * cancel/reschedule endpoints (see assertOutsideCutoff) because the
 * appointment starts too soon. This is exactly the gap the change-request/
 * admin-approval flow exists to cover — see changeRequest.service.ts.
 */
export function isInsideCutoff(appointmentDate: Date): boolean {
  return appointmentDate.getTime() - Date.now() < SELF_SERVICE_CUTOFF_MS;
}

function endOfBooking(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + (durationMinutes || 30) * 60 * 1000);
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Checks BOTH staff_id overlap AND customer overlap against active
 * (PENDING/CONFIRMED) bookings, using startAt/endAt interval math (not
 * date-only). Must run inside the same transaction as the write that
 * follows it — see runSerializable() below for why.
 *
 * A booking with no staff assigned only conflicts with other unassigned
 * bookings (it represents a generic capacity slot, not a specific person),
 * mirroring how getAvailableSlots() treats staff_id.
 *
 * The customer check runs regardless of service or staff — a customer
 * can't sit in two chairs at once, even for two *different* services with
 * two *different* staff members. This used to be entirely missing: the
 * only check here was staff-scoped, so the same customer could double-book
 * themselves across two staff members (or two unassigned slots) at the
 * exact same time and both requests would pass. That's the root cause of
 * the double-booking bug — see PR description.
 */
export async function assertSlotAvailable(
  tx: Tx,
  params: {
    customerId: string;
    staffId?: string | null;
    newStart: Date;
    newEnd: Date;
    excludeAppointmentId?: string;
  }
) {
  const { customerId, staffId, newStart, newEnd, excludeAppointmentId } = params;

  // ── 1. Staff overlap — a staff member cannot do two services at once. ──
  const staffConflicts = await tx.appointment.findMany({
    where: {
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      status: { in: ["PENDING", "CONFIRMED"] },
      staff_id: staffId ?? null,
      appointment_date: { lt: newEnd },
    },
    select: { appointment_date: true, duration: true },
  });

  for (const booking of staffConflicts) {
    const existingStart = new Date(booking.appointment_date);
    const existingEnd = endOfBooking(existingStart, booking.duration);

    if (rangesOverlap(newStart, newEnd, existingStart, existingEnd)) {
      const availableFrom = existingEnd.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      });
      throw new AppError(
        staffId
          ? `This staff member is booked until ${availableFrom}. Please select a time at or after ${availableFrom}.`
          : `This time slot is unavailable until ${availableFrom}. Please choose a different time.`,
        409,
        "SLOT_UNAVAILABLE"
      );
    }
  }

  // ── 2. Customer overlap — any service, any staff (or none). ──
  const customerConflicts = await tx.appointment.findMany({
    where: {
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      status: { in: ["PENDING", "CONFIRMED"] },
      user_id: customerId,
      appointment_date: { lt: newEnd },
    },
    select: { id: true, appointment_date: true, duration: true },
  });

  for (const booking of customerConflicts) {
    const existingStart = new Date(booking.appointment_date);
    const existingEnd = endOfBooking(existingStart, booking.duration);

    if (rangesOverlap(newStart, newEnd, existingStart, existingEnd)) {
      throw new AppError(
        "You already have an appointment at this time.",
        409,
        "CUSTOMER_TIME_CONFLICT",
        booking.id
      );
    }
  }
}

/**
 * Rejects a new/rescheduled booking when the SAME customer already has an
 * active (PENDING/CONFIRMED) booking for the SAME service on the SAME
 * local salon calendar day — regardless of time of day. This is a
 * different rule from assertSlotAvailable() above: two bookings for
 * "Anti-Ageing Facial" at 12:30pm and 2:30pm the same day don't overlap in
 * time at all, so the overlap check has nothing to say about them, but
 * they're still a duplicate booking a customer almost certainly made by
 * mistake (e.g. double-submitting from two tabs, or re-booking without
 * noticing an existing appointment further down the day).
 *
 * Matching intentionally ignores staff_id — ANY existing active booking of
 * this service on this day blocks a new one, even with a different staff
 * member selected. That's the stricter of two reasonable interpretations
 * (the looser one would scope the match to `staff_id: staffId ?? null` as
 * well, allowing "same service, different staff, same day"); simpler to
 * reason about and safer against the exact bug this was written to fix, so
 * it's the one implemented here. Add that field back to the `where` below
 * if the looser behavior turns out to be what's actually wanted.
 *
 * Must run inside the same locked (lockBookingResources), Serializable
 * transaction as the write that follows it. The lock is always taken on
 * `customer:${customerId}` regardless of which staff member either request
 * used, so two concurrent requests for the same customer+service+day always
 * serialize on that shared key even when their staff_id values differ —
 * see lockBookingResources()'s comment for the full reasoning.
 */
export async function assertNoDuplicateServiceSameDay(
  tx: Tx,
  params: {
    customerId: string;
    serviceId: string;
    date: Date;
    excludeAppointmentId?: string;
  }
) {
  const { customerId, serviceId, date, excludeAppointmentId } = params;

  // Local-calendar-day bounds, built from the Date's own y/m/d components
  // (never from ISO/UTC math) — same convention getAvailableSlots() uses
  // for the identical reason: a UTC-based day window silently checks the
  // wrong day for any customer/server west of UTC in the evening.
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const dayEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const existing = await tx.appointment.findFirst({
    where: {
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      status:           { in: ["PENDING", "CONFIRMED"] },
      user_id:           customerId,
      service_id:        serviceId,
      appointment_date:  { gte: dayStart, lte: dayEnd },
    },
    select: { id: true, appointment_date: true },
  });

  if (existing) {
    throw new AppError(
      "You already have this service booked on this day. Please choose a different service, or a different day.",
      409,
      "DUPLICATE_SERVICE_SAME_DAY",
      existing.id
    );
  }
}

const SERIALIZATION_RETRY_LIMIT = 3;

/**
 * Runs `fn` inside a Serializable transaction, retrying on a genuine write
 * conflict. The overlap check (assertSlotAvailable) and the appointment
 * create/update MUST happen inside this one transaction — checking and
 * writing as two separate statements (as this file used to) lets two
 * concurrent requests both pass the check and double-book the same slot.
 * Serializable isolation makes Postgres abort one side of a real conflict
 * (error P2034) instead of silently allowing it.
 */
export async function runSerializable<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_LIMIT; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err: any) {
      if (err.code === 'P2034' && attempt < SERIALIZATION_RETRY_LIMIT) continue;
      if (err.code === 'P2034') {
        throw new AppError("This time slot was just booked by someone else. Please choose a different time.", 409);
      }
      throw err;
    }
  }
  /* istanbul ignore next — unreachable, loop always returns or throws */
  throw new AppError("Failed to schedule appointment", 500);
}

// Serializable isolation is supposed to make Postgres abort one side of any
// genuine conflict at commit time (see runSerializable()'s comment) — but
// that relies on Postgres's predicate-lock machinery actually recognizing
// the two transactions' read/write sets as conflicting. In practice, a
// customer-level race across two *different* staff members (each request
// touches a different staff_id, so the only shared predicate is
// user_id = customerId) has been observed to slip past that detection:
// both transactions' assertSlotAvailable() reads can complete before
// either has written its row, so neither sees the other and both proceed
// to create an appointment — exactly the double-booking this file exists
// to prevent. Rather than trust predicate-lock detection for this shape of
// conflict, take an explicit lock on the resources the check-then-write is
// actually protecting (the customer, and the staff member if one was
// selected) before running the check. The second transaction then
// genuinely blocks here until the first commits or rolls back, and — since
// the lock is transaction-scoped (`_xact_lock`, released automatically at
// commit/rollback) — sees the first transaction's committed row once it
// resumes, so assertSlotAvailable() correctly returns 409 instead of both
// requests racing each other to 201. Keys are sorted before locking so two
// requests that need the same pair of locks (e.g. rescheduling into a slot
// that also touches another appointment's staff) always acquire them in
// the same order, which rules out a lock-ordering deadlock between them.
async function lockBookingResources(
  tx: Tx,
  customerId: string,
  staffId?: string | null
): Promise<void> {
  const resources = [
    `customer:${customerId}`,
    ...(staffId ? [`staff:${staffId}`] : []),
  ].sort();

  for (const resource of resources) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resource}))`;
  }
}

export class AppointmentService {

  // `pagination` is optional and opt-in (see utils/pagination.ts) — omit it
  // and this returns the full array exactly as before, so every existing
  // caller (the public booking page's service list) is unaffected.
  static async getAllServices(pagination?: PageParams): Promise<any[] | PaginatedResult<any>> {
    const query = {
      where: { isActive: true },
      orderBy: { name: "asc" as const },
      select: {
        id: true, name: true, description: true,
        duration: true, price: true, category: true, is_popular: true,
      },
    };

    if (!pagination) {
      return await prisma.service.findMany(query);
    }

    const [items, total] = await Promise.all([
      prisma.service.findMany({ ...query, skip: pagination.skip, take: pagination.take }),
      prisma.service.count({ where: query.where }),
    ]);
    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  static async getAllStaff(pagination?: PageParams): Promise<any[] | PaginatedResult<any>> {
    const query = {
      where: { isActive: true },
      orderBy: { name: "asc" as const },
      select: { id: true, name: true, specialization: true },
    };

    if (!pagination) {
      return await prisma.staff.findMany(query);
    }

    const [items, total] = await Promise.all([
      prisma.staff.findMany({ ...query, skip: pagination.skip, take: pagination.take }),
      prisma.staff.count({ where: query.where }),
    ]);
    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  // ── Available slots ────────────────────────────────────────────────────────
  static async getAvailableSlots(data: {
    date:        string;
    service_id?: string;
    staff_id?:   string;
  }) {
    // Build the day window from the "YYYY-MM-DD" parts directly, in LOCAL
    // time — never via `new Date(data.date)`. That string is parsed as UTC
    // midnight, and re-zeroing its hours with setHours() then snaps it to
    // local midnight of whatever calendar day that UTC instant falls on,
    // which in a negative-UTC-offset timezone is the day BEFORE the one
    // requested. That silently queried the wrong day's bookings for
    // conflict-checking (correct only by coincidence in UTC-based zones).
    const [y, m, d] = data.date.split('-').map(Number);
    if (!y || !m || !d) throw new AppError("Invalid date format", 400);

    const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0);
    const endOfDay   = new Date(y, m - 1, d, 23, 59, 59, 999);

    // ✅ Get the duration of the service being requested
    // This lets us check whether the NEW booking would overlap with existing ones
    let requestedDuration = 30; // fallback
    if (data.service_id) {
      const service = await prisma.service.findUnique({
        where:  { id: data.service_id },
        select: { duration: true },
      });
      if (service) requestedDuration = service.duration;
    }

    // Fetch all active bookings for this staff on this date
    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        appointment_date: { gte: startOfDay, lte: endOfDay },
        status:           { in: ["PENDING", "CONFIRMED"] },
        ...(data.staff_id && { staff_id: data.staff_id }),
      },
      select: {
        appointment_date: true,
        duration:         true,
      },
    });

    // ── Working hours for this staff/day ─────────────────────────────────────
    // StaffAvailability existed in schema.prisma but nothing ever queried it
    // — every staff member was treated as available 9:00–19:00, every day,
    // with no way to represent a day off, a half day, or a break. See
    // "StaffAvailability model exists... dead schema" in the hardening
    // audit. Now, when a specific staff member is requested:
    //   - non-blocked rows for that staff/date define custom WORKING
    //     windows, replacing the flat default entirely (an explicit
    //     schedule should win over the fallback)
    //   - blocked rows (is_blocked = true) carve time OUT of whatever
    //     working window is in effect — a lunch break, a partial day off
    //   - a staff member with no rows at all for that date falls back to
    //     the original flat 9:00–19:00 default, so every staff member who's
    //     never had availability configured behaves exactly as before.
    // With no staff_id (browsing "any staff" availability), there's no
    // single schedule to look up, so the flat default is used as-is.
    let workingWindows: { start: string; end: string }[] = [{ start: "09:00", end: "19:00" }];
    let blockedWindows: { start: string; end: string }[] = [];

    if (data.staff_id) {
      const availabilityRows = await prisma.staffAvailability.findMany({
        where: { staff_id: data.staff_id, date: { gte: startOfDay, lte: endOfDay } },
      });

      const customWindows = availabilityRows.filter((r) => !r.is_blocked);
      if (customWindows.length > 0) {
        workingWindows = customWindows.map((r) => ({ start: r.start_time, end: r.end_time }));
      }
      blockedWindows = availabilityRows
        .filter((r) => r.is_blocked)
        .map((r) => ({ start: r.start_time, end: r.end_time }));
    }

    // Generate 30-min slot candidates across the working window(s) only.
    const slots: string[] = [];
    for (const window of workingWindows) {
      const [startH, startM] = window.start.split(":").map(Number);
      const [endH, endM]     = window.end.split(":").map(Number);
      let cursorMinutes = startH * 60 + startM;
      const endMinutes  = endH * 60 + endM;
      while (cursorMinutes < endMinutes) {
        const h = Math.floor(cursorMinutes / 60);
        const m = cursorMinutes % 60;
        slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        cursorMinutes += 30;
      }
    }

    const now = new Date();

    const availableSlots = slots.filter((slotTime) => {
      const slotStart = new Date(`${data.date}T${slotTime}:00`);

      // Reject past slots
      if (slotStart <= now) return false;

      // ✅ End time of the NEW booking if placed at this slot
      const slotEnd = new Date(
        slotStart.getTime() + requestedDuration * 60 * 1000
      );

      // Reject slots that fall inside a blocked (time-off/break) window
      const isBlocked = blockedWindows.some((block) => {
        const blockStart = new Date(`${data.date}T${block.start}:00`);
        const blockEnd   = new Date(`${data.date}T${block.end}:00`);
        return slotStart < blockEnd && slotEnd > blockStart;
      });
      if (isBlocked) return false;

      // ✅ Overlap check:
      // A slot is unavailable if the new booking (slotStart → slotEnd)
      // overlaps with ANY existing booking (existingStart → existingEnd)
      //
      // Overlap condition: newStart < existingEnd AND newEnd > existingStart
      //
      // Example: Staff booked 9:00–10:00 (60 min)
      //   Slot 9:00 → newEnd 10:00: 9:00 < 10:00 ✓ AND 10:00 > 9:00 ✓ → BLOCKED
      //   Slot 9:30 → newEnd 10:30: 9:30 < 10:00 ✓ AND 10:30 > 9:00 ✓ → BLOCKED
      //   Slot 9:45 → newEnd 10:45: 9:45 < 10:00 ✓ AND 10:45 > 9:00 ✓ → BLOCKED
      //   Slot 10:00 → newEnd 11:00: 10:00 < 10:00 ✗ → AVAILABLE ✅
      const hasConflict = bookedAppointments.some((booking) => {
        const existingStart = new Date(booking.appointment_date);
        const existingEnd   = new Date(
          existingStart.getTime() + (booking.duration || 30) * 60 * 1000
        );
        return slotStart < existingEnd && slotEnd > existingStart;
      });

      return !hasConflict;
    });

    return {
      date:        data.date,
      availableSlots,
      totalSlots:  slots.length,
      bookedCount: bookedAppointments.length,
    };
  }

  // ── Book appointment ───────────────────────────────────────────────────────
  // Returns `{ appointment, isNew }` — `isNew: false` means this call was an
  // idempotent replay of an already-existing booking (see the duplicate
  // guard below), not a fresh insert. The controller uses that to decide
  // 201 vs 200 and to avoid re-emitting sockets/notifications.
  static async bookAppointment(
    userId: string,
    data: {
      service_id:       string;
      staff_id?:        string;
      appointment_date: string | Date;
      notes?:           string;
    },
    idempotencyKey?: string
  ): Promise<{ appointment: any; isNew: boolean }> {
    const appointmentDate = new Date(data.appointment_date);
    if (isNaN(appointmentDate.getTime())) {
      throw new AppError("Invalid appointment date format", 400);
    }

    const service = await prisma.service.findUnique({
      where: { id: data.service_id },
    });
    if (!service) throw new AppError("Service not found", 404);

    const newStart = appointmentDate;
    const newEnd   = new Date(newStart.getTime() + service.duration * 60 * 1000);

    const includeShape = {
      service: true,
      staff:   true,
      user:    { select: { id: true, name: true, email: true } },
    } as const;

    // Overlap check + duplicate check + create all happen inside one
    // Serializable transaction — see runSerializable()'s comment for why
    // that's required (two concurrent identical POSTs must not both pass).
    const { appointment, isNew } = await runSerializable(async (tx) => {
      // Serialize all booking attempts involving this customer (and this
      // staff member, if one was selected) — see lockBookingResources()'s
      // comment for why this is needed on top of Serializable isolation.
      await lockBookingResources(tx, userId, data.staff_id);

      // Exact-duplicate guard: same customer + same service + same start.
      // This is what a double-click / double-submit (or a client blindly
      // retrying a request it isn't sure succeeded) actually produces.
      // Without this, two identical requests could both reach
      // assertSlotAvailable and — since that only ever compared staff_id —
      // both pass as long as they used different/no staff.
      const duplicate = await tx.appointment.findFirst({
        where: {
          user_id:          userId,
          service_id:       data.service_id,
          appointment_date: appointmentDate,
          status:           { in: ["PENDING", "CONFIRMED"] },
        },
        include: includeShape,
      });

      if (duplicate) {
        // A caller that sent an Idempotency-Key is explicitly asking "give
        // me the result of my earlier request if it already went through"
        // — that's a safe replay, not an error.
        if (idempotencyKey) {
          return { appointment: duplicate, isNew: false };
        }
        throw new AppError(
          "You already have this exact appointment booked.",
          409,
          "DUPLICATE_BOOKING",
          duplicate.id
        );
      }

      // Same-service-same-day guard — see assertNoDuplicateServiceSameDay()'s
      // comment. Runs after the exact-duplicate check above (so an exact
      // resubmit still gets the more specific DUPLICATE_BOOKING/idempotent-
      // replay handling) and before the time-overlap check below.
      await assertNoDuplicateServiceSameDay(tx, {
        customerId: userId,
        serviceId:  data.service_id,
        date:       appointmentDate,
      });

      await assertSlotAvailable(tx, { customerId: userId, staffId: data.staff_id, newStart, newEnd });

      const created = await tx.appointment.create({
        data: {
          user_id:          userId,
          service_id:       data.service_id,
          staff_id:         data.staff_id,
          appointment_date: appointmentDate,
          notes:            data.notes,
          duration:         service.duration,
          total_price:      service.price,
          status:           "PENDING" as AppointmentStatus,
          payment_status:   "PENDING" as PaymentStatus,
        },
        include: includeShape,
      });
      return { appointment: created, isNew: true };
    });

    if (isNew) {
      emitBookingCreated(appointment);

      // notifyBookingPlaced() sends the "we received your request" email + SMS
      // for a brand-new PENDING booking — this is NOT a confirmation. The
      // actual "Booking Confirmed" email (with the 24h reminder scheduled)
      // only fires later, from updateAppointmentStatus(), once an admin
      // really confirms it. Only fire this for a genuinely new row — an
      // idempotent replay must not re-send the placed email/SMS.
      notifyBookingPlaced(appointment.id).catch(err =>
        console.error("Notification error:", err)
      );
    }

    return { appointment, isNew };
  }

  // ── Get user appointments ──────────────────────────────────────────────────
  static async getUserAppointments(userId: string) {
    return await prisma.appointment.findMany({
      where:   { user_id: userId },
      include: { service: true, staff: true },
      orderBy: { appointment_date: "desc" },
    });
  }

  // ── Cancel appointment ─────────────────────────────────────────────────────
  static async cancelAppointment(appointmentId: string, userId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId },
    });
    if (!appointment)                    throw new AppError("Appointment not found", 404);
    if (appointment.user_id !== userId)  throw new AppError("You can only cancel your own appointments", 403);
    if (appointment.status === "CANCELLED") throw new AppError("This appointment is already cancelled", 409);
    if (appointment.status === "COMPLETED") throw new AppError("Completed appointments cannot be cancelled", 409);
    assertOutsideCutoff(appointment.appointment_date, "cancel");

    const updated = await prisma.appointment.update({
      where:   { id: appointmentId },
      data:    { status: "CANCELLED" as AppointmentStatus },
      include: { service: true, staff: true },
    });

    emitBookingUpdated(updated);
    notifyBookingCancelled(appointmentId).catch(err =>
      console.error("Notification error:", err)
    );

    return updated;
  }

  // ── Reschedule appointment ─────────────────────────────────────────────────
  static async rescheduleAppointment(
    appointmentId: string,
    userId: string,
    data: { appointment_date: Date; staff_id?: string; notes?: string }
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId },
    });
    if (!appointment)                    throw new AppError("Appointment not found", 404);
    if (appointment.user_id !== userId)  throw new AppError("You can only reschedule your own appointments", 403);
    if (appointment.status === "CANCELLED") throw new AppError("Cancelled appointments cannot be rescheduled", 409);
    if (appointment.status === "COMPLETED") throw new AppError("Completed appointments cannot be rescheduled", 409);
    assertOutsideCutoff(appointment.appointment_date, "reschedule");

    const oldDate  = appointment.appointment_date;
    const newStart = new Date(data.appointment_date);
    const newEnd   = new Date(newStart.getTime() + appointment.duration * 60 * 1000);
    const staffId  = data.staff_id ?? appointment.staff_id;

    // Overlap check + update happen inside one Serializable transaction —
    // see runSerializable()'s comment for why that's required.
    const updated = await runSerializable(async (tx) => {
      await lockBookingResources(tx, userId, staffId);
      // Moving this booking to a day where the customer already has this
      // same service (rescheduling never changes service_id, so it's always
      // appointment.service_id) is a duplicate under the same rule bookAppointment
      // enforces — see assertNoDuplicateServiceSameDay()'s comment.
      await assertNoDuplicateServiceSameDay(tx, {
        customerId:            userId,
        serviceId:             appointment.service_id,
        date:                  newStart,
        excludeAppointmentId:  appointmentId,
      });
      await assertSlotAvailable(tx, { customerId: userId, staffId, newStart, newEnd, excludeAppointmentId: appointmentId });

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          appointment_date: data.appointment_date,
          staff_id:         data.staff_id,
          notes:            data.notes,
          status:           "RESCHEDULED" as AppointmentStatus,
        },
        include: { service: true, staff: true },
      });
    });

    emitBookingUpdated(updated);
    notifyBookingRescheduled(appointmentId, oldDate).catch(err =>
      console.error("Notification error:", err)
    );

    return updated;
  }

  // ── All appointments (admin, or a staff caller scoped to their own) ────────
  // `staffId` is undefined for ADMIN (no filter — everything, as before) and
  // set to the caller's own Staff.id for a STAFF caller (see
  // StaffService.resolveCallerStaffId) — unassigned bookings (staff_id null)
  // are excluded from a staff view; those remain admin's to triage/assign.
  // `pagination` is optional and opt-in (see utils/pagination.ts) — omit it
  // and this returns the full array exactly as before (every current caller,
  // including the admin dashboard, does). This is the endpoint most likely
  // to actually need paging as the appointments table grows (H7).
  static async getAllAppointments(
    options?: { staffId?: string; pagination?: PageParams }
  ): Promise<any[] | PaginatedResult<any>> {
    const where = options?.staffId ? { staff_id: options.staffId } : undefined;
    const query = {
      where,
      include: {
        user:    { select: { id: true, name: true, email: true } },
        service: true,
        staff:   true,
      },
      orderBy: { appointment_date: "desc" as const },
    };

    if (!options?.pagination) {
      return await prisma.appointment.findMany(query);
    }

    const { pagination } = options;
    const [items, total] = await Promise.all([
      prisma.appointment.findMany({ ...query, skip: pagination.skip, take: pagination.take }),
      prisma.appointment.count({ where }),
    ]);
    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  // ── Update status (admin) ──────────────────────────────────────────────────
  // A booking's status is only ever "final" once it's COMPLETED, CANCELLED,
  // or NO_SHOW — nothing should silently move it out of one of those without
  // going back through a deliberate action (there isn't one today, and that's
  // fine: staff can still directly set a new status via this same method,
  // this guard only blocks a *stale* client re-sending an old status).
  static readonly TERMINAL_STATUSES: AppointmentStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

  static async updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus,
    callerStaffId?: string,
    actor?: AuditActor
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId },
    });
    if (!appointment) throw new AppError("Appointment not found", 404);
    if (callerStaffId && appointment.staff_id !== callerStaffId) {
      throw new AppError("You can only update appointments assigned to you", 403);
    }

    if (AppointmentService.TERMINAL_STATUSES.includes(appointment.status) && status !== appointment.status) {
      const label = appointment.status === "NO_SHOW" ? "no-show" : appointment.status.toLowerCase();
      throw new AppError(`Cannot change status of a ${label} appointment`, 409);
    }

    // A no-show can only be recorded once the appointment's start time has
    // actually passed — otherwise "no-show" is meaningless (the customer
    // still has time to arrive) and it's almost certainly a staff mis-click.
    if (status === "NO_SHOW" && appointment.appointment_date > new Date()) {
      throw new AppError("Cannot mark a future appointment as a no-show — wait until its start time has passed.", 409);
    }

    const appointmentIncludeShape = {
      service: true,
      staff:   true,
      user:    { select: { id: true, name: true, email: true } },
    } as const;

    // Confirming re-validates that no other active booking now overlaps
    // this one (same customer OR same staff) before flipping status — the
    // same check bookAppointment/rescheduleAppointment run at create time,
    // re-run here so a PENDING row created before this fix (or a staff
    // reassignment made after booking) can't silently graduate into a live
    // double-booking. Every other transition is a plain single-row update,
    // same as before — it never creates a second row.
    const updated = status === "CONFIRMED"
      ? await runSerializable(async (tx) => {
          const newStart = new Date(appointment.appointment_date);
          const newEnd   = new Date(newStart.getTime() + appointment.duration * 60 * 1000);
          await lockBookingResources(tx, appointment.user_id, appointment.staff_id);
          // Admin confirming one of two same-service-same-day duplicates (the
          // exact scenario this whole rule exists for — see
          // assertNoDuplicateServiceSameDay()'s comment) must not be allowed to
          // graduate a second copy to CONFIRMED just because it predates this
          // fix or slipped in some other way.
          await assertNoDuplicateServiceSameDay(tx, {
            customerId:           appointment.user_id,
            serviceId:            appointment.service_id,
            date:                 newStart,
            excludeAppointmentId: appointmentId,
          });
          await assertSlotAvailable(tx, {
            customerId:           appointment.user_id,
            staffId:              appointment.staff_id,
            newStart,
            newEnd,
            excludeAppointmentId: appointmentId,
          });
          return tx.appointment.update({
            where:   { id: appointmentId },
            data:    { status },
            include: appointmentIncludeShape,
          });
        })
      : await prisma.appointment.update({
          where:   { id: appointmentId },
          data:    { status },
          include: appointmentIncludeShape,
        });

    emitBookingUpdated(updated);

    if (status === "CANCELLED") {
      notifyBookingCancelled(appointmentId).catch(err => console.error("Notification error:", err));
    } else if (status === "CONFIRMED") {
      notifyBookingConfirmed(appointmentId).catch(err => console.error("Notification error:", err));
    }

    recordAuditLog({
      actor,
      action:     "APPOINTMENT_STATUS_UPDATE",
      entityType: "Appointment",
      entityId:   appointmentId,
      changes:    diffFields({ status: appointment.status }, { status }),
    }).catch(() => {}); // recordAuditLog never throws, but stay defensive

    console.log(`🔄 Booking ${appointmentId} updated to ${status}`);
    return updated;
  }

  // ── Complete with payment ──────────────────────────────────────────────────
  static async completeAppointmentWithPayment(appointmentId: string, callerStaffId?: string, actor?: AuditActor) {
    const appointment = await prisma.appointment.findFirst({
      where:   { id: appointmentId },
      include: { transaction: true },
    });
    if (!appointment)  throw new AppError("Appointment not found", 404);
    if (callerStaffId && appointment.staff_id !== callerStaffId) {
      throw new AppError("You can only update appointments assigned to you", 403);
    }
    if (appointment.status !== "CONFIRMED") {
      throw new AppError("Only confirmed appointments can be marked as completed", 409);
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status:         "COMPLETED" as AppointmentStatus,
        payment_status: "PAID"      as PaymentStatus,
      },
      include: {
        service: true,
        staff:   true,
        user:    { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.transaction.upsert({
      where:  { appointment_id: appointmentId },
      create: {
        appointment_id: appointmentId,
        user_id:        appointment.user_id,
        amount:         appointment.total_price,
        status:         "PAID" as PaymentStatus,
        payment_method: "cash",
      },
      update: { status: "PAID" as PaymentStatus },
    });

    emitBookingUpdated(updated);

    // Thank-you + review-request email/SMS only fires here, on the genuine
    // COMPLETED transition — never at booking creation or admin confirmation.
    notifyBookingCompleted(appointmentId).catch(err =>
      console.error("Notification error:", err)
    );

    recordAuditLog({
      actor,
      action:     "APPOINTMENT_STATUS_UPDATE",
      entityType: "Appointment",
      entityId:   appointmentId,
      changes:    diffFields(
        { status: appointment.status as AppointmentStatus, payment_status: appointment.payment_status as PaymentStatus },
        { status: "COMPLETED" as AppointmentStatus, payment_status: "PAID" as PaymentStatus }
      ),
    }).catch(() => {});

    console.log(`✅ Booking ${appointmentId} completed & payment recorded`);

    return updated;
  }

  // ── Revenue stats ──────────────────────────────────────────────────────────
  static async getRevenueStats() {
    const result = await prisma.appointment.aggregate({
      where:  { status: "COMPLETED", payment_status: "PAID" },
      _sum:   { total_price: true },
      _count: { id: true },
    });

    return {
      totalRevenue:          result._sum.total_price ?? 0,
      completedAndPaidCount: result._count.id,
    };
  }

  // ── Delete appointment ─────────────────────────────────────────────────────
  // This used to hard-delete the row — inconsistent with Service/Staff
  // (soft-deleted via isActive) and destructive on top of that: a hard
  // delete cascades onto Review (schema.prisma: onDelete: Cascade), so it
  // silently wiped a review along with the booking, and any future
  // no-show/history report would have a hole exactly where a deleted
  // appointment used to be. There's no live route wired to this method
  // today, but it's the kind of landmine that bites the moment someone
  // wires one up without re-reading this comment — so it's fixed at the
  // source: "delete" now means "cancel", same as every other cancellation
  // path in this file. See H-hardening "deleteAppointment() hard-deletes...".
  static async deleteAppointment(appointmentId: string, actor?: AuditActor) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId },
    });
    if (!appointment) throw new AppError("Appointment not found", 404);

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data:  { status: "CANCELLED" as AppointmentStatus },
    });

    recordAuditLog({
      actor,
      action:     "APPOINTMENT_STATUS_UPDATE",
      entityType: "Appointment",
      entityId:   appointmentId,
      changes:    diffFields({ status: appointment.status }, { status: "CANCELLED" }),
    }).catch(() => {});

    return updated;
  }
}
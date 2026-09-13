// src/services/appointment.service.ts
import { prisma } from "../config/database";
import { AppointmentStatus, PaymentStatus, Prisma } from "@prisma/client";
import { emitBookingCreated, emitBookingUpdated } from "../socket";
import { AppError } from "../utils/AppError";
import {
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyBookingRescheduled,
} from '../notifications/notification.service';

type Tx = Prisma.TransactionClient;

/**
 * Checks staff_id + time-range overlap against active (PENDING/CONFIRMED)
 * bookings. Must run inside the same transaction as the write that follows
 * it — see runSerializable() below for why.
 *
 * A booking with no staff assigned only conflicts with other unassigned
 * bookings (it represents a generic capacity slot, not a specific person),
 * mirroring how getAvailableSlots() treats staff_id.
 */
export async function assertSlotAvailable(
  tx: Tx,
  params: { staffId?: string | null; newStart: Date; newEnd: Date; excludeAppointmentId?: string }
) {
  const { staffId, newStart, newEnd, excludeAppointmentId } = params;

  const existingBookings = await tx.appointment.findMany({
    where: {
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      status: { in: ["PENDING", "CONFIRMED"] },
      staff_id: staffId ?? null,
      appointment_date: { lt: newEnd },
    },
    select: { appointment_date: true, duration: true },
  });

  for (const booking of existingBookings) {
    const existingStart = new Date(booking.appointment_date);
    const existingEnd = new Date(existingStart.getTime() + (booking.duration || 30) * 60 * 1000);

    if (newStart < existingEnd && newEnd > existingStart) {
      const availableFrom = existingEnd.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      });
      throw new AppError(
        staffId
          ? `This staff member is booked until ${availableFrom}. Please select a time at or after ${availableFrom}.`
          : `This time slot is unavailable until ${availableFrom}. Please choose a different time.`,
        409
      );
    }
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

export class AppointmentService {

  static async getAllServices() {
    return await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, description: true,
        duration: true, price: true, category: true, is_popular: true,
      },
    });
  }

  static async getAllStaff() {
    return await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, specialization: true },
    });
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

    // Generate slots: 9:00 AM – 6:30 PM in 30-min increments
    const slots: string[] = [];
    for (let hour = 9; hour < 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(
          `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        );
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
  static async bookAppointment(
    userId: string,
    data: {
      service_id:       string;
      staff_id?:        string;
      appointment_date: string | Date;
      notes?:           string;
    }
  ) {
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

    // Overlap check + create happen inside one Serializable transaction —
    // see runSerializable()'s comment for why that's required.
    const appointment = await runSerializable(async (tx) => {
      await assertSlotAvailable(tx, { staffId: data.staff_id, newStart, newEnd });

      return tx.appointment.create({
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
        include: {
          service: true,
          staff:   true,
          user:    { select: { id: true, name: true, email: true } },
        },
      });
    });

    emitBookingCreated(appointment);

    // notifyBookingConfirmed() sends the confirmation email + SMS and
    // schedules the 24h reminder — do not also call sendEmail() directly
    // here, or the customer gets two confirmation emails per booking.
    notifyBookingConfirmed(appointment.id).catch(err =>
      console.error("Notification error:", err)
    );

    return appointment;
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

    const oldDate  = appointment.appointment_date;
    const newStart = new Date(data.appointment_date);
    const newEnd   = new Date(newStart.getTime() + appointment.duration * 60 * 1000);
    const staffId  = data.staff_id ?? appointment.staff_id;

    // Overlap check + update happen inside one Serializable transaction —
    // see runSerializable()'s comment for why that's required.
    const updated = await runSerializable(async (tx) => {
      await assertSlotAvailable(tx, { staffId, newStart, newEnd, excludeAppointmentId: appointmentId });

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

  // ── All appointments (admin) ───────────────────────────────────────────────
  static async getAllAppointments() {
    return await prisma.appointment.findMany({
      include: {
        user:    { select: { id: true, name: true, email: true } },
        service: true,
        staff:   true,
      },
      orderBy: { appointment_date: "desc" },
    });
  }

  // ── Update status (admin) ──────────────────────────────────────────────────
  static async updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId },
    });
    if (!appointment) throw new AppError("Appointment not found", 404);

    if (appointment.status === "COMPLETED" && status !== "COMPLETED") {
      throw new AppError("Cannot change status of a completed appointment", 409);
    }

    const updated = await prisma.appointment.update({
      where:   { id: appointmentId },
      data:    { status },
      include: {
        service: true,
        staff:   true,
        user:    { select: { id: true, name: true, email: true } },
      },
    });

    emitBookingUpdated(updated);

    if (status === "CANCELLED") {
      notifyBookingCancelled(appointmentId).catch(err => console.error("Notification error:", err));
    } else if (status === "CONFIRMED") {
      notifyBookingConfirmed(appointmentId).catch(err => console.error("Notification error:", err));
    }

    console.log(`🔄 Booking ${appointmentId} updated to ${status}`);
    return updated;
  }

  // ── Complete with payment ──────────────────────────────────────────────────
  static async completeAppointmentWithPayment(appointmentId: string) {
    const appointment = await prisma.appointment.findFirst({
      where:   { id: appointmentId },
      include: { transaction: true },
    });
    if (!appointment)  throw new AppError("Appointment not found", 404);
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
  static async deleteAppointment(appointmentId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId },
    });
    if (!appointment) throw new AppError("Appointment not found", 404);

    return await prisma.appointment.delete({ where: { id: appointmentId } });
  }
}
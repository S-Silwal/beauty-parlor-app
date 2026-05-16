// src/services/appointment.service.ts
import { prisma } from "../config/database";
import { sendEmail } from '../notifications/email.service';
import { AppointmentStatus, PaymentStatus } from "@prisma/client";
import { emitBookingCreated, emitBookingUpdated } from "../socket";
import {
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyBookingRescheduled,
} from '../notifications/notification.service';

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
    const targetDate = new Date(data.date);
    if (isNaN(targetDate.getTime())) throw new Error("Invalid date format");

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

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
      throw new Error("Invalid appointment date format");
    }

    const service = await prisma.service.findUnique({
      where: { id: data.service_id },
    });
    if (!service) throw new Error("Service not found");

    const newStart = appointmentDate;
    const newEnd   = new Date(newStart.getTime() + service.duration * 60 * 1000);

    // ✅ FIXED: Fetch ALL active bookings for this staff (not just exact time match)
    // Then check overlap using: newStart < existingEnd AND newEnd > existingStart
    if (data.staff_id) {
      const existingBookings = await prisma.appointment.findMany({
        where: {
          staff_id: data.staff_id,
          status:   { in: ["PENDING", "CONFIRMED"] },
          // Only fetch bookings whose start time is before our new booking ends
          appointment_date: { lt: newEnd },
        },
        select: {
          id:               true,
          appointment_date: true,
          duration:         true,
        },
      });

      for (const booking of existingBookings) {
        const existingStart = new Date(booking.appointment_date);
        const existingEnd   = new Date(
          existingStart.getTime() + (booking.duration || 30) * 60 * 1000
        );

        // True overlap
        if (newStart < existingEnd && newEnd > existingStart) {
          const availableFrom = existingEnd.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit',
          });
          throw new Error(
            `This staff member is booked until ${availableFrom}. ` +
            `Please select a time at or after ${availableFrom}.`
          );
        }
      }
    } else {
      // No specific staff selected — check for general slot conflict
      const existingBookings = await prisma.appointment.findMany({
        where: {
          staff_id:         null,
          status:           { in: ["PENDING", "CONFIRMED"] },
          appointment_date: { lt: newEnd },
        },
        select: {
          appointment_date: true,
          duration:         true,
        },
      });

      for (const booking of existingBookings) {
        const existingStart = new Date(booking.appointment_date);
        const existingEnd   = new Date(
          existingStart.getTime() + (booking.duration || 30) * 60 * 1000
        );
        if (newStart < existingEnd && newEnd > existingStart) {
          throw new Error("This time slot is unavailable. Please choose a different time.");
        }
      }
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
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

    emitBookingCreated(appointment);

    sendEmail({
      event: 'BOOKING_CONFIRMED',
      data: {
        bookingId:       appointment.id,
        customerName:    appointment.user.name,
        customerEmail:   appointment.user.email,
        serviceName:     appointment.service.name,
        staffName:       appointment.staff?.name,
        appointmentDate: new Date(appointment.appointment_date).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }),
        appointmentTime: new Date(appointment.appointment_date).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
        }),
        price: `$${Number(appointment.total_price).toLocaleString('en-US')}`,
        notes: appointment.notes ?? undefined,
      },
      userId:        appointment.user_id,
      appointmentId: appointment.id,
    }).catch(err => console.error('Email notification failed:', err));

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
    if (!appointment)                    throw new Error("Appointment not found");
    if (appointment.user_id !== userId)  throw new Error("You can only cancel your own appointments");

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
    if (!appointment)                    throw new Error("Appointment not found");
    if (appointment.user_id !== userId)  throw new Error("You can only reschedule your own appointments");

    const oldDate  = appointment.appointment_date;
    const newStart = new Date(data.appointment_date);
    const newEnd   = new Date(newStart.getTime() + appointment.duration * 60 * 1000);
    const staffId  = data.staff_id ?? appointment.staff_id;

    // ✅ Overlap check for reschedule too
    const existingBookings = await prisma.appointment.findMany({
      where: {
        id:       { not: appointmentId }, // exclude current appointment
        status:   { in: ["PENDING", "CONFIRMED"] },
        ...(staffId && { staff_id: staffId }),
        appointment_date: { lt: newEnd },
      },
      select: { appointment_date: true, duration: true },
    });

    for (const booking of existingBookings) {
      const existingStart = new Date(booking.appointment_date);
      const existingEnd   = new Date(
        existingStart.getTime() + (booking.duration || 30) * 60 * 1000
      );
      if (newStart < existingEnd && newEnd > existingStart) {
        const availableFrom = existingEnd.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
        });
        throw new Error(
          `This time slot is unavailable until ${availableFrom}. Please choose a later time.`
        );
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        appointment_date: data.appointment_date,
        staff_id:         data.staff_id,
        notes:            data.notes,
        status:           "RESCHEDULED" as AppointmentStatus,
      },
      include: { service: true, staff: true },
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
    if (!appointment) throw new Error("Appointment not found");

    if (appointment.status === "COMPLETED" && status !== "COMPLETED") {
      throw new Error("Cannot change status of a completed appointment");
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
    if (!appointment)  throw new Error("Appointment not found");
    if (appointment.status !== "CONFIRMED") {
      throw new Error("Only confirmed appointments can be marked as completed");
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
    if (!appointment) throw new Error("Appointment not found");

    return await prisma.appointment.delete({ where: { id: appointmentId } });
  }
}
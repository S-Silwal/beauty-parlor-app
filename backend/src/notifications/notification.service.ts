// src/notifications/notification.service.ts
import { prisma } from '../config/database';
import { sendEmail } from './email.service';
import { sendSms } from './sms.service';
import { scheduleReminder } from './scheduler.service';

/**
 * Format date for display: "Friday, May 15, 2026"
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * Format time for display: "9:30 AM"
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Send booking confirmation — call this right after booking is created
 */
export async function notifyBookingConfirmed(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      user: true,
      service: true,
      staff: true,
    },
  });

  if (!appointment) throw new Error(`Appointment ${appointmentId} not found`);

  const emailData = {
    customerName: appointment.user.name,
    customerEmail: appointment.user.email,
    serviceName: appointment.service.name,
    staffName: appointment.staff?.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    price: `$${Number(appointment.total_price).toLocaleString('en-US')}`,
    notes: appointment.notes ?? undefined,
    bookingId: appointment.id,
  };

  const smsData = {
    customerName: appointment.user.name,
    serviceName: appointment.service.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    phone: appointment.user.phone ?? '',
  };

  // Send email + SMS in parallel (don't await — fire and forget)
  // This way booking response isn't delayed by email/SMS
  Promise.allSettled([
    sendEmail({
      event: 'BOOKING_CONFIRMED',
      data: emailData,
      userId: appointment.user_id,
      appointmentId,
    }),
    sendSms({
      event: 'BOOKING_CONFIRMED',
      data: smsData,
      userId: appointment.user_id,
      appointmentId,
    }),
    // Schedule 24h reminder via QStash
    scheduleReminder(appointmentId, appointment.appointment_date),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Notification ${i} failed:`, r.reason);
      }
    });
  });

  console.log(`📬 Notifications triggered for booking ${appointmentId}`);
}

/**
 * Send cancellation notification
 */
export async function notifyBookingCancelled(appointmentId: string, reason?: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true },
  });

  if (!appointment) return;

  const emailData = {
    customerName: appointment.user.name,
    customerEmail: appointment.user.email,
    serviceName: appointment.service.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    price: `$${Number(appointment.total_price)}`,
    bookingId: appointment.id,
    reason,
  };

  const smsData = {
    customerName: appointment.user.name,
    serviceName: appointment.service.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    phone: appointment.user.phone ?? '',
  };

  Promise.allSettled([
    sendEmail({ event: 'CANCELLED', data: emailData, userId: appointment.user_id, appointmentId }),
    sendSms({ event: 'CANCELLED', data: smsData, userId: appointment.user_id, appointmentId }),
  ]);
}

/**
 * Send reschedule notification
 */
export async function notifyBookingRescheduled(
  appointmentId: string,
  oldDate: Date,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true, staff: true },
  });

  if (!appointment) return;

  const emailData = {
    customerName: appointment.user.name,
    customerEmail: appointment.user.email,
    serviceName: appointment.service.name,
    staffName: appointment.staff?.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    price: `$${Number(appointment.total_price)}`,
    bookingId: appointment.id,
    oldDate: formatDate(oldDate),
    oldTime: formatTime(oldDate),
  };

  const smsData = {
    customerName: appointment.user.name,
    serviceName: appointment.service.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    phone: appointment.user.phone ?? '',
  };

  Promise.allSettled([
    sendEmail({ event: 'RESCHEDULED', data: emailData, userId: appointment.user_id, appointmentId }),
    sendSms({ event: 'RESCHEDULED', data: smsData, userId: appointment.user_id, appointmentId }),
    // Reschedule the 24h reminder too
    scheduleReminder(appointmentId, appointment.appointment_date),
  ]);
}

/**
 * Send "your change request was declined" notification — the original
 * booking is untouched, so this deliberately uses the CURRENT appointment
 * date/time (not any of the customer's requested values).
 */
export async function notifyChangeRequestDeclined(
  appointmentId: string,
  requestType: 'EDIT' | 'CANCEL',
  reason?: string,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true },
  });

  if (!appointment) return;

  const emailData = {
    customerName: appointment.user.name,
    customerEmail: appointment.user.email,
    serviceName: appointment.service.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    requestType,
    reason,
    bookingId: appointment.id,
  };

  const smsData = {
    customerName: appointment.user.name,
    serviceName: appointment.service.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    phone: appointment.user.phone ?? '',
  };

  Promise.allSettled([
    sendEmail({ event: 'CHANGE_REQUEST_DECLINED', data: emailData, userId: appointment.user_id, appointmentId }),
    sendSms({ event: 'CHANGE_REQUEST_DECLINED', data: smsData, userId: appointment.user_id, appointmentId }),
  ]);
}

/**
 * Send 24h reminder — called by QStash webhook
 *
 * `scheduledForDate` is the appointment date this specific reminder was
 * scheduled against (see scheduler.service.ts). If the appointment has since
 * been rescheduled to a different time, a fresh reminder was already
 * scheduled for the new time — this one is stale and must be skipped, or
 * the customer gets a reminder mistimed against the old slot.
 */
export async function notifyReminder24h(appointmentId: string, scheduledForDate?: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true, staff: true },
  });

  if (!appointment) return;

  // Don't send reminder for cancelled appointments
  if (appointment.status === 'CANCELLED') {
    console.log(`⏭️  Skipping reminder — appointment ${appointmentId} is cancelled`);
    return;
  }

  if (scheduledForDate && new Date(scheduledForDate).getTime() !== appointment.appointment_date.getTime()) {
    console.log(`⏭️  Skipping stale reminder for ${appointmentId} — appointment was rescheduled`);
    return;
  }

  const emailData = {
    customerName: appointment.user.name,
    customerEmail: appointment.user.email,
    serviceName: appointment.service.name,
    staffName: appointment.staff?.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    price: `$${Number(appointment.total_price)}`,
    bookingId: appointment.id,
  };

  const smsData = {
    customerName: appointment.user.name,
    serviceName: appointment.service.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    phone: appointment.user.phone ?? '',
  };

  await Promise.allSettled([
    sendEmail({ event: 'REMINDER_24H', data: emailData, userId: appointment.user_id, appointmentId }),
    sendSms({ event: 'REMINDER_24H', data: smsData, userId: appointment.user_id, appointmentId }),
  ]);
}
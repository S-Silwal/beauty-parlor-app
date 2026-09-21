// src/notifications/notification.service.ts
import { prisma } from '../config/database';
import { sendEmail } from './email.service';
import { sendSms } from './sms.service';
import { scheduleReminder } from './scheduler.service';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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
 * Send "booking placed" notification — call this right after a customer
 * SUBMITS a new booking (status is still PENDING at this point). This is
 * NOT a confirmation: a real member of staff has not looked at the request
 * yet. notifyBookingConfirmed (below) is the one that fires once an admin
 * actually confirms it — do not call that one from the create path.
 */
export async function notifyBookingPlaced(appointmentId: string) {
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

  // Send email + SMS in parallel (don't await — fire and forget). The 24h
  // reminder is deliberately NOT scheduled here — it's scheduled once the
  // booking is actually confirmed (see notifyBookingConfirmed), since a
  // reminder for a request nobody has confirmed yet would be misleading.
  Promise.allSettled([
    sendEmail({
      event: 'BOOKING_PLACED',
      data: emailData,
      userId: appointment.user_id,
      appointmentId,
    }),
    sendSms({
      event: 'BOOKING_PLACED',
      data: smsData,
      userId: appointment.user_id,
      appointmentId,
    }),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Notification ${i} failed:`, r.reason);
      }
    });
  });

  console.log(`📬 "Booking placed" notifications triggered for ${appointmentId}`);
}

/**
 * Send booking confirmation — call this only when an admin/staff member
 * actually confirms a PENDING booking (AppointmentService.updateAppointmentStatus,
 * status === "CONFIRMED"). Never call this from the booking-create path —
 * that's notifyBookingPlaced above.
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
 * Send "thank you + review request" notification — call this only when
 * staff mark the appointment COMPLETED (AppointmentService.completeAppointmentWithPayment).
 * Cancelled or still-pending/confirmed bookings never get this email. The
 * review link opens the existing My Bookings review section pre-scoped to
 * this booking — ReviewService.createReview re-checks ownership and status
 * server-side regardless of what the link says.
 */
export async function notifyBookingCompleted(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      user: true,
      service: true,
      staff: true,
    },
  });

  if (!appointment) throw new Error(`Appointment ${appointmentId} not found`);

  const reviewUrl = `${FRONTEND_URL}/my-bookings?review=${appointment.id}`;

  const emailData = {
    customerName: appointment.user.name,
    customerEmail: appointment.user.email,
    serviceName: appointment.service.name,
    staffName: appointment.staff?.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    price: `$${Number(appointment.total_price).toLocaleString('en-US')}`,
    bookingId: appointment.id,
    reviewUrl,
  };

  const smsData = {
    customerName: appointment.user.name,
    serviceName: appointment.service.name,
    appointmentDate: formatDate(appointment.appointment_date),
    appointmentTime: formatTime(appointment.appointment_date),
    phone: appointment.user.phone ?? '',
  };

  Promise.allSettled([
    sendEmail({
      event: 'BOOKING_COMPLETED',
      data: emailData,
      userId: appointment.user_id,
      appointmentId,
    }),
    sendSms({
      event: 'BOOKING_COMPLETED',
      data: smsData,
      userId: appointment.user_id,
      appointmentId,
    }),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Notification ${i} failed:`, r.reason);
      }
    });
  });

  console.log(`📬 "Thank you" + review-request notifications triggered for ${appointmentId}`);
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

  // QStash delivers at-least-once (retries: 3 — see scheduler.service.ts),
  // so this handler can legitimately be invoked more than once for the same
  // scheduled reminder (e.g. a slow-but-ultimately-successful response is
  // enough to trigger a retry). Check NotificationLog per channel — rather
  // than skip the whole call — so if email already went out but SMS failed
  // on a previous attempt, a retry still gets the customer their text
  // instead of silently dropping it because *something* was already sent.
  const [emailAlreadySent, smsAlreadySent] = await Promise.all([
    prisma.notificationLog.findFirst({
      where: { appointment_id: appointmentId, event: 'REMINDER_24H', type: 'EMAIL', status: 'SENT' },
      select: { id: true },
    }),
    prisma.notificationLog.findFirst({
      where: { appointment_id: appointmentId, event: 'REMINDER_24H', type: 'SMS', status: 'SENT' },
      select: { id: true },
    }),
  ]);

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

  if (emailAlreadySent) {
    console.log(`⏭️  Skipping duplicate 24h reminder email for ${appointmentId} — already sent`);
  }
  if (smsAlreadySent) {
    console.log(`⏭️  Skipping duplicate 24h reminder SMS for ${appointmentId} — already sent`);
  }

  await Promise.allSettled([
    ...(emailAlreadySent
      ? []
      : [sendEmail({ event: 'REMINDER_24H', data: emailData, userId: appointment.user_id, appointmentId })]),
    ...(smsAlreadySent
      ? []
      : [sendSms({ event: 'REMINDER_24H', data: smsData, userId: appointment.user_id, appointmentId })]),
  ]);
}
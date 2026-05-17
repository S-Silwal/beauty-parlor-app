// src/notifications/email.service.ts
import { Resend } from 'resend';
import { prisma } from '../config/database';

// ✅ FIX 1: Import types from types.ts where they are actually defined
import {
  BookingEmailData,
  CancelledEmailData,
  RescheduledEmailData,
} from '../templates/types';

// ✅ FIX 2: Import each template from its own separate file
import { bookingConfirmedTemplate } from '../templates/booking-confirmed';
import { reminder24hTemplate }      from '../templates/reminder-24h';
import { bookingCancelledTemplate } from '../templates/cancelled';
import { bookingRescheduledTemplate } from '../templates/rescheduled';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL || 'Crown & Glow <hello@crownandglow.com>';

export type EmailEvent =
  | 'BOOKING_CONFIRMED'
  | 'REMINDER_24H'
  | 'CANCELLED'
  | 'RESCHEDULED';

// ✅ FIX 3: Use the correct union type for data
type EmailData =
  | BookingEmailData
  | CancelledEmailData
  | RescheduledEmailData;

interface SendEmailOptions {
  event:         EmailEvent;
  data:          EmailData;
  userId:        string;
  appointmentId: string;
}

export async function sendEmail({
  event,
  data,
  userId,
 
}: SendEmailOptions) {

  // ✅ FIX 4: Don't select email_notifications — it doesn't exist in schema yet
  // Just verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log(`📧 Email skipped — user ${userId} not found`);
    return;
  }

  // Build template based on event
  let template: { subject: string; html: string };

  switch (event) {
    case 'BOOKING_CONFIRMED':
      template = bookingConfirmedTemplate(data as BookingEmailData);
      break;
    case 'REMINDER_24H':
      template = reminder24hTemplate(data as BookingEmailData);
      break;
    case 'CANCELLED':
      template = bookingCancelledTemplate(data as CancelledEmailData);
      break;
    case 'RESCHEDULED':
      template = bookingRescheduledTemplate(data as RescheduledEmailData);
      break;
    default:
      throw new Error(`Unknown email event: ${event}`);
  }

  // ✅ FIX 5: prisma.notificationLog doesn't exist yet — skip DB logging
  // until you run the migration to add the NotificationLog model
  // Once migration is done, uncomment the block below

  /*
  const log = await prisma.notificationLog.create({
    data: {
      user_id:        userId,
      appointment_id: appointmentId,
      type:           'EMAIL',
      event,
      status:         'PENDING',
      recipient:      (data as BookingEmailData).customerEmail,
    },
  });
  */

  try {
    const result = await resend.emails.send({
      from:    FROM,
      to:      (data as BookingEmailData).customerEmail,
      subject: template.subject,
      html:    template.html,
    });

    console.log(`✅ Email sent [${event}] to ${(data as BookingEmailData).customerEmail} — ID: ${result.data?.id}`);

    /*
    // Uncomment after migration:
    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  { status: 'SENT', sent_at: new Date() },
    });
    */

    return result;

  } catch (error: any) {
    console.error(`❌ Email failed [${event}] to ${(data as BookingEmailData).customerEmail}:`, error.message);

    /*
    // Uncomment after migration:
    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  { status: 'FAILED', error_message: error.message },
    });
    */

    throw error;
  }
}
// src/notifications/email.service.ts
import { Resend } from 'resend';
import { prisma } from '../config/database';
import { emailConfig } from '../config/email';
import { generateUnsubscribeToken } from '../utils/unsubscribeToken';

// ✅ FIX 1: Import types from types.ts where they are actually defined
import {
  BookingEmailData,
  CancelledEmailData,
  RescheduledEmailData,
  CompletedEmailData,
} from '../templates/types';

// ✅ FIX 2: Import each template from its own separate file
import { bookingPlacedTemplate }     from '../templates/booking-placed';
import { bookingConfirmedTemplate } from '../templates/booking-confirmed';
import { bookingCompletedTemplate } from '../templates/booking-completed';
import { reminder24hTemplate }      from '../templates/reminder-24h';
import { bookingCancelledTemplate } from '../templates/cancelled';
import { bookingRescheduledTemplate } from '../templates/rescheduled';
import {
  changeRequestDeclinedTemplate,
  ChangeRequestDeclinedEmailData,
} from '../templates/change-request-declined';

// Lazily construct the Resend client instead of at module load time — tests
// (and any other code path that merely imports this module without ever
// sending an email) shouldn't need a real RESEND_API_KEY just to import it.
let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM = process.env.RESEND_FROM_EMAIL || 'Crown & Glow <hello@crownandglow.com>';

export type EmailEvent =
  | 'BOOKING_PLACED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_COMPLETED'
  | 'REMINDER_24H'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'CHANGE_REQUEST_DECLINED';

// ✅ FIX 3: Use the correct union type for data
type EmailData =
  | BookingEmailData
  | CancelledEmailData
  | RescheduledEmailData
  | CompletedEmailData
  | ChangeRequestDeclinedEmailData;

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
  appointmentId,
}: SendEmailOptions) {

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, email_notifications: true },
  });

  if (!user) {
    console.log(`📧 Email skipped — user ${userId} not found`);
    return;
  }

  if (!user.email_notifications) {
    console.log(`📧 Email skipped — user ${userId} has opted out`);
    return;
  }

  // Build template based on event
  let template: { subject: string; html: string };

  switch (event) {
    case 'BOOKING_PLACED':
      template = bookingPlacedTemplate(data as BookingEmailData);
      break;
    case 'BOOKING_CONFIRMED':
      template = bookingConfirmedTemplate(data as BookingEmailData);
      break;
    case 'BOOKING_COMPLETED':
      template = bookingCompletedTemplate(data as CompletedEmailData);
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
    case 'CHANGE_REQUEST_DECLINED':
      template = changeRequestDeclinedTemplate(data as ChangeRequestDeclinedEmailData);
      break;
    default:
      throw new Error(`Unknown email event: ${event}`);
  }

  // Fill in the per-user, signed unsubscribe link (never a raw email —
  // see routes/notification.routes.ts for why).
  const unsubscribeUrl = `${emailConfig.backendUrl}/api/notifications/unsubscribe?token=${generateUnsubscribeToken(user.id)}`;
  template.html = template.html.replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl);

  const recipient = (data as BookingEmailData).customerEmail;

  const log = await prisma.notificationLog.create({
    data: {
      user_id:        userId,
      appointment_id: appointmentId,
      type:           'EMAIL',
      event,
      status:         'PENDING',
      recipient,
    },
  });

  try {
    const result = await getResend().emails.send({
      from:    FROM,
      to:      recipient,
      subject: template.subject,
      html:    template.html,
    });

    // The Resend SDK resolves instead of rejecting on API-level failures —
    // the failure comes back as `result.error`, not a thrown exception.
    if (result.error) {
      throw new Error(result.error.message);
    }

    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  { status: 'SENT', sent_at: new Date(), external_id: result.data?.id },
    });

    console.log(`✅ Email sent [${event}] to ${recipient} — ID: ${result.data?.id}`);
    return result;

  } catch (error: any) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  { status: 'FAILED', error_message: error.message },
    });

    console.error(`❌ Email failed [${event}] to ${recipient}:`, error.message);
    throw error;
  }
}
// src/notifications/sms.service.ts
import twilio from 'twilio';
import { prisma } from '../config/database';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER!;

export type SmsEvent =
  | 'BOOKING_CONFIRMED'
  | 'REMINDER_24H'
  | 'CANCELLED'
  | 'RESCHEDULED';

interface SmsData {
  customerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  phone: string;
}

interface SendSmsOptions {
  event: SmsEvent;
  data: SmsData;
  userId: string;
  appointmentId: string;
}

// ── SMS Templates (keep under 160 chars for single SMS) ──────────────────────
function buildSmsMessage(event: SmsEvent, data: SmsData): string {
  const name = data.customerName.split(' ')[0];

  switch (event) {
    case 'BOOKING_CONFIRMED':
      return `Hi ${name}! ✅ Your ${data.serviceName} at Crown & Glow is confirmed for ${data.appointmentDate} at ${data.appointmentTime}. See you soon! Questions? Call (317) 555-0187.`;

    case 'REMINDER_24H':
      return `Hi ${name}! ⏰ Reminder: Your ${data.serviceName} is tomorrow at ${data.appointmentTime}. Crown & Glow, 456 Glow Ave. Need to cancel? Call (317) 555-0187 ASAP.`;

    case 'CANCELLED':
      return `Hi ${name}, your ${data.serviceName} appointment on ${data.appointmentDate} has been cancelled. Book again at crownandglow.com or call (317) 555-0187.`;

    case 'RESCHEDULED':
      return `Hi ${name}! 📅 Your ${data.serviceName} has been rescheduled to ${data.appointmentDate} at ${data.appointmentTime}. Crown & Glow — (317) 555-0187.`;

    default:
      return `Crown & Glow: Your appointment has been updated. Visit crownandglow.com for details.`;
  }
}

/**
 * Send SMS via Twilio
 * Logs result to NotificationLog table
 */
export async function sendSms({ event, data, userId, appointmentId }: SendSmsOptions) {
  if (!data.phone) {
    console.log(`📱 SMS skipped — no phone number for user ${userId}`);
    return;
  }

  // Check user SMS preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sms_notifications: true },
  });

  if (!user?.sms_notifications) {
    console.log(`📱 SMS skipped — user ${userId} has opted out`);
    return;
  }

  const message = buildSmsMessage(event, data);

  // Create log entry
  const log = await prisma.notificationLog.create({
    data: {
      user_id: userId,
      appointment_id: appointmentId,
      type: 'SMS',
      event,
      status: 'PENDING',
      recipient: data.phone,
    },
  });

  try {
    const result = await client.messages.create({
      body: message,
      from: FROM_NUMBER,
      to: data.phone,
    });

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sent_at: new Date() },
    });

    console.log(`✅ SMS sent [${event}] to ${data.phone} — SID: ${result.sid}`);
    return result;

  } catch (error: any) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error_message: error.message },
    });

    console.error(`❌ SMS failed [${event}] to ${data.phone}:`, error.message);
    throw error;
  }
}
// src/notifications/sms.service.ts
import twilio from 'twilio';
import { prisma } from '../config/database';

// Twilio's client constructor validates the Account SID synchronously and
// THROWS if it's missing/malformed. This module is imported at server
// startup (appointment.service -> notification.service -> sms.service), so
// an unconfigured Twilio account used to crash the ENTIRE backend before it
// could even start listening (the "Failed to fetch" errors on the frontend
// were the symptom of this — nothing was running on port 5000 at all).
// Only construct the client when real credentials are present, and no-op
// SMS sending otherwise.
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let client: ReturnType<typeof twilio> | null = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
} else {
  console.warn(
    '⚠️  SMS notifications disabled — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ' +
    'and TWILIO_PHONE_NUMBER in backend/.env to enable them.'
  );
}

export type SmsEvent =
  | 'BOOKING_CONFIRMED'
  | 'REMINDER_24H'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'CHANGE_REQUEST_DECLINED';

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

    case 'CHANGE_REQUEST_DECLINED':
      return `Hi ${name}, your requested change to ${data.serviceName} wasn't approved — your booking for ${data.appointmentDate} at ${data.appointmentTime} still stands. Questions? Call (317) 555-0187.`;

    default:
      return `Crown & Glow: Your appointment has been updated. Visit crownandglow.com for details.`;
  }
}

/**
 * Send SMS via Twilio
 * Logs result to NotificationLog table
 */
export async function sendSms({ event, data, userId, appointmentId }: SendSmsOptions) {
  if (!client) {
    console.log(`📱 SMS skipped — Twilio is not configured`);
    return;
  }

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
      from: TWILIO_PHONE_NUMBER!,
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

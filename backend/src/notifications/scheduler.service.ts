// src/notifications/scheduler.service.ts
import { Client } from '@upstash/qstash';

// Same defensive pattern as sms.service.ts: don't let a missing/optional
// third-party credential take down the server. QStash's Client constructor
// doesn't throw synchronously on a missing token the way Twilio's does, but
// guarding it here closes off the same class of bug and gives a clear signal
// in the logs instead of a confusing failure the first time it's actually used.
const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const qstash = QSTASH_TOKEN ? new Client({ token: QSTASH_TOKEN }) : null;

if (!qstash) {
  console.warn('⚠️  Scheduled reminders disabled — set QSTASH_TOKEN in backend/.env to enable them.');
}

/**
 * Schedule a 24-hour reminder via Upstash QStash
 * QStash will call your webhook endpoint at the scheduled time
 */
export async function scheduleReminder(appointmentId: string, appointmentDate: Date) {
  if (!qstash) {
    console.log(`⏭️  Skipping reminder scheduling for ${appointmentId} — QStash is not configured`);
    return;
  }

  // Calculate 24 hours before appointment
  const reminderTime = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
  const now = new Date();

  // Don't schedule if reminder time has already passed
  if (reminderTime <= now) {
    console.log(`⏭️  Skipping reminder for ${appointmentId} — appointment is less than 24h away`);
    return;
  }

  const delay = Math.floor((reminderTime.getTime() - now.getTime()) / 1000); // seconds

  try {
    const result = await qstash.publishJSON({
      url: `${BACKEND_URL}/api/notifications/reminder`,
      // Carry the date this reminder was scheduled for — if the appointment
      // gets rescheduled afterward, a new reminder is scheduled for the new
      // time, but this original QStash message still fires. The webhook
      // uses this to recognize it's stale and skip sending it.
      body: { appointmentId, scheduledForDate: appointmentDate.toISOString() },
      delay, // QStash will deliver after this many seconds
      retries: 3,
    });

    console.log(`⏰ Reminder scheduled for appointment ${appointmentId} — QStash ID: ${result.messageId}`);
    return result;

  } catch (error: any) {
    console.error(`❌ Failed to schedule reminder for ${appointmentId}:`, error.message);
    // Don't throw — scheduling failure shouldn't break the booking flow
  }
}

/**
 * Cancel a scheduled reminder (when appointment is cancelled/rescheduled)
 */
export async function cancelScheduledReminder(qstashMessageId: string) {
  if (!qstash) return;

  try {
    await qstash.messages.delete(qstashMessageId);
    console.log(`🗑️  Cancelled scheduled reminder: ${qstashMessageId}`);
  } catch (error: any) {
    console.error(`❌ Failed to cancel reminder ${qstashMessageId}:`, error.message);
  }
}

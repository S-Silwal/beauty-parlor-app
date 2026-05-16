// src/notifications/scheduler.service.ts
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

/**
 * Schedule a 24-hour reminder via Upstash QStash
 * QStash will call your webhook endpoint at the scheduled time
 */
export async function scheduleReminder(appointmentId: string, appointmentDate: Date) {
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
      body: { appointmentId },
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
  try {
    await qstash.messages.delete(qstashMessageId);
    console.log(`🗑️  Cancelled scheduled reminder: ${qstashMessageId}`);
  } catch (error: any) {
    console.error(`❌ Failed to cancel reminder ${qstashMessageId}:`, error.message);
  }
}
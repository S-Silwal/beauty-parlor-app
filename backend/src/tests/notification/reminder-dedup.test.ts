import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../../config/database';
import { notifyReminder24h } from '../../notifications/notification.service';

// H3 in the hardening audit: QStash delivers at-least-once (retries: 3), so
// notifyReminder24h() can legitimately be invoked more than once for the
// same scheduled reminder. Before the fix, it only skipped a *stale*
// reminder (appointment rescheduled since scheduling) — it never checked
// whether the reminder had already actually been sent, so a retry meant a
// customer could get the same "your appointment is tomorrow" email twice.
//
// This test targets the dedup check itself (NotificationLog lookup),
// independent of whether a real send actually succeeds — asserting "no new
// log row gets created" is what proves no second send was attempted, and
// doesn't depend on Resend's own delivery behavior in this environment.
const TEST_EMAIL = 'reminder_dedup_test@example.com';

describe('notifyReminder24h — 24h reminder de-duplication', () => {
  let userId: string;
  let serviceId: string;
  let appointmentId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    const user = await prisma.user.create({
      data: {
        name: 'Reminder Dedup Test User',
        email: TEST_EMAIL,
        password_hash: 'not-a-real-hash', // this suite never logs in — no auth needed
        is_verified: true,
      },
    });
    userId = user.id;

    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) throw new Error('No active service found — seed the database before running this test.');
    serviceId = service.id;

    const appointment = await prisma.appointment.create({
      data: {
        user_id: userId,
        service_id: serviceId,
        appointment_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        duration: service.duration,
        total_price: service.price,
        status: 'CONFIRMED',
      },
    });
    appointmentId = appointment.id;
  });

  afterAll(async () => {
    await prisma.notificationLog.deleteMany({ where: { appointment_id: appointmentId } });
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('sends exactly one email reminder on the first call', async () => {
    await notifyReminder24h(appointmentId);

    const logs = await prisma.notificationLog.findMany({
      where: { appointment_id: appointmentId, event: 'REMINDER_24H', type: 'EMAIL' },
    });
    expect(logs.length).toBe(1);
  });

  it('does not attempt a second send once one is already logged as SENT', async () => {
    // Simulate the first attempt having genuinely succeeded — this is what
    // the dedup check actually looks for, and asserting against it directly
    // keeps this test deterministic regardless of whether a real Resend
    // send would succeed in this environment.
    await prisma.notificationLog.deleteMany({ where: { appointment_id: appointmentId } });
    await prisma.notificationLog.create({
      data: {
        user_id: userId,
        appointment_id: appointmentId,
        type: 'EMAIL',
        event: 'REMINDER_24H',
        status: 'SENT',
        recipient: TEST_EMAIL,
        sent_at: new Date(),
      },
    });

    await notifyReminder24h(appointmentId);

    // Still exactly the one SENT row from before the second call — a real
    // duplicate-send bug would show up here as a second row.
    const logs = await prisma.notificationLog.findMany({
      where: { appointment_id: appointmentId, event: 'REMINDER_24H', type: 'EMAIL' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('SENT');
  });

  it('skips the reminder entirely for a cancelled appointment', async () => {
    await prisma.notificationLog.deleteMany({ where: { appointment_id: appointmentId } });
    await prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'CANCELLED' } });

    await notifyReminder24h(appointmentId);

    const logs = await prisma.notificationLog.findMany({
      where: { appointment_id: appointmentId, event: 'REMINDER_24H' },
    });
    expect(logs.length).toBe(0);

    // Restore for any tests that might run after this in the same file.
    await prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'CONFIRMED' } });
  });
});

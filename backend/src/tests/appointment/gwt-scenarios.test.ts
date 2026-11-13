import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../app';
import { prisma } from '../../config/database';
import { authConfig } from '../../config/auth';
import { salonWallTimeToUtc, salonLocalDateStr } from '../../utils/timezone';

// QA plan section 4 — the Given/When/Then scenarios, as executable tests.
// Scenarios already covered elsewhere (kept there, not duplicated):
//   • Concurrent double-booking  → concurrent-staff-booking.test.ts
//   • Reschedule to a taken slot  → edge-cases.test.ts (+ conflict message, below)
//   • Password reset end to end   → integration/auth/auth.routes.test.ts
const PREFIX = 'gwt_scenario_test_';

const salonDateIn = (days: number) => salonLocalDateStr(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

/** Notifications are fire-and-forget after the response, so poll briefly for the log row. */
async function waitForEmailLog(appointmentId: string, event: string) {
  for (let i = 0; i < 20; i++) {
    const row = await prisma.notificationLog.findFirst({ where: { appointment_id: appointmentId, type: 'EMAIL', event } });
    if (row) return row;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

describe('QA section 4 — Given/When/Then scenarios', () => {
  let customerA: string, customerB: string, admin: string;
  let staffId: string;
  let service: { id: string; duration: number };

  beforeAll(async () => {
    await prisma.appointment.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

    const s = await prisma.service.findFirst({ where: { isActive: true }, orderBy: { duration: 'asc' } });
    if (!s) throw new Error('No active service — seed the database first.');
    service = s;
    staffId = (await prisma.staff.create({ data: { name: 'GWT Staff', isActive: true } })).id;

    const mk = async (n: string, role: 'CUSTOMER' | 'ADMIN') => {
      const u = await prisma.user.create({
        data: { name: `GWT ${n}`, email: `${PREFIX}${n}@example.com`, password_hash: 'unused', role, is_verified: true },
      });
      return jwt.sign({ userId: u.id, role: u.role }, authConfig.jwtSecret, { expiresIn: '10m' });
    };
    customerA = await mk('a', 'CUSTOMER');
    customerB = await mk('b', 'CUSTOMER');
    admin = await mk('admin', 'ADMIN');
  });

  afterAll(async () => {
    const ids = (await prisma.appointment.findMany({ where: { staff_id: staffId }, select: { id: true } })).map(a => a.id);
    await prisma.notificationLog.deleteMany({ where: { appointment_id: { in: ids } } });
    await prisma.appointment.deleteMany({ where: { staff_id: staffId } });
    await prisma.notificationLog.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.staff.deleteMany({ where: { id: staffId } });
  });

  const book = (token: string, day: string, time: string) =>
    request(app).post('/api/appointments/book').set('Authorization', `Bearer ${token}`)
      .send({ service_id: service.id, staff_id: staffId, appointment_date: salonWallTimeToUtc(day, time).toISOString() });
  const slotsFor = async (day: string): Promise<string[]> => {
    const res = await request(app).get(`/api/appointments/available-slots?date=${day}&service_id=${service.id}&staff_id=${staffId}`);
    expect(res.status).toBe(200);
    return res.body.data?.availableSlots ?? res.body.availableSlots ?? [];
  };

  // ── 1. Book a valid appointment (P0) ────────────────────────────────────
  it('GIVEN an open slot WHEN a customer books it THEN the booking exists, a confirmation email is queued, and the slot disappears for others', async () => {
    const day = salonDateIn(30);
    expect(await slotsFor(day)).toContain('10:00');

    const res = await book(customerA, day, '10:00');
    expect(res.status).toBe(201);
    const id = res.body.appointment.id;
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');

    expect(await waitForEmailLog(id, 'BOOKING_PLACED')).not.toBeNull();
    expect(await slotsFor(day)).not.toContain('10:00');

    const other = await book(customerB, day, '10:00');
    expect(other.status).toBe(409);
  });

  // ── 3. Reschedule to a taken slot — "the error names the conflict" ──────
  it('GIVEN a taken slot WHEN another customer reschedules into it THEN the error says why (code + message)', async () => {
    const day = salonDateIn(31);
    expect((await book(customerA, day, '13:00')).status).toBe(201);
    const b = await book(customerB, day, '15:00');
    expect(b.status).toBe(201);

    const res = await request(app).patch(`/api/appointments/${b.body.appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${customerB}`)
      .send({ appointment_date: salonWallTimeToUtc(day, '13:00').toISOString(), staff_id: staffId });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SLOT_UNAVAILABLE');
    expect(res.body.message).toMatch(/not available|booked|choose/i);
  });

  // ── 4. Admin cancels a booking (P1) ─────────────────────────────────────
  it('GIVEN an upcoming booking WHEN an admin cancels it THEN status is CANCELLED, the customer email is queued, and the slot reopens', async () => {
    const day = salonDateIn(32);
    const booked = await book(customerA, day, '11:00');
    expect(booked.status).toBe(201);
    const id = booked.body.appointment.id;
    expect(await slotsFor(day)).not.toContain('11:00');

    const res = await request(app).patch(`/api/appointments/${id}/status`)
      .set('Authorization', `Bearer ${admin}`).send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);

    expect((await prisma.appointment.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');
    expect(await waitForEmailLog(id, 'CANCELLED')).not.toBeNull();
    expect(await slotsFor(day)).toContain('11:00');
    expect((await book(customerB, day, '11:00')).status).toBe(201);
  });

  // ── 5. Customer hits admin-only routes (P0) ─────────────────────────────
  it('GIVEN a logged-in customer WHEN they call admin/staff appointment routes THEN every one is 403 and returns no data', async () => {
    const day = salonDateIn(33);
    const own = await book(customerA, day, '16:00');
    expect(own.status).toBe(201);
    const id = own.body.appointment.id;

    const auth = { Authorization: `Bearer ${customerA}` };
    const calls: [string, () => Promise<request.Response>][] = [
      ['GET /all', () => request(app).get('/api/appointments/all').set(auth)],
      ['PATCH /:id/status', () => request(app).patch(`/api/appointments/${id}/status`).set(auth).send({ status: 'CANCELLED' })],
      ['GET /change-requests/pending', () => request(app).get('/api/appointments/change-requests/pending').set(auth)],
      ['PATCH /change-requests/:id/resolve', () => request(app).patch('/api/appointments/change-requests/00000000-0000-0000-0000-000000000000/resolve').set(auth).send({ approve: true })],
    ];
    for (const [route, call] of calls) {
      const res = await call();
      expect({ route, status: res.status }).toEqual({ route, status: 403 });
      expect(res.body.appointments ?? res.body.data ?? res.body.requests).toBeUndefined();
    }
    // …and the customer's own booking was not changed by the attempt.
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
  });
});

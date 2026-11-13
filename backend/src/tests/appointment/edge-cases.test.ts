import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../app';
import { prisma } from '../../config/database';
import { authConfig } from '../../config/auth';
import { salonWallTimeToUtc, formatSalonTime, salonLocalDateStr } from '../../utils/timezone';

// QA plan section 2K — error handling & edge cases for booking.
// Times are built with salonWallTimeToUtc(), i.e. salon wall-clock time in
// America/Indiana/Indianapolis, so every case means the same thing on a
// laptop and in UTC CI.
const PREFIX = 'edge_case_test_';
const book = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/appointments/book').set('Authorization', `Bearer ${token}`).send(body);

/** A salon-local YYYY-MM-DD `days` from today (always in the future). */
function salonDateIn(days: number): string {
  return salonLocalDateStr(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

describe('booking edge cases (QA 2K)', () => {
  let tokenA: string;
  let tokenB: string;
  let staffId: string;
  let shortService: { id: string; duration: number };
  let longService: { id: string; duration: number };

  beforeAll(async () => {
    await prisma.appointment.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

    const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { duration: 'asc' } });
    if (services.length === 0) throw new Error('No active services — seed the database first.');
    shortService = services[0];
    longService = services[services.length - 1];

    staffId = (await prisma.staff.create({ data: { name: 'Edge Case Staff', isActive: true } })).id;

    const mk = async (n: string) => {
      const u = await prisma.user.create({
        data: { name: `Edge ${n}`, email: `${PREFIX}${n}@example.com`, password_hash: 'unused', role: 'CUSTOMER', is_verified: true },
      });
      return jwt.sign({ userId: u.id, role: u.role }, authConfig.jwtSecret, { expiresIn: '10m' });
    };
    tokenA = await mk('a');
    tokenB = await mk('b');
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { staff_id: staffId } });
    await prisma.appointment.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.staff.deleteMany({ where: { id: staffId } });
  });

  // ── P0: past slots ──────────────────────────────────────────────────────
  it('rejects a booking in the past with a clear 400', async () => {
    const res = await book(tokenA, {
      service_id: shortService.id, staff_id: staffId,
      appointment_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/future/i);
  });

  // ── P1: boundaries of the working day ───────────────────────────────────
  it('rejects bookings outside salon hours (midnight, 3 AM, 8:30 AM)', async () => {
    const day = salonDateIn(20);
    for (const t of ['00:00', '03:00', '08:30']) {
      const res = await book(tokenA, { service_id: shortService.id, staff_id: staffId, appointment_date: salonWallTimeToUtc(day, t).toISOString() });
      expect({ t, status: res.status }).toEqual({ t, status: 400 });
    }
  });

  it('accepts the first slot of the day (09:00) and a booking that ends exactly at closing', async () => {
    const day = salonDateIn(21);
    const first = await book(tokenA, { service_id: shortService.id, staff_id: staffId, appointment_date: salonWallTimeToUtc(day, '09:00').toISOString() });
    expect(first.status).toBe(201);

    // 19:00 close minus the longest service's duration: ends on the dot.
    const closeMinusDur = new Date(salonWallTimeToUtc(day, '19:00').getTime() - longService.duration * 60 * 1000);
    const last = await book(tokenB, { service_id: longService.id, staff_id: staffId, appointment_date: closeMinusDur.toISOString() });
    expect(last.status).toBe(201);
  });

  it('rejects a booking that would run past closing time', async () => {
    const day = salonDateIn(22);
    const overrun = new Date(salonWallTimeToUtc(day, '19:00').getTime() - longService.duration * 60 * 1000 + 30 * 60 * 1000);
    const res = await book(tokenA, { service_id: longService.id, staff_id: staffId, appointment_date: overrun.toISOString() });
    expect(res.status).toBe(400);
  });

  it('never offers a slot whose service would end after closing', async () => {
    const day = salonDateIn(23);
    const res = await request(app).get(`/api/appointments/available-slots?date=${day}&service_id=${longService.id}&staff_id=${staffId}`);
    expect(res.status).toBe(200);
    const close = salonWallTimeToUtc(day, '19:00').getTime();
    for (const slot of res.body.availableSlots ?? res.body.data?.availableSlots ?? []) {
      const end = salonWallTimeToUtc(day, slot).getTime() + longService.duration * 60 * 1000;
      expect({ slot, endsAfterClose: end > close }).toEqual({ slot, endsAfterClose: false });
    }
  });

  // ── P1 / P0: DST and server-timezone independence ───────────────────────
  it('keeps the picked wall-clock time across the March 2027 DST change', async () => {
    // US DST starts Sunday 2027-03-14: 10:00 EST is 15:00Z the day before, 10:00 EDT is 14:00Z on the day.
    const cases = [['2027-03-13', '15:00:00.000Z'], ['2027-03-14', '14:00:00.000Z']] as const;
    for (const [day, expectedUtc] of cases) {
      const res = await book(tokenA, { service_id: shortService.id, staff_id: staffId, appointment_date: salonWallTimeToUtc(day, '10:00').toISOString() });
      expect(res.status).toBe(201);
      const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.appointment.id } });
      expect(stored.appointment_date.toISOString()).toBe(`${day}T${expectedUtc}`);
      expect(formatSalonTime(stored.appointment_date)).toBe('10:00 AM');
    }
  });

  // ── P0: rescheduling into a taken slot ──────────────────────────────────
  it('rejects rescheduling into a slot another customer has taken, leaving the booking unchanged', async () => {
    const day = salonDateIn(24);
    const taken = salonWallTimeToUtc(day, '13:00');
    const a = await book(tokenA, { service_id: shortService.id, staff_id: staffId, appointment_date: taken.toISOString() });
    expect(a.status).toBe(201);
    const b = await book(tokenB, { service_id: shortService.id, staff_id: staffId, appointment_date: salonWallTimeToUtc(day, '15:00').toISOString() });
    expect(b.status).toBe(201);

    const res = await request(app)
      .patch(`/api/appointments/${b.body.appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ appointment_date: taken.toISOString(), staff_id: staffId });
    expect(res.status).toBe(409);

    const after = await prisma.appointment.findUniqueOrThrow({ where: { id: b.body.appointment.id } });
    expect(after.appointment_date.toISOString()).toBe(salonWallTimeToUtc(day, '15:00').toISOString());
  });

  it('rejects rescheduling to outside salon hours', async () => {
    const day = salonDateIn(25);
    const b = await book(tokenB, { service_id: shortService.id, staff_id: staffId, appointment_date: salonWallTimeToUtc(day, '11:00').toISOString() });
    expect(b.status).toBe(201);
    const res = await request(app)
      .patch(`/api/appointments/${b.body.appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ appointment_date: salonWallTimeToUtc(day, '22:00').toISOString() });
    expect(res.status).toBe(400);
  });

  // ── P1: cancelling twice ────────────────────────────────────────────────
  it('handles cancelling an already-cancelled booking cleanly (409, no crash, still cancelled)', async () => {
    const day = salonDateIn(26);
    const a = await book(tokenA, { service_id: shortService.id, staff_id: staffId, appointment_date: salonWallTimeToUtc(day, '10:00').toISOString() });
    expect(a.status).toBe(201);
    const id = a.body.appointment.id;
    const cancel = () => request(app).delete(`/api/appointments/${id}/cancel`).set('Authorization', `Bearer ${tokenA}`);

    expect((await cancel()).status).toBe(200);
    const second = await cancel();
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/already cancelled/i);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');
  });

  // ── P1: connection drops after submit, customer retries ─────────────────
  it('a retry with the same Idempotency-Key returns the original booking, not a duplicate', async () => {
    const day = salonDateIn(28);
    const body = { service_id: shortService.id, staff_id: staffId, appointment_date: salonWallTimeToUtc(day, '14:00').toISOString() };
    const key = `edge-${Date.now()}`;
    const send = () => request(app).post('/api/appointments/book')
      .set('Authorization', `Bearer ${tokenA}`).set('Idempotency-Key', key).send(body);

    const first = await send();
    expect(first.status).toBe(201);
    const retry = await send();
    expect(retry.status).toBe(200);
    expect(retry.body.appointment.id).toBe(first.body.appointment.id);
    expect(await prisma.appointment.count({ where: { staff_id: staffId, appointment_date: new Date(body.appointment_date) } })).toBe(1);
  });

  // ── P2: oversized input ─────────────────────────────────────────────────
  it('rejects oversized input with a 4xx, never a 500', async () => {
    const longName = await request(app).post('/api/auth/register')
      .send({ name: 'x'.repeat(10_000), email: `${PREFIX}long@example.com`, password: 'QaTest@2026!Secure' });
    expect(longName.status).toBe(400);

    const day = salonDateIn(27);
    const longNotes = await book(tokenA, {
      service_id: shortService.id, staff_id: staffId,
      appointment_date: salonWallTimeToUtc(day, '12:00').toISOString(), notes: 'n'.repeat(5_000),
    });
    expect(longNotes.status).toBe(400);

    const hugeBody = await request(app).post('/api/auth/register').set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'y'.repeat(300_000), email: 'x@example.com', password: 'x' }));
    expect(hugeBody.status).toBeGreaterThanOrEqual(400);
    expect(hugeBody.status).toBeLessThan(500);
  });
});

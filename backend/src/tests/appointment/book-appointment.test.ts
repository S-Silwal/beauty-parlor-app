import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../app';
import { prisma } from '../../config/database';

// See ../appointment.test.ts for basic happy-path booking coverage. This
// file covers the one behavior a real salon cannot ship without: the same
// slot cannot be double-booked, and a cancelled booking's slot really does
// free back up.
const TEST_EMAIL = 'book_overlap_test@example.com';
const TEST_PASSWORD = 'TestPass123!';

describe('POST /api/appointments/book', () => {
  let token: string;
  let serviceId: string;
  const appointmentIds: string[] = [];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    await request(app).post('/api/auth/register').send({
      name: 'Overlap Test User',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    await prisma.user.update({ where: { email: TEST_EMAIL }, data: { is_verified: true } });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    token = login.body.accessToken;

    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) throw new Error('No active service found — seed the database before running this test.');
    serviceId = service.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('rejects a booking that overlaps an existing appointment', async () => {
    const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    start.setHours(14, 0, 0, 0);

    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceId, appointment_date: start.toISOString() });

    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    // No staff selected on either request — an unassigned booking only
    // conflicts with other unassigned bookings (see assertSlotAvailable's
    // comment in appointment.service.ts) — same exact start time as above,
    // so this must be rejected as a genuine overlap.
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceId, appointment_date: start.toISOString() });

    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
  });

  // The test above proves overlap rejection works sequentially (book, then
  // try again). It does NOT prove the protection holds under a genuine
  // race — two requests hitting at effectively the same instant, which is
  // exactly the scenario the launch checklist calls out ("open two browser
  // sessions, race the same slot/staff/time"). Sequential requests can pass
  // even with no locking at all if the first one simply finishes before the
  // second starts; firing both with Promise.all is what actually exercises
  // runSerializable()'s Serializable-isolation transaction and its P2034
  // conflict handling in appointment.service.ts.
  it('allows exactly one booking to win when two requests race the same slot', async () => {
    const start = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
    start.setHours(16, 0, 0, 0);

    const [first, second] = await Promise.all([
      request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({ service_id: serviceId, appointment_date: start.toISOString() }),
      request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({ service_id: serviceId, appointment_date: start.toISOString() }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const winner = first.status === 201 ? first : second;
    appointmentIds.push(winner.body.appointment.id);

    // Confirm the database agrees with the HTTP responses — exactly one
    // non-cancelled appointment actually exists for this slot, not zero
    // and not two.
    const booked = await prisma.appointment.findMany({
      where: {
        appointment_date: start,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    expect(booked.length).toBe(1);
  });

  it('frees the slot again once the occupying appointment is cancelled', async () => {
    const start = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000);
    start.setHours(10, 0, 0, 0);

    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceId, appointment_date: start.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const cancel = await request(app)
      .delete(`/api/appointments/${first.body.appointment.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);

    // Same slot, now that the only occupant is CANCELLED — must succeed.
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceId, appointment_date: start.toISOString() });

    expect(second.status).toBe(201);
    appointmentIds.push(second.body.appointment.id);
  });
});


// ─────────────────────────────────────────────────────────────────────────
// Customer overlap enforcement — fixes the reported bug: the same customer
// held two active bookings (Classic Facial, Sep 19 12:00 PM) with two
// different staff members, one CONFIRMED and one PENDING. Root cause:
// assertSlotAvailable() in appointment.service.ts only ever compared
// staff_id, so two different staff (or two unassigned slots) let the same
// customer double-book themselves — the service/staff differing was
// irrelevant. These tests cover the fix directly, plus the idempotency /
// exact-duplicate guard and the confirm-time re-check added alongside it.
// ─────────────────────────────────────────────────────────────────────────
describe('Customer overlap enforcement (fixes: same customer double-booked across staff/services)', () => {
  const EMAIL = 'book_customer_overlap_test@example.com';
  let token: string;
  let serviceAId: string;
  let serviceBId: string;
  let staffAId: string;
  let staffBId: string;
  const appointmentIds: string[] = [];
  const staffIds: string[] = [];
  const serviceIds: string[] = [];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await request(app).post('/api/auth/register').send({
      name: 'Overlap Customer', email: EMAIL, password: TEST_PASSWORD,
    });
    await prisma.user.update({ where: { email: EMAIL }, data: { is_verified: true } });
    const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: TEST_PASSWORD });
    token = login.body.accessToken;

    const serviceA = await prisma.service.create({
      data: { name: `Overlap Test Facial ${Date.now()}`, category: 'FACIAL_SKINCARE', duration: 60, price: 100 },
    });
    serviceAId = serviceA.id;
    serviceIds.push(serviceAId);

    const serviceB = await prisma.service.create({
      data: { name: `Overlap Test Waxing ${Date.now()}`, category: 'WAXING', duration: 30, price: 40 },
    });
    serviceBId = serviceB.id;
    serviceIds.push(serviceBId);

    const staffA = await prisma.staff.create({ data: { name: `Overlap Stylist A ${Date.now()}` } });
    staffAId = staffA.id;
    staffIds.push(staffAId);

    const staffB = await prisma.staff.create({ data: { name: `Overlap Stylist B ${Date.now()}` } });
    staffBId = staffB.id;
    staffIds.push(staffBId);
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it('reproduces and rejects the reported bug: same customer, same time, two different staff + services', async () => {
    const start = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000);
    start.setHours(12, 0, 0, 0);

    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, staff_id: staffAId, appointment_date: start.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    // Different service, different staff, exact same start time — this is
    // precisely what slipped through before the fix.
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceBId, staff_id: staffBId, appointment_date: start.toISOString() });

    expect(second.status).toBe(409);
    expect(second.body.error).toBe('CUSTOMER_TIME_CONFLICT');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const active = await prisma.appointment.findMany({
      where: { user_id: user.id, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    expect(active.length).toBe(1);
  });

  it('allows back-to-back bookings where the first ends exactly when the second starts', async () => {
    const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    start.setHours(9, 0, 0, 0);

    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: start.toISOString() }); // 60-min duration
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const backToBackStart = new Date(start.getTime() + 60 * 60 * 1000); // exactly when the first ends
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceBId, appointment_date: backToBackStart.toISOString() });

    expect(second.status).toBe(201);
    appointmentIds.push(second.body.appointment.id);
  });

  it('blocks a second customer from booking the same staff member at an overlapping time (SLOT_UNAVAILABLE)', async () => {
    const OTHER_EMAIL = 'book_customer_overlap_test_2@example.com';
    await prisma.user.deleteMany({ where: { email: OTHER_EMAIL } });
    await request(app).post('/api/auth/register').send({
      name: 'Overlap Customer 2', email: OTHER_EMAIL, password: TEST_PASSWORD,
    });
    await prisma.user.update({ where: { email: OTHER_EMAIL }, data: { is_verified: true } });
    const login2 = await request(app).post('/api/auth/login').send({ email: OTHER_EMAIL, password: TEST_PASSWORD });
    const token2 = login2.body.accessToken;

    const start = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    start.setHours(11, 0, 0, 0);

    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, staff_id: staffAId, appointment_date: start.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token2}`)
      .send({ service_id: serviceBId, staff_id: staffAId, appointment_date: start.toISOString() });

    expect(second.status).toBe(409);
    expect(second.body.error).toBe('SLOT_UNAVAILABLE');

    await prisma.user.deleteMany({ where: { email: OTHER_EMAIL } });
  });

  it('rejects an exact duplicate submit (no Idempotency-Key) with 409 DUPLICATE_BOOKING and only one active row', async () => {
    const start = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);
    start.setHours(13, 0, 0, 0);

    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: start.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const dup = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: start.toISOString() });

    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('DUPLICATE_BOOKING');
  });

  it('returns the existing booking (200) on an exact duplicate submit WITH a matching Idempotency-Key', async () => {
    const start = new Date(Date.now() + 17 * 24 * 60 * 60 * 1000);
    start.setHours(15, 0, 0, 0);

    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'test-key-1')
      .send({ service_id: serviceAId, appointment_date: start.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const replay = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'test-key-1')
      .send({ service_id: serviceAId, appointment_date: start.toISOString() });

    expect(replay.status).toBe(200);
    expect(replay.body.appointment.id).toBe(first.body.appointment.id);

    const rows = await prisma.appointment.findMany({ where: { id: first.body.appointment.id } });
    expect(rows.length).toBe(1);
  });

  it('does not create a second CONFIRMED row when an admin confirms a PENDING booking', async () => {
    const ADMIN_EMAIL = 'book_overlap_confirm_admin@example.com';
    await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
    await request(app).post('/api/auth/register').send({
      name: 'Overlap Confirm Admin', email: ADMIN_EMAIL, password: TEST_PASSWORD,
    });
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { is_verified: true, role: 'ADMIN' } });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });
    const adminToken = adminLogin.body.accessToken;

    const start = new Date(Date.now() + 18 * 24 * 60 * 60 * 1000);
    start.setHours(10, 0, 0, 0);

    const booked = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: start.toISOString() });
    expect(booked.status).toBe(201);
    const appointmentId = booked.body.appointment.id;
    appointmentIds.push(appointmentId);

    const confirm = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    expect(confirm.status).toBe(200);
    expect(confirm.body.appointment.status).toBe('CONFIRMED');

    const rows = await prisma.appointment.findMany({
      where: { user_id: booked.body.appointment.user_id, appointment_date: start, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(appointmentId);

    await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  });

  it('resists a parallel double POST for the same customer across two different staff members', async () => {
    const start = new Date(Date.now() + 19 * 24 * 60 * 60 * 1000);
    start.setHours(14, 30, 0, 0);

    const [first, second] = await Promise.all([
      request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({ service_id: serviceAId, staff_id: staffAId, appointment_date: start.toISOString() }),
      request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({ service_id: serviceBId, staff_id: staffBId, appointment_date: start.toISOString() }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const winner = first.status === 201 ? first : second;
    appointmentIds.push(winner.body.appointment.id);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const active = await prisma.appointment.findMany({
      where: { user_id: user.id, appointment_date: start, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    expect(active.length).toBe(1);
  });
});


// ─────────────────────────────────────────────────────────────────────────
// Same-service-same-day duplicate guard — fixes the reported bug: the same
// customer held two PENDING "Anti-Ageing Facial" bookings with the same
// staff member on the same calendar day (12:30 PM and 2:30 PM), which
// assertSlotAvailable() never caught because the two time ranges don't
// overlap at all. See assertNoDuplicateServiceSameDay() in
// appointment.service.ts.
// ─────────────────────────────────────────────────────────────────────────
describe('Same-service-same-day duplicate guard (fixes: same customer double-booked same service, different times)', () => {
  const EMAIL = 'book_same_day_dup_test@example.com';
  let token: string;
  let serviceAId: string;
  let serviceBId: string;
  let staffAId: string;
  let staffBId: string;
  const appointmentIds: string[] = [];
  const staffIds: string[] = [];
  const serviceIds: string[] = [];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await request(app).post('/api/auth/register').send({
      name: 'Same Day Dup Customer', email: EMAIL, password: TEST_PASSWORD,
    });
    await prisma.user.update({ where: { email: EMAIL }, data: { is_verified: true } });
    const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: TEST_PASSWORD });
    token = login.body.accessToken;

    const serviceA = await prisma.service.create({
      data: { name: `Same Day Dup Facial ${Date.now()}`, category: 'FACIAL_SKINCARE', duration: 60, price: 140 },
    });
    serviceAId = serviceA.id;
    serviceIds.push(serviceAId);

    const serviceB = await prisma.service.create({
      data: { name: `Same Day Dup Waxing ${Date.now()}`, category: 'WAXING', duration: 30, price: 75 },
    });
    serviceBId = serviceB.id;
    serviceIds.push(serviceBId);

    const staffA = await prisma.staff.create({ data: { name: `Same Day Dup Stylist A ${Date.now()}` } });
    staffAId = staffA.id;
    staffIds.push(staffAId);

    const staffB = await prisma.staff.create({ data: { name: `Same Day Dup Stylist B ${Date.now()}` } });
    staffBId = staffB.id;
    staffIds.push(staffBId);
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it('rejects the exact reported bug: same customer, same service, same staff, same day, different times → 409 DUPLICATE_SERVICE_SAME_DAY', async () => {
    const day = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);

    const morning = new Date(day);
    morning.setHours(9, 0, 0, 0);
    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, staff_id: staffAId, appointment_date: morning.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const afternoon = new Date(day);
    afternoon.setHours(14, 0, 0, 0);
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, staff_id: staffAId, appointment_date: afternoon.toISOString() });

    expect(second.status).toBe(409);
    expect(second.body.error).toBe('DUPLICATE_SERVICE_SAME_DAY');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const active = await prisma.appointment.findMany({
      where: { user_id: user.id, service_id: serviceAId, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    expect(active.length).toBe(1);
  });

  it('also rejects when the second booking uses a DIFFERENT staff member — the match is intentionally staff-agnostic', async () => {
    const day = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);

    const morning = new Date(day);
    morning.setHours(9, 0, 0, 0);
    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, staff_id: staffAId, appointment_date: morning.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const afternoon = new Date(day);
    afternoon.setHours(14, 0, 0, 0);
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, staff_id: staffBId, appointment_date: afternoon.toISOString() });

    expect(second.status).toBe(409);
    expect(second.body.error).toBe('DUPLICATE_SERVICE_SAME_DAY');
  });

  it('allows a different service on the same day (facial + wax is fine)', async () => {
    const day = new Date(Date.now() + 22 * 24 * 60 * 60 * 1000);

    const morning = new Date(day);
    morning.setHours(9, 0, 0, 0);
    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: morning.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const afternoon = new Date(day);
    afternoon.setHours(14, 0, 0, 0);
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceBId, appointment_date: afternoon.toISOString() });

    expect(second.status).toBe(201);
    appointmentIds.push(second.body.appointment.id);
  });

  it('allows re-booking the same service the same day once the first one is cancelled', async () => {
    const day = new Date(Date.now() + 23 * 24 * 60 * 60 * 1000);

    const morning = new Date(day);
    morning.setHours(9, 0, 0, 0);
    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: morning.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    const cancel = await request(app)
      .delete(`/api/appointments/${first.body.appointment.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);

    const afternoon = new Date(day);
    afternoon.setHours(14, 0, 0, 0);
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: afternoon.toISOString() });

    expect(second.status).toBe(201);
    appointmentIds.push(second.body.appointment.id);
  });

  it('resists a parallel double POST for the same customer+service on the same day at different times', async () => {
    const day = new Date(Date.now() + 24 * 24 * 60 * 60 * 1000);

    const morning = new Date(day);
    morning.setHours(9, 0, 0, 0);
    const afternoon = new Date(day);
    afternoon.setHours(15, 0, 0, 0);

    const [first, second] = await Promise.all([
      request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({ service_id: serviceAId, staff_id: staffAId, appointment_date: morning.toISOString() }),
      request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({ service_id: serviceAId, staff_id: staffBId, appointment_date: afternoon.toISOString() }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const winner = first.status === 201 ? first : second;
    appointmentIds.push(winner.body.appointment.id);

    const loser = first.status === 201 ? second : first;
    expect(loser.body.error).toBe('DUPLICATE_SERVICE_SAME_DAY');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const active = await prisma.appointment.findMany({
      where: { user_id: user.id, service_id: serviceAId, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    expect(active.length).toBe(1);
  });

  it('still rejects an identical-time overlap exactly as before — the new same-day rule does not replace it', async () => {
    const day = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
    const start = new Date(day);
    start.setHours(11, 0, 0, 0);

    const first = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, staff_id: staffAId, appointment_date: start.toISOString() });
    expect(first.status).toBe(201);
    appointmentIds.push(first.body.appointment.id);

    // Different service, same exact instant — the pre-existing time-overlap
    // check (CUSTOMER_TIME_CONFLICT) must still fire; this isn't a
    // same-service case so DUPLICATE_SERVICE_SAME_DAY must NOT be what
    // rejects it.
    const second = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceBId, staff_id: staffBId, appointment_date: start.toISOString() });

    expect(second.status).toBe(409);
    expect(second.body.error).toBe('CUSTOMER_TIME_CONFLICT');
  });

  it('rejects rescheduling a booking into a day where the same service is already booked at a different time', async () => {
    const dayA = new Date(Date.now() + 26 * 24 * 60 * 60 * 1000);
    dayA.setHours(9, 0, 0, 0);
    const dayB = new Date(Date.now() + 27 * 24 * 60 * 60 * 1000);
    dayB.setHours(9, 0, 0, 0);

    const bookingOnDayA = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: dayA.toISOString() });
    expect(bookingOnDayA.status).toBe(201);
    appointmentIds.push(bookingOnDayA.body.appointment.id);

    const bookingOnDayB = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceAId, appointment_date: dayB.toISOString() });
    expect(bookingOnDayB.status).toBe(201);
    appointmentIds.push(bookingOnDayB.body.appointment.id);

    // Reschedule the day-B booking to a different TIME on day A — still a
    // duplicate of the day-A booking's service, even though the clock time
    // doesn't match it.
    const newTimeOnDayA = new Date(dayA);
    newTimeOnDayA.setHours(16, 0, 0, 0);
    const reschedule = await request(app)
      .patch(`/api/appointments/${bookingOnDayB.body.appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ appointment_date: newTimeOnDayA.toISOString() });

    expect(reschedule.status).toBe(409);
    expect(reschedule.body.error).toBe('DUPLICATE_SERVICE_SAME_DAY');

    // The booking being rescheduled must be untouched — still on day B.
    const unchanged = await prisma.appointment.findUniqueOrThrow({
      where: { id: bookingOnDayB.body.appointment.id },
    });
    expect(unchanged.appointment_date.toISOString().slice(0, 10)).toBe(dayB.toISOString().slice(0, 10));
  });
});

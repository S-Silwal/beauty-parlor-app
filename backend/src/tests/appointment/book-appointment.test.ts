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

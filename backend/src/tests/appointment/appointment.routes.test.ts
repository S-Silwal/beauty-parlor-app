import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../app';
import { prisma } from '../../config/database';

// Covers the appointment routes no other test file exercises: the two
// public GET routes (staff list, available slots) and PATCH .../reschedule.
// POST /book, DELETE /:id/cancel, GET /services, and the admin/staff and
// change-request routes already have dedicated coverage in
// appointment.test.ts, book-appointment.test.ts, cancel-appointment.test.ts,
// staff-scoping.test.ts, and changeRequest.test.ts respectively — this file
// is deliberately a wiring check (route -> middleware -> controller
// actually connects and returns the right shape), not a re-test of business
// rules those files already own.
const TEST_EMAIL = 'route_wiring_test@example.com';
const PASSWORD = 'TestPass123!';

function futureDateOnly(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('Appointment routes', () => {
  let token: string;
  let serviceId: string;
  let appointmentId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    await request(app).post('/api/auth/register').send({
      name: 'Route Wiring Test',
      email: TEST_EMAIL,
      password: PASSWORD,
    });
    await prisma.user.update({ where: { email: TEST_EMAIL }, data: { is_verified: true } });

    const login = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: PASSWORD });
    token = login.body.accessToken;

    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) throw new Error('No active service found — seed the database before running this test.');
    serviceId = service.id;

    const start = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    start.setHours(9, 0, 0, 0);
    const booked = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_id: serviceId, appointment_date: start.toISOString() });
    appointmentId = booked.body.appointment.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('GET /api/appointments/staff returns the staff list without requiring auth', async () => {
    const res = await request(app).get('/api/appointments/staff');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.staff)).toBe(true);
  });

  it('GET /api/appointments/available-slots returns slots for a valid date', async () => {
    const res = await request(app)
      .get('/api/appointments/available-slots')
      .query({ date: futureDateOnly(5), service_id: serviceId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /api/appointments/available-slots rejects a malformed date', async () => {
    const res = await request(app)
      .get('/api/appointments/available-slots')
      .query({ date: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/appointments/:id/reschedule requires authentication', async () => {
    const newDate = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/reschedule`)
      .send({ appointment_date: newDate });

    expect(res.status).toBe(401);
  });

  it('PATCH /api/appointments/:id/reschedule moves an owned appointment to a new time', async () => {
    const newDate = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);
    newDate.setHours(15, 0, 0, 0);

    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ appointment_date: newDate.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(new Date(res.body.appointment.appointment_date).getTime()).toBe(newDate.getTime());
  });
});

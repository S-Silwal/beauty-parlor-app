import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../app';
import { prisma } from '../../config/database';

const USER_A_EMAIL = 'my_appointments_user_a@example.com';
const USER_B_EMAIL = 'my_appointments_user_b@example.com';
const PASSWORD = 'TestPass123!';

describe('GET /api/appointments/my-bookings', () => {
  let tokenA: string;
  const appointmentIds: string[] = [];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [USER_A_EMAIL, USER_B_EMAIL] } } });

    for (const email of [USER_A_EMAIL, USER_B_EMAIL]) {
      await request(app).post('/api/auth/register').send({
        name: 'My Appointments Test',
        email,
        password: PASSWORD,
      });
      await prisma.user.update({ where: { email }, data: { is_verified: true } });
    }

    const loginA = await request(app).post('/api/auth/login').send({ email: USER_A_EMAIL, password: PASSWORD });
    tokenA = loginA.body.accessToken;
    const loginB = await request(app).post('/api/auth/login').send({ email: USER_B_EMAIL, password: PASSWORD });
    const tokenB = loginB.body.accessToken;

    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) throw new Error('No active service found — seed the database before running this test.');
    const serviceId = service.id;

    const startA = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    startA.setHours(11, 0, 0, 0);
    const bookA = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ service_id: serviceId, appointment_date: startA.toISOString() });
    appointmentIds.push(bookA.body.appointment.id);

    const startB = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    startB.setHours(13, 0, 0, 0);
    const bookB = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ service_id: serviceId, appointment_date: startB.toISOString() });
    appointmentIds.push(bookB.body.appointment.id);
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [USER_A_EMAIL, USER_B_EMAIL] } } });
  });

  it("returns only the caller's own appointments", async () => {
    const res = await request(app)
      .get('/api/appointments/my-bookings')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.appointments)).toBe(true);

    const ids = res.body.appointments.map((a: { id: string }) => a.id);
    expect(ids).toContain(appointmentIds[0]); // user A's own booking
    expect(ids).not.toContain(appointmentIds[1]); // user B's booking must never leak through
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/appointments/my-bookings');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

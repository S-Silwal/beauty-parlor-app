import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

const TEST_EMAIL = 'appt_test@example.com';
const TEST_PASSWORD = 'TestPass123!'; // must satisfy the app's password policy

describe('Appointment API Tests', () => {
  let token: string;
  let serviceId: string;
  let createdAppointmentId: string | undefined;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    await request(app).post('/api/auth/register').send({
      name: 'Appointment Test User',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    // Registration leaves the account unverified — simulate the
    // verification step directly, same as auth.test.ts.
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
    if (createdAppointmentId) {
      await prisma.appointment.deleteMany({ where: { id: createdAppointmentId } });
    }
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('should get all services', async () => {
    const res = await request(app).get('/api/appointments/services');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.services)).toBe(true);
  });

  it('should book an appointment', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    futureDate.setHours(11, 0, 0, 0);

    const res = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({
        service_id: serviceId,
        appointment_date: futureDate.toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdAppointmentId = res.body.appointment?.id;
  });
});

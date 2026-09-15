import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../app';
import { prisma } from '../../config/database';
import { AppointmentStatus } from '@prisma/client';

const OWNER_EMAIL = 'cancel_owner_test@example.com';
const OTHER_EMAIL = 'cancel_other_test@example.com';
const PASSWORD = 'TestPass123!';

describe('DELETE /api/appointments/:id/cancel', () => {
  let ownerToken: string;
  let otherToken: string;
  let serviceId: string;
  let ownerId: string;
  const appointmentIds: string[] = [];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });

    await request(app).post('/api/auth/register').send({ name: 'Owner', email: OWNER_EMAIL, password: PASSWORD });
    await request(app).post('/api/auth/register').send({ name: 'Other', email: OTHER_EMAIL, password: PASSWORD });
    await prisma.user.updateMany({
      where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } },
      data: { is_verified: true },
    });

    const ownerLogin = await request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: PASSWORD });
    ownerToken = ownerLogin.body.accessToken;
    const otherLogin = await request(app).post('/api/auth/login').send({ email: OTHER_EMAIL, password: PASSWORD });
    otherToken = otherLogin.body.accessToken;

    const owner = await prisma.user.findUniqueOrThrow({ where: { email: OWNER_EMAIL } });
    ownerId = owner.id;

    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) throw new Error('No active service found — seed the database before running this test.');
    serviceId = service.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });
  });

  // Created directly via Prisma (rather than through the booking API) so
  // each test controls exactly how far away the appointment is — that's
  // what the cutoff test below needs, and createAppointmentSchema only
  // requires "in the future", not "outside the cutoff", at booking time.
  async function createAppointment(hoursFromNow: number, status: AppointmentStatus = 'CONFIRMED') {
    const appointment_date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const appt = await prisma.appointment.create({
      data: {
        user_id: ownerId,
        service_id: serviceId,
        appointment_date,
        duration: 30,
        total_price: 50,
        status,
      },
    });
    appointmentIds.push(appt.id);
    return appt;
  }

  it('cancels a PENDING/CONFIRMED appointment owned by the caller', async () => {
    const appt = await createAppointment(72); // 3 days out — outside the cutoff
    const res = await request(app)
      .delete(`/api/appointments/${appt.id}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('CANCELLED');
  });

  it("rejects cancelling another user's appointment", async () => {
    const appt = await createAppointment(72);
    const res = await request(app)
      .delete(`/api/appointments/${appt.id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects cancelling an already-cancelled or completed appointment', async () => {
    const appt = await createAppointment(72, 'CANCELLED');
    const res = await request(app)
      .delete(`/api/appointments/${appt.id}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(409);
  });

  it('rejects cancelling inside the minimum-notice cutoff window', async () => {
    const appt = await createAppointment(0.5); // 30 minutes out — inside the 2h cutoff
    const res = await request(app)
      .delete(`/api/appointments/${appt.id}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('advance');
  });
});

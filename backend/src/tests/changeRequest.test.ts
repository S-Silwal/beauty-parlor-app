import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

// Covers the fix for the "change-request bypass" weakness: the change-
// request/admin-approval flow used to apply the exact same cutoff-window
// rule as the direct self-service cancel/reschedule endpoints, so it never
// did anything the direct endpoints couldn't already do faster and without
// approval — an admin's review was always avoidable. Direct endpoints are
// now the canonical path outside the cutoff; the change-request flow is
// scoped to the two things they genuinely can't do: an appointment too
// close to start (see isInsideCutoff) and a service change (reschedule only
// ever touches date/staff/notes).
const OWNER_EMAIL = 'changereq_owner_test@example.com';
const PASSWORD = 'TestPass123!';

describe('Change-request eligibility', () => {
  let token: string;
  let ownerId: string;
  let serviceId: string;
  let otherServiceId: string;
  const appointmentIds: string[] = [];
  const changeRequestIds: string[] = [];

  async function createAppointment(hoursFromNow: number) {
    const appt = await prisma.appointment.create({
      data: {
        user_id: ownerId,
        service_id: serviceId,
        appointment_date: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
        duration: 30,
        total_price: 50,
        status: 'CONFIRMED',
      },
    });
    appointmentIds.push(appt.id);
    return appt.id;
  }

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: OWNER_EMAIL } });
    await request(app).post('/api/auth/register').send({ name: 'Change Req Owner', email: OWNER_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: OWNER_EMAIL }, data: { is_verified: true } });
    const login = await request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: PASSWORD });
    token = login.body.accessToken;
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: OWNER_EMAIL } });
    ownerId = owner.id;

    const services = await prisma.service.findMany({ where: { isActive: true }, take: 2 });
    if (services.length < 2) throw new Error('Need at least two active services seeded to run this test.');
    serviceId = services[0].id;
    otherServiceId = services[1].id;
  });

  afterAll(async () => {
    await prisma.appointmentChangeRequest.deleteMany({ where: { id: { in: changeRequestIds } } });
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.user.deleteMany({ where: { email: OWNER_EMAIL } });
  });

  it('rejects a cancel request for a booking far enough out to cancel directly', async () => {
    const appt = await createAppointment(72); // 3 days out — outside the cutoff
    const res = await request(app)
      .post(`/api/appointments/${appt}/request-cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/instantly/i);
  });

  it('allows a cancel request for a booking inside the cutoff window', async () => {
    const appt = await createAppointment(0.5); // 30 minutes out
    const res = await request(app)
      .post(`/api/appointments/${appt}/request-cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    changeRequestIds.push(res.body.request.id);
  });

  it('rejects a date-only edit request for a booking far enough out to reschedule directly', async () => {
    const appt = await createAppointment(72);
    const res = await request(app)
      .post(`/api/appointments/${appt}/request-edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requested_date: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString() });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/instantly/i);
  });

  it('allows a service-change edit request regardless of how far out the booking is', async () => {
    // A distinct offset from the other 72h-out fixtures above — those are
    // also staff_id: null, and assertSlotAvailable pools all unassigned
    // bookings into one shared-slot check, so reusing 72 here would make
    // this request collide with their still-CONFIRMED leftovers and 409
    // for an unrelated reason (slot conflict, not cutoff/service-change
    // eligibility, which is what this test actually verifies).
    const appt = await createAppointment(80); // outside the cutoff — reschedule can't do this anyway
    const res = await request(app)
      .post(`/api/appointments/${appt}/request-edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requested_service_id: otherServiceId });

    expect(res.status).toBe(201);
    changeRequestIds.push(res.body.request.id);
  });

  it('allows a date-only edit request for a booking inside the cutoff window', async () => {
    const appt = await createAppointment(0.5);
    const res = await request(app)
      .post(`/api/appointments/${appt}/request-edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requested_date: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() });

    expect(res.status).toBe(201);
    changeRequestIds.push(res.body.request.id);
  });
});

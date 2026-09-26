import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

// Covers the customer-edit/cancel request flow. This used to apply the
// same cutoff-window rule as the direct self-service cancel/reschedule
// endpoints (rejecting a request whenever the direct endpoint could do the
// same thing faster) — but a customer's own dashboard action must NEVER
// mutate the live booking directly: it always creates a PENDING
// AppointmentChangeRequest and leaves the booking on its original
// slot/status until an admin approves it, however far away the
// appointment is. See ChangeRequestService.requestEdit/requestCancel. The
// direct PATCH /:id/reschedule and DELETE /:id/cancel endpoints still
// exist in the service layer (e.g. for a possible future admin-direct-
// reschedule action) but nothing in this request/approval flow depends on
// them anymore.
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

  // Each test's fixtures are removed as soon as it finishes. They're all
  // created directly (bypassing the booking service) for the same customer
  // + service at hour offsets, and several land on the same calendar day
  // (e.g. two 0.5h-out bookings, or 72h/73h/80h) — which the
  // appointments_customer_service_active_day_unique index now rejects.
  // Clearing them per test keeps every test independent of that rule.
  afterEach(async () => {
    await prisma.appointmentChangeRequest.deleteMany({ where: { id: { in: changeRequestIds.splice(0) } } });
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: OWNER_EMAIL } });
  });

  it('allows a cancel request for a booking far enough out that the direct endpoint could also cancel it', async () => {
    const appt = await createAppointment(72); // 3 days out
    const res = await request(app)
      .post(`/api/appointments/${appt}/request-cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    changeRequestIds.push(res.body.request.id);

    // The live booking must be untouched — still CONFIRMED, still on its
    // original slot — until an admin actually approves this request.
    const unchanged = await prisma.appointment.findUniqueOrThrow({ where: { id: appt } });
    expect(unchanged.status).toBe('CONFIRMED');
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

  it('allows a date-only edit request for a booking far enough out that the direct endpoint could also reschedule it', async () => {
    const appt = await createAppointment(73);
    const requestedDate = new Date(Date.now() + 96 * 60 * 60 * 1000);
    const res = await request(app)
      .post(`/api/appointments/${appt}/request-edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requested_date: requestedDate.toISOString() });

    expect(res.status).toBe(201);
    changeRequestIds.push(res.body.request.id);

    // The live booking must stay exactly where it was — same date, still
    // CONFIRMED — this is only a proposal until an admin approves it.
    const unchanged = await prisma.appointment.findUniqueOrThrow({ where: { id: appt } });
    expect(unchanged.status).toBe('CONFIRMED');
    expect(unchanged.appointment_date.getTime()).not.toBe(requestedDate.getTime());
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


// ─────────────────────────────────────────────────────────────────────────
// Approval / withdrawal — an approved edit must apply the new slot without
// ever writing RESCHEDULED (that status is reserved for a direct admin
// reschedule from the Bookings tab, a separate code path), and a customer
// must be able to pull back their own still-pending request.
// ─────────────────────────────────────────────────────────────────────────
describe('Change-request approval and withdrawal', () => {
  const OWNER_EMAIL = 'changereq_resolve_owner@example.com';
  const ADMIN_EMAIL = 'changereq_resolve_admin@example.com';
  const PASSWORD = 'TestPass123!';

  let token: string;
  let adminToken: string;
  let ownerId: string;
  let serviceId: string;
  const appointmentIds: string[] = [];
  const changeRequestIds: string[] = [];

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, ADMIN_EMAIL] } } });

    await request(app).post('/api/auth/register').send({ name: 'Resolve Owner', email: OWNER_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: OWNER_EMAIL }, data: { is_verified: true } });
    const login = await request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: PASSWORD });
    token = login.body.accessToken;
    ownerId = (await prisma.user.findUniqueOrThrow({ where: { email: OWNER_EMAIL } })).id;

    await request(app).post('/api/auth/register').send({ name: 'Resolve Admin', email: ADMIN_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { is_verified: true, role: 'ADMIN' } });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) throw new Error('No active service found — seed the database before running this test.');
    serviceId = service.id;
  });

  // Per-test fixture cleanup — same reason as the eligibility suite above
  // (e.g. the 50h and 60h fixtures can share a calendar day).
  afterEach(async () => {
    await prisma.appointmentChangeRequest.deleteMany({ where: { id: { in: changeRequestIds.splice(0) } } });
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, ADMIN_EMAIL] } } });
  });

  async function createAppointment(hoursFromNow: number, status: 'PENDING' | 'CONFIRMED' = 'CONFIRMED') {
    const appt = await prisma.appointment.create({
      data: {
        user_id: ownerId,
        service_id: serviceId,
        appointment_date: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
        duration: 30,
        total_price: 50,
        status,
      },
    });
    appointmentIds.push(appt.id);
    return appt.id;
  }

  it('applies the new slot and marks the booking CONFIRMED (not RESCHEDULED) once an admin approves an edit', async () => {
    const appt = await createAppointment(100, 'PENDING');
    const requestedDate = new Date(Date.now() + 120 * 60 * 60 * 1000);

    const submitted = await request(app)
      .post(`/api/appointments/${appt}/request-edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requested_date: requestedDate.toISOString() });
    expect(submitted.status).toBe(201);
    const requestId = submitted.body.request.id;
    changeRequestIds.push(requestId);

    const resolved = await request(app)
      .patch(`/api/appointments/change-requests/${requestId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED' });
    expect(resolved.status).toBe(200);

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appt } });
    expect(updated.status).toBe('CONFIRMED');
    expect(updated.appointment_date.getTime()).toBe(requestedDate.getTime());
  });

  it('lets a customer withdraw their own pending request, freeing the booking up for a new one', async () => {
    const appt = await createAppointment(50);

    const submitted = await request(app)
      .post(`/api/appointments/${appt}/request-cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(submitted.status).toBe(201);
    const requestId = submitted.body.request.id;
    changeRequestIds.push(requestId);

    const withdrawn = await request(app)
      .delete(`/api/appointments/change-requests/${requestId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.request.status).toBe('WITHDRAWN');

    // The booking itself was never touched by the now-withdrawn request.
    const stillActive = await prisma.appointment.findUniqueOrThrow({ where: { id: appt } });
    expect(stillActive.status).toBe('CONFIRMED');

    // With no PENDING request left, a new one can be submitted for the
    // same booking (the "one live request at a time" guard only blocks
    // while a request is actually PENDING).
    const secondSubmit = await request(app)
      .post(`/api/appointments/${appt}/request-cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(secondSubmit.status).toBe(201);
    changeRequestIds.push(secondSubmit.body.request.id);
  });

  it('rejects withdrawing a request that has already been resolved', async () => {
    const appt = await createAppointment(60);

    const submitted = await request(app)
      .post(`/api/appointments/${appt}/request-cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(submitted.status).toBe(201);
    const requestId = submitted.body.request.id;
    changeRequestIds.push(requestId);

    const resolved = await request(app)
      .patch(`/api/appointments/change-requests/${requestId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'DECLINED', decline_reason: 'Testing' });
    expect(resolved.status).toBe(200);

    const withdrawAttempt = await request(app)
      .delete(`/api/appointments/change-requests/${requestId}/withdraw`)
      .set('Authorization', `Bearer ${token}`);
    expect(withdrawAttempt.status).toBe(409);
  });
});

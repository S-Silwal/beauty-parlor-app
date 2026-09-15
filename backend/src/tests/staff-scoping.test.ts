import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

// Covers the fix for the "staff scoping" weakness: a STAFF-role login used
// to see and act on every appointment/change-request in the system, exactly
// like ADMIN, because nothing linked a User account to a Staff row. This
// verifies a STAFF caller is now scoped to only their own assigned bookings,
// that ADMIN keeps its unrestricted view, and that an unlinked STAFF account
// is rejected rather than silently shown everything or nothing.
const ADMIN_EMAIL = 'scoping_admin@example.com';
const CUSTOMER_EMAIL = 'scoping_customer@example.com';
const STAFF_A_EMAIL = 'scoping_staff_a@example.com';
const STAFF_B_EMAIL = 'scoping_staff_b@example.com';
const UNLINKED_STAFF_EMAIL = 'scoping_staff_unlinked@example.com';
const PASSWORD = 'TestPass123!';

describe('Staff data scoping', () => {
  let adminToken: string;
  let customerToken: string;
  let customerId: string;
  let staffAToken: string;
  let staffBToken: string;
  let unlinkedStaffToken: string;

  let staffAId: string;
  let staffBId: string;
  let serviceId: string;

  let apptA: string; // assigned to staff A
  let apptB: string; // assigned to staff B
  const staffRecordIds: string[] = [];
  const appointmentIds: string[] = [];
  const changeRequestIds: string[] = [];

  async function registerAndLogin(name: string, email: string) {
    await request(app).post('/api/auth/register').send({ name, email, password: PASSWORD });
    await prisma.user.update({ where: { email }, data: { is_verified: true } });
    const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    return login.body.accessToken as string;
  }

  async function createAppointment(staffId: string | null, hoursFromNow: number) {
    const appt = await prisma.appointment.create({
      data: {
        user_id: customerId,
        service_id: serviceId,
        staff_id: staffId,
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
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL, STAFF_A_EMAIL, STAFF_B_EMAIL, UNLINKED_STAFF_EMAIL] } },
    });

    await request(app).post('/api/auth/register').send({ name: 'Scoping Admin', email: ADMIN_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { is_verified: true, role: 'ADMIN' } });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    customerToken = await registerAndLogin('Scoping Customer', CUSTOMER_EMAIL);
    const customer = await prisma.user.findUniqueOrThrow({ where: { email: CUSTOMER_EMAIL } });
    customerId = customer.id;

    // Two staff logins, each linked to their own Staff row via the admin API
    // (this is the exact path a real admin would use).
    await request(app).post('/api/auth/register').send({ name: 'Staff A Login', email: STAFF_A_EMAIL, password: PASSWORD });
    const staffAUser = await prisma.user.update({ where: { email: STAFF_A_EMAIL }, data: { is_verified: true } });
    const staffACreate = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Scoping Stylist A ${Date.now()}`, user_id: staffAUser.id });
    staffAId = staffACreate.body.staff.id;
    staffRecordIds.push(staffAId);
    const staffALogin = await request(app).post('/api/auth/login').send({ email: STAFF_A_EMAIL, password: PASSWORD });
    staffAToken = staffALogin.body.accessToken;

    await request(app).post('/api/auth/register').send({ name: 'Staff B Login', email: STAFF_B_EMAIL, password: PASSWORD });
    const staffBUser = await prisma.user.update({ where: { email: STAFF_B_EMAIL }, data: { is_verified: true } });
    const staffBCreate = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Scoping Stylist B ${Date.now()}`, user_id: staffBUser.id });
    staffBId = staffBCreate.body.staff.id;
    staffRecordIds.push(staffBId);
    const staffBLogin = await request(app).post('/api/auth/login').send({ email: STAFF_B_EMAIL, password: PASSWORD });
    staffBToken = staffBLogin.body.accessToken;

    // A STAFF-role account with no linked Staff row — simulates the role
    // being set (e.g. by hand, or a future admin flow) without ever going
    // through the staff-linking step.
    unlinkedStaffToken = await registerAndLogin('Unlinked Staff', UNLINKED_STAFF_EMAIL);
    await prisma.user.update({ where: { email: UNLINKED_STAFF_EMAIL }, data: { role: 'STAFF' } });
    const relog = await request(app).post('/api/auth/login').send({ email: UNLINKED_STAFF_EMAIL, password: PASSWORD });
    unlinkedStaffToken = relog.body.accessToken;

    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) throw new Error('No active service found — seed the database before running this test.');
    serviceId = service.id;

    apptA = await createAppointment(staffAId, 72); // outside cutoff
    apptB = await createAppointment(staffBId, 0.5); // inside cutoff — used for the change-request tests below
  });

  afterAll(async () => {
    await prisma.appointmentChangeRequest.deleteMany({ where: { id: { in: changeRequestIds } } });
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.staff.deleteMany({ where: { id: { in: staffRecordIds } } });
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL, STAFF_A_EMAIL, STAFF_B_EMAIL, UNLINKED_STAFF_EMAIL] } },
    });
  });

  it("scopes GET /api/appointments/all to only the caller's own assigned bookings for STAFF", async () => {
    const res = await request(app)
      .get('/api/appointments/all')
      .set('Authorization', `Bearer ${staffAToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.appointments.map((a: { id: string }) => a.id);
    expect(ids).toContain(apptA);
    expect(ids).not.toContain(apptB);
  });

  it('keeps GET /api/appointments/all unrestricted for ADMIN', async () => {
    const res = await request(app)
      .get('/api/appointments/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.appointments.map((a: { id: string }) => a.id);
    expect(ids).toContain(apptA);
    expect(ids).toContain(apptB);
  });

  it('rejects a STAFF account with no linked staff profile', async () => {
    const res = await request(app)
      .get('/api/appointments/all')
      .set('Authorization', `Bearer ${unlinkedStaffToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/linked to a staff profile/i);
  });

  it("rejects a staff member updating another staff member's appointment", async () => {
    const res = await request(app)
      .patch(`/api/appointments/${apptB}/status`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ status: 'CHECKED_IN' });

    expect(res.status).toBe(403);
  });

  it('allows a staff member to update their own assigned appointment', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${apptA}/status`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ status: 'CHECKED_IN' });

    expect(res.status).toBe(200);
  });

  describe('change-request scoping', () => {
    let requestOnApptB: string;

    beforeAll(async () => {
      // apptB is 30 minutes out — inside the cutoff — so a cancellation
      // request is exactly the edge case the change-request flow now
      // exists for (see changeRequest.service.ts).
      const res = await request(app)
        .post(`/api/appointments/${apptB}/request-cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Need to reschedule last-minute' });

      expect(res.status).toBe(201);
      requestOnApptB = res.body.request.id;
      changeRequestIds.push(requestOnApptB);
    });

    it("excludes another staff member's pending change requests", async () => {
      const res = await request(app)
        .get('/api/appointments/change-requests/pending')
        .set('Authorization', `Bearer ${staffAToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.requests.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(requestOnApptB);
    });

    it('includes it for the assigned staff member', async () => {
      const res = await request(app)
        .get('/api/appointments/change-requests/pending')
        .set('Authorization', `Bearer ${staffBToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.requests.map((r: { id: string }) => r.id);
      expect(ids).toContain(requestOnApptB);
    });

    it("rejects another staff member resolving it", async () => {
      const res = await request(app)
        .patch(`/api/appointments/change-requests/${requestOnApptB}/resolve`)
        .set('Authorization', `Bearer ${staffAToken}`)
        .send({ decision: 'APPROVED' });

      expect(res.status).toBe(403);
    });

    it('lets the assigned staff member resolve it', async () => {
      const res = await request(app)
        .patch(`/api/appointments/change-requests/${requestOnApptB}/resolve`)
        .set('Authorization', `Bearer ${staffBToken}`)
        .send({ decision: 'APPROVED' });

      expect(res.status).toBe(200);
    });
  });
});

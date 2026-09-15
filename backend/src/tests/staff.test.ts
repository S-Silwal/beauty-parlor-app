import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

const ADMIN_EMAIL = 'staff_test_admin@example.com';
const CUSTOMER_EMAIL = 'staff_test_customer@example.com';
const LINKABLE_EMAIL = 'staff_test_linkable@example.com';
const PASSWORD = 'TestPass123!';
const STAFF_NAME = `Test Stylist ${Date.now()}`;

describe('Staff API Tests', () => {
  let adminToken: string;
  let adminUserId: string;
  let customerToken: string;
  let linkableUserId: string;
  let createdStaffId: string;
  let linkedStaffId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL, LINKABLE_EMAIL] } } });

    await request(app).post('/api/auth/register').send({ name: 'Staff Admin', email: ADMIN_EMAIL, password: PASSWORD });
    const admin = await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { is_verified: true, role: 'ADMIN' } });
    adminUserId = admin.id;
    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    await request(app).post('/api/auth/register').send({ name: 'Staff Customer', email: CUSTOMER_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: CUSTOMER_EMAIL }, data: { is_verified: true } });
    const customerLogin = await request(app).post('/api/auth/login').send({ email: CUSTOMER_EMAIL, password: PASSWORD });
    customerToken = customerLogin.body.accessToken;

    await request(app).post('/api/auth/register').send({ name: 'Linkable Person', email: LINKABLE_EMAIL, password: PASSWORD });
    const linkable = await prisma.user.update({ where: { email: LINKABLE_EMAIL }, data: { is_verified: true } });
    linkableUserId = linkable.id;
  });

  afterAll(async () => {
    if (createdStaffId) {
      await prisma.staff.deleteMany({ where: { id: createdStaffId } });
    }
    if (linkedStaffId) {
      await prisma.staff.deleteMany({ where: { id: linkedStaffId } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL, LINKABLE_EMAIL] } } });
  });

  it('lists staff publicly without auth', async () => {
    const res = await request(app).get('/api/staff');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.staff)).toBe(true);
  });

  it('rejects creating a staff member without a token', async () => {
    const res = await request(app).post('/api/staff').send({ name: STAFF_NAME });

    expect(res.status).toBe(401);
  });

  it('rejects creating a staff member as a non-admin', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: STAFF_NAME });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid staff payload from an admin', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation Error');
  });

  it('creates a staff member as an admin', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: STAFF_NAME, specialization: 'Hair Styling' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.staff.name).toBe(STAFF_NAME);
    createdStaffId = res.body.staff.id;
  });

  it('updates a staff member as an admin', async () => {
    const res = await request(app)
      .patch(`/api/staff/${createdStaffId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ specialization: 'Color Specialist' });

    expect(res.status).toBe(200);
    expect(res.body.staff.specialization).toBe('Color Specialist');
  });

  it('returns 404 when updating a non-existent staff member', async () => {
    const res = await request(app)
      .patch('/api/staff/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ specialization: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('rejects linking an admin account as a staff member', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Should Fail ${Date.now()}`, user_id: adminUserId });

    expect(res.status).toBe(409);
  });

  it("links a user as staff and promotes that user's role to STAFF", async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Linked Stylist ${Date.now()}`, user_id: linkableUserId });

    expect(res.status).toBe(201);
    linkedStaffId = res.body.staff.id;

    const user = await prisma.user.findUnique({ where: { id: linkableUserId } });
    expect(user?.role).toBe('STAFF');
  });

  it('rejects a non-admin fetching the admin staff listing', async () => {
    const res = await request(app)
      .get('/api/staff/admin')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('includes the linked user on the admin staff listing', async () => {
    const res = await request(app)
      .get('/api/staff/admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const entry = res.body.staff.find((s: { id: string }) => s.id === linkedStaffId);
    expect(entry?.user_id).toBe(linkableUserId);
    expect(entry?.user?.email).toBe(LINKABLE_EMAIL);

    // The public listing must still never expose this.
    const publicList = await request(app).get('/api/staff');
    const publicEntry = publicList.body.staff.find((s: { id: string }) => s.id === linkedStaffId);
    expect(publicEntry?.user_id).toBeUndefined();
    expect(publicEntry?.user).toBeUndefined();
  });

  it('rejects linking that same user to a second staff record', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Duplicate Link ${Date.now()}`, user_id: linkableUserId });

    expect(res.status).toBe(409);
  });

  it("unlinking a staff member's user demotes them back to CUSTOMER", async () => {
    const res = await request(app)
      .patch(`/api/staff/${linkedStaffId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: null });

    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: linkableUserId } });
    expect(user?.role).toBe('CUSTOMER');
  });

  it('soft-deletes a staff member as an admin', async () => {
    const res = await request(app)
      .delete(`/api/staff/${createdStaffId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app).get('/api/staff');
    expect(list.body.staff.some((s: { id: string }) => s.id === createdStaffId)).toBe(false);
  });
});

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

const ADMIN_EMAIL = 'staff_test_admin@example.com';
const CUSTOMER_EMAIL = 'staff_test_customer@example.com';
const PASSWORD = 'TestPass123!';
const STAFF_NAME = `Test Stylist ${Date.now()}`;

describe('Staff API Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let createdStaffId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL] } } });

    await request(app).post('/api/auth/register').send({ name: 'Staff Admin', email: ADMIN_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { is_verified: true, role: 'ADMIN' } });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    await request(app).post('/api/auth/register').send({ name: 'Staff Customer', email: CUSTOMER_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: CUSTOMER_EMAIL }, data: { is_verified: true } });
    const customerLogin = await request(app).post('/api/auth/login').send({ email: CUSTOMER_EMAIL, password: PASSWORD });
    customerToken = customerLogin.body.accessToken;
  });

  afterAll(async () => {
    if (createdStaffId) {
      await prisma.staff.deleteMany({ where: { id: createdStaffId } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL] } } });
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

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

const TEST_EMAIL = 'user_test@example.com';
const OTHER_EMAIL = 'user_test_other@example.com';
const ADMIN_EMAIL = 'user_test_admin@example.com';
const PASSWORD = 'TestPass123!';
const NEW_PASSWORD = 'NewTestPass456!';

describe('User Profile API Tests', () => {
  let token: string;
  let adminToken: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, OTHER_EMAIL, ADMIN_EMAIL] } } });

    await request(app).post('/api/auth/register').send({ name: 'User Test', email: TEST_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: TEST_EMAIL }, data: { is_verified: true } });

    await request(app).post('/api/auth/register').send({ name: 'Other User', email: OTHER_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: OTHER_EMAIL }, data: { is_verified: true } });

    await request(app).post('/api/auth/register').send({ name: 'Admin User', email: ADMIN_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { is_verified: true, role: 'ADMIN' } });

    const login = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: PASSWORD });
    token = login.body.accessToken;

    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, OTHER_EMAIL, ADMIN_EMAIL] } } });
  });

  it('rejects a non-admin listing accounts', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('lets an admin list accounts (for linking a user as staff)', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const emails = res.body.users.map((u: { email: string }) => u.email);
    expect(emails).toContain(TEST_EMAIL);
    // Admin accounts are excluded — they're never valid staff-link candidates.
    expect(emails).not.toContain(ADMIN_EMAIL);
  });

  it('rejects fetching the profile without a token', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
  });

  it('fetches the current user profile', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('updates the profile name', async () => {
    const res = await request(app)
      .patch('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
  });

  it('rejects changing the email to one already in use', async () => {
    const res = await request(app)
      .patch('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: OTHER_EMAIL });

    expect(res.status).toBe(409);
  });

  it('rejects a password change with the wrong current password', async () => {
    const res = await request(app)
      .patch('/api/users/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword1!', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(401);
  });

  it('changes the password and allows login with the new one', async () => {
    const res = await request(app)
      .patch('/api/users/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeDefined();
  });
});

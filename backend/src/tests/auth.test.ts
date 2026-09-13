import request from 'supertest';
import app from '../app';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../config/database';

const TEST_EMAIL = 'test123@example.com';
const TEST_PASSWORD = 'TestPass123!'; // must satisfy the app's password policy

describe('Auth API Tests', () => {
  beforeAll(async () => {
    // Start from a clean slate — a previous aborted run could have left
    // this fixture user behind.
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: "Test User",
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toHaveProperty('email');
  });

  it('should not register duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: "Duplicate",
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("already exists");
  });

  it('should login successfully', async () => {
    // Registration leaves the account unverified — a real verification
    // email would need to be clicked. Simulate that step directly so this
    // test exercises login, not email delivery.
    await prisma.user.update({ where: { email: TEST_EMAIL }, data: { is_verified: true } });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('accessToken');
  });
});

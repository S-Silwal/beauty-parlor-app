import request from 'supertest';
import app from '../server'; // adjust if needed
import { describe, it, expect, beforeAll } from '@jest/globals';
describe('Auth API Tests', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: "Test User",
        email: "test123@example.com",
        password: "TestPass123"
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
        email: "test123@example.com",
        password: "TestPass123"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("already exists");
  });

  it('should login successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: "test123@example.com",
        password: "TestPass123"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('accessToken');
  });
});
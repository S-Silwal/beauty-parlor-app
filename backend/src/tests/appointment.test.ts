import request from 'supertest';
import { describe, it, expect, beforeAll } from '@jest/globals';
import app from '../server';   // Make sure this is correct

describe('Appointment API Tests', () => {
  let token: string;

  beforeAll(async () => {
    // Login to get token
    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email: "test123@example.com",
        password: "TestPass123"
      });

    token = login.body.accessToken;
  });

  it('should get all services', async () => {
    const res = await request(app).get('/api/appointments/services');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.services)).toBe(true);
  });

  it('should book an appointment', async () => {
    const res = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${token}`)
      .send({
        service_id: "some-service-id",   // Replace with real ID from your DB
        appointment_date: "2026-05-15T14:00:00.000Z"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
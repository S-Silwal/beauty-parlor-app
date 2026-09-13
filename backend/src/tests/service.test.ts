import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

const ADMIN_EMAIL = 'service_test_admin@example.com';
const CUSTOMER_EMAIL = 'service_test_customer@example.com';
const PASSWORD = 'TestPass123!';
const SERVICE_NAME = `Test Facial ${Date.now()}`;

describe('Service API Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let createdServiceId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL] } } });

    await request(app).post('/api/auth/register').send({ name: 'Service Admin', email: ADMIN_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { is_verified: true, role: 'ADMIN' } });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    await request(app).post('/api/auth/register').send({ name: 'Service Customer', email: CUSTOMER_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: CUSTOMER_EMAIL }, data: { is_verified: true } });
    const customerLogin = await request(app).post('/api/auth/login').send({ email: CUSTOMER_EMAIL, password: PASSWORD });
    customerToken = customerLogin.body.accessToken;
  });

  afterAll(async () => {
    if (createdServiceId) {
      await prisma.service.deleteMany({ where: { id: createdServiceId } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL] } } });
  });

  it('lists services publicly without auth', async () => {
    const res = await request(app).get('/api/services');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.services)).toBe(true);
  });

  it('rejects creating a service without a token', async () => {
    const res = await request(app).post('/api/services').send({});

    expect(res.status).toBe(401);
  });

  it('rejects creating a service as a non-admin', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: SERVICE_NAME,
        category: 'FACIAL_SKINCARE',
        duration: 60,
        price: 50,
      });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid service payload from an admin', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ab', category: 'FACIAL_SKINCARE', duration: 60, price: 50 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation Error');
  });

  it('creates a service as an admin', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: SERVICE_NAME,
        category: 'FACIAL_SKINCARE',
        duration: 60,
        price: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.service.name).toBe(SERVICE_NAME);
    createdServiceId = res.body.service.id;
  });

  it('updates a service as an admin', async () => {
    const res = await request(app)
      .patch(`/api/services/${createdServiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 65 });

    expect(res.status).toBe(200);
    expect(Number(res.body.service.price)).toBe(65);
  });

  it('soft-deletes a service as an admin', async () => {
    const res = await request(app)
      .delete(`/api/services/${createdServiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app).get('/api/services');
    expect(list.body.services.some((s: { id: string }) => s.id === createdServiceId)).toBe(false);
  });

  it('requires Cloudinary credentials for the signed-url endpoint', async () => {
    const res = await request(app)
      .get('/api/services/signed-url')
      .set('Authorization', `Bearer ${adminToken}`);

    const cloudinaryConfigured =
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET;

    if (cloudinaryConfigured) {
      expect(res.status).toBe(200);
      expect(res.body.signature).toBeDefined();
    } else {
      expect(res.status).toBe(503);
      expect(res.body.message).toMatch(/not configured/i);
    }
  });
});

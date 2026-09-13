import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app';
import { prisma } from '../config/database';

const ADMIN_EMAIL = 'gallery_test_admin@example.com';
const CUSTOMER_EMAIL = 'gallery_test_customer@example.com';
const PASSWORD = 'TestPass123!';
const IMAGE_URL = `https://res.cloudinary.com/demo/image/upload/v1/beauty-parlor/gallery/test-${Date.now()}.jpg`;

const cloudinaryConfigured =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

describe('Gallery API Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let createdImageId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL] } } });

    await request(app).post('/api/auth/register').send({ name: 'Gallery Admin', email: ADMIN_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { is_verified: true, role: 'ADMIN' } });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    await request(app).post('/api/auth/register').send({ name: 'Gallery Customer', email: CUSTOMER_EMAIL, password: PASSWORD });
    await prisma.user.update({ where: { email: CUSTOMER_EMAIL }, data: { is_verified: true } });
    const customerLogin = await request(app).post('/api/auth/login').send({ email: CUSTOMER_EMAIL, password: PASSWORD });
    customerToken = customerLogin.body.accessToken;
  });

  afterAll(async () => {
    if (createdImageId) {
      await prisma.galleryImage.deleteMany({ where: { id: createdImageId } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CUSTOMER_EMAIL] } } });
  });

  it('lists gallery images publicly without auth', async () => {
    const res = await request(app).get('/api/gallery');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.images)).toBe(true);
  });

  it('rejects the signed-url endpoint without a token', async () => {
    const res = await request(app).get('/api/gallery/signed-url');

    expect(res.status).toBe(401);
  });

  it('rejects the signed-url endpoint for a non-admin', async () => {
    const res = await request(app).get('/api/gallery/signed-url').set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('requires Cloudinary credentials for the signed-url endpoint', async () => {
    const res = await request(app).get('/api/gallery/signed-url').set('Authorization', `Bearer ${adminToken}`);

    if (cloudinaryConfigured) {
      expect(res.status).toBe(200);
      expect(res.body.signature).toBeDefined();
    } else {
      expect(res.status).toBe(503);
      expect(res.body.message).toMatch(/not configured/i);
    }
  });

  it('rejects saving an image without a url', async () => {
    const res = await request(app)
      .post('/api/gallery/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('saves an image record as an admin', async () => {
    const res = await request(app)
      .post('/api/gallery/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: IMAGE_URL, alt_text: 'Test image', category: 'interior' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.image.url).toBe(IMAGE_URL);
    createdImageId = res.body.image.id;

    const list = await request(app).get('/api/gallery');
    expect(list.body.images.some((img: { id: string }) => img.id === createdImageId)).toBe(true);
  });

  it('rejects deleting an image as a non-admin', async () => {
    const res = await request(app)
      .delete(`/api/gallery/${createdImageId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('soft-deletes an image as an admin', async () => {
    const res = await request(app)
      .delete(`/api/gallery/${createdImageId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app).get('/api/gallery');
    expect(list.body.images.some((img: { id: string }) => img.id === createdImageId)).toBe(false);
  });
});

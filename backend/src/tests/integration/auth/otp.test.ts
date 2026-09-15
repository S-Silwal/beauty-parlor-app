import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../../app';
import { prisma } from '../../../config/database';

// Covers the OTP-verification edge cases login.test.ts's happy-path MFA
// flow doesn't: a used or expired code must never issue tokens, and a
// wrong/unknown code must be rejected too.
const TEST_EMAIL = 'otp_verify_test@example.com';
const PASSWORD = 'TestPass123!';

describe('POST /api/auth/verify-otp', () => {
  let userId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await request(app).post('/api/auth/register').send({
      name: 'OTP Verify Test',
      email: TEST_EMAIL,
      password: PASSWORD,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
    userId = user.id;
    await prisma.user.update({ where: { id: userId }, data: { is_verified: true } });
  });

  afterAll(async () => {
    await prisma.otpCode.deleteMany({ where: { user_id: userId } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('issues tokens for a valid, unexpired OTP', async () => {
    await prisma.otpCode.deleteMany({ where: { user_id: userId } });
    const otp = await prisma.otpCode.create({
      data: {
        user_id: userId,
        code: '123456',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId, otp: otp.code });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('rejects an already-used OTP', async () => {
    await prisma.otpCode.deleteMany({ where: { user_id: userId } });
    const otp = await prisma.otpCode.create({
      data: {
        user_id: userId,
        code: '654321',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        used: true,
      },
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId, otp: otp.code });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an expired OTP', async () => {
    await prisma.otpCode.deleteMany({ where: { user_id: userId } });
    const otp = await prisma.otpCode.create({
      data: {
        user_id: userId,
        code: '111222',
        expires_at: new Date(Date.now() - 60 * 1000), // already expired
      },
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId, otp: otp.code });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects a code that does not match any stored OTP', async () => {
    await prisma.otpCode.deleteMany({ where: { user_id: userId } });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId, otp: '999999' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

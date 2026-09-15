import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../../app';
import { prisma } from '../../../config/database';

const TEST_EMAIL = 'login_flow_test@example.com';
const PASSWORD = 'TestPass123!';

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await request(app).post('/api/auth/register').send({
      name: 'Login Flow Test',
      email: TEST_EMAIL,
      password: PASSWORD,
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('rejects login for an unverified account', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify/i);
  });

  it('locks the account after too many failed attempts', async () => {
    await prisma.user.update({
      where: { email: TEST_EMAIL },
      data: { is_verified: true, failedLoginAttempts: 0, accountLockedUntil: null },
    });

    // authConfig.maxFailedAttempts is 5 — this exhausts it.
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: 'DefinitelyWrong123!' });
    }

    // Even the *correct* password is now rejected until the lock expires.
    const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/locked/i);

    // Reset so the next test in this file starts from a clean slate.
    await prisma.user.update({
      where: { email: TEST_EMAIL },
      data: { failedLoginAttempts: 0, accountLockedUntil: null },
    });
  });

  it('requires OTP when MFA is enabled, and a correct OTP completes login', async () => {
    const initialLogin = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: PASSWORD });
    const accessToken = initialLogin.body.accessToken;

    const enableRes = await request(app)
      .post('/api/auth/enable-mfa')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(enableRes.status).toBe(200);

    const mfaLogin = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: PASSWORD });

    expect(mfaLogin.status).toBe(200);
    expect(mfaLogin.body.mfaRequired).toBe(true);
    expect(mfaLogin.body).toHaveProperty('userId');
    // No accessToken should be issued until the OTP step completes.
    expect(mfaLogin.body).not.toHaveProperty('accessToken');

    // This is exactly what used to be broken: generateOTP() only ever
    // console.log'd the code and never sent it anywhere, so an MFA-enabled
    // account could never actually complete login in production. Reading
    // the code back from the DB (rather than a mailbox this test doesn't
    // have) confirms the code a real email would carry was actually issued
    // and is usable.
    const otp = await prisma.otpCode.findFirst({
      where: { user_id: mfaLogin.body.userId, used: false },
      orderBy: { created_at: 'desc' },
    });
    expect(otp).not.toBeNull();

    const verify = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId: mfaLogin.body.userId, otp: otp!.code });

    expect(verify.status).toBe(200);
    expect(verify.body).toHaveProperty('accessToken');

    await prisma.user.update({ where: { email: TEST_EMAIL }, data: { mfa_enabled: false } });
  });
});

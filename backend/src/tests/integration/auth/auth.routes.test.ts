import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../../app';
import { prisma } from '../../../config/database';

// See ../../auth.test.ts for basic register/login coverage, otp.test.ts for
// verify-otp edge cases, and login.test.ts for the MFA login flow (which
// also exercises enable-mfa). This file covers the remaining auth routes
// nothing else in the suite touches: verify-email, resend-verification,
// refresh, logout, forgot-password, reset-password, and disable-mfa.
describe('Auth routes', () => {

  describe('GET /api/auth/verify-email', () => {
    const EMAIL = 'verify_email_route_test@example.com';

    beforeAll(async () => {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
      await request(app).post('/api/auth/register').send({
        name: 'Verify Email Route Test',
        email: EMAIL,
        password: 'TestPass123!',
      });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
    });

    it('verifies the account with the token issued at registration', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(user.is_verified).toBe(false);

      const tokenRow = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { user_id: user.id },
      });

      const res = await request(app).get('/api/auth/verify-email').query({ token: tokenRow.token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.is_verified).toBe(true);
    });

    it('rejects an invalid verification token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: 'not-a-real-token' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('always reports success, whether or not the email is registered (anti-enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'auth_routes_test_unknown_xyz@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Session lifecycle — refresh and logout', () => {
    const EMAIL = 'session_lifecycle_route_test@example.com';
    const PASSWORD = 'TestPass123!';
    let userId: string;

    beforeAll(async () => {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
      await request(app).post('/api/auth/register').send({
        name: 'Session Lifecycle Test',
        email: EMAIL,
        password: PASSWORD,
      });
      const user = await prisma.user.update({
        where: { email: EMAIL },
        data: { is_verified: true },
      });
      userId = user.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
    });

    it('rejects a refresh attempt with no refresh cookie', async () => {
      const res = await request(app).post('/api/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/refresh token is required/i);
    });

    it('issues a new access token from a valid refresh cookie', async () => {
      const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      const cookie = login.headers['set-cookie'];
      expect(cookie).toBeDefined();

      const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('clears the refresh token on logout', async () => {
      const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      const cookie = login.headers['set-cookie'];

      const before = await prisma.refreshToken.count({ where: { user_id: userId } });
      expect(before).toBeGreaterThan(0);

      const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Logout only revokes the session that logged out — not every refresh
      // token the user holds (an earlier test in this block logged in too,
      // and that session's token is still intentionally valid) — so this
      // asserts exactly one token was removed, not that the user has none.
      const after = await prisma.refreshToken.count({ where: { user_id: userId } });
      expect(after).toBe(before - 1);
    });
  });

  describe('Password reset — forgot-password and reset-password', () => {
    const EMAIL = 'password_reset_route_test@example.com';
    const ORIGINAL_PASSWORD = 'TestPass123!';
    const NEW_PASSWORD = 'NewTestPass456!';

    beforeAll(async () => {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
      await request(app).post('/api/auth/register').send({
        name: 'Password Reset Test',
        email: EMAIL,
        password: ORIGINAL_PASSWORD,
      });
      await prisma.user.update({ where: { email: EMAIL }, data: { is_verified: true } });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
    });

    it('creates a reset token for a real account, and still reports success for an unknown one', async () => {
      const knownRes = await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
      expect(knownRes.status).toBe(200);
      expect(knownRes.body.success).toBe(true);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      const tokenRow = await prisma.passwordResetToken.findFirst({ where: { user_id: user.id } });
      expect(tokenRow).not.toBeNull();

      const unknownRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'auth_routes_test_unknown_xyz@example.com' });
      expect(unknownRes.status).toBe(200);
      expect(unknownRes.body.success).toBe(true);
    });

    it('resets the password with the issued token, and rejects reusing that token', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      const tokenRow = await prisma.passwordResetToken.findFirstOrThrow({ where: { user_id: user.id } });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: tokenRow.token, newPassword: NEW_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const oldLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: ORIGINAL_PASSWORD });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PASSWORD });
      expect(newLogin.status).toBe(200);

      const reuse = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: tokenRow.token, newPassword: 'YetAnotherPass789!' });
      expect(reuse.status).toBe(409);
    });
  });

  describe('POST /api/auth/disable-mfa', () => {
    const EMAIL = 'disable_mfa_route_test@example.com';
    const PASSWORD = 'TestPass123!';
    let accessToken: string;

    beforeAll(async () => {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
      await request(app).post('/api/auth/register').send({
        name: 'Disable MFA Test',
        email: EMAIL,
        password: PASSWORD,
      });
      await prisma.user.update({ where: { email: EMAIL }, data: { is_verified: true } });

      const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      accessToken = login.body.accessToken;

      await request(app)
        .post('/api/auth/enable-mfa')
        .set('Authorization', `Bearer ${accessToken}`);
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
    });

    it('disables MFA so a subsequent login no longer requires an OTP step', async () => {
      const disableRes = await request(app)
        .post('/api/auth/disable-mfa')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(disableRes.status).toBe(200);
      expect(disableRes.body.success).toBe(true);

      const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

      expect(login.status).toBe(200);
      expect(login.body.mfaRequired).toBeFalsy();
      expect(login.body).toHaveProperty('accessToken');
    });
  });
});

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import app from '../../../app';
import { prisma } from '../../../config/database';
import { authConfig } from '../../../config/auth';

const TEST_EMAIL = 'me_endpoint_test@example.com';
const PASSWORD = 'TestPass123!';

describe('GET /api/auth/me', () => {
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    await request(app).post('/api/auth/register').send({
      name: 'Me Endpoint Test',
      email: TEST_EMAIL,
      password: PASSWORD,
    });

    // Registration leaves the account unverified, and AuthService.login
    // rejects unverified accounts — set it directly rather than actually
    // clicking a verification link, same pattern used in login.test.ts.
    const user = await prisma.user.update({
      where: { email: TEST_EMAIL },
      data: { is_verified: true },
    });
    userId = user.id;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: PASSWORD });
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('returns the current user for a valid access token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    // AuthService.getCurrentUser's select list deliberately omits this —
    // asserting it here means a future accidental "select everything"
    // regression gets caught here instead of shipping a password hash to
    // the client.
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/access token is required/i);
  });

  it('rejects an expired token', async () => {
    // Signed with the real secret so it passes signature verification —
    // only `exp` is wrong, which is what actually exercises the
    // TokenExpiredError branch in auth.middleware.ts rather than the
    // generic JsonWebTokenError one (see the "rejects an invalid token"
    // omission — that's a distinct branch, not covered here).
    const expiredToken = jwt.sign(
      { userId, role: 'CUSTOMER' },
      authConfig.jwtSecret,
      { expiresIn: '-10s' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/expired/i);
  });
});

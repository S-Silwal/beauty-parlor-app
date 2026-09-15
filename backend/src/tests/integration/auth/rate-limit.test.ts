import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import app from '../../../app';

// Locks in the B2 fix: authRateLimiter used to hardcode max: 100 while the
// dedicated config file (config/rateLimit.ts) said 10 and was never actually
// wired up — so /api/auth/login was 10x weaker than intended. Now that
// ratelimitter.middleware.ts imports rateLimitConfig directly, this test
// fails loudly again if the two ever drift apart.
//
// This file gets its own fresh module registry (Jest's default — a new
// `app` import per test file), so the limiter here starts unused and this
// test doesn't interfere with login attempts made in other test files.
describe('Rate limiting — POST /api/auth/login', () => {
  it('returns 429 once the configured auth limit (10 per window) is exceeded', async () => {
    const attempts = [];
    for (let i = 0; i < 10; i++) {
      attempts.push(
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'rate_limit_probe@example.com', password: 'WrongPassword123!' })
      );
    }

    // None of the first 10 should be blocked by the limiter itself (they may
    // still be 401s for "invalid credentials" — that's expected and fine).
    for (const res of attempts) {
      expect(res.status).not.toBe(429);
    }

    const eleventh = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rate_limit_probe@example.com', password: 'WrongPassword123!' });

    expect(eleventh.status).toBe(429);
    expect(eleventh.body.success).toBe(false);
  });
});

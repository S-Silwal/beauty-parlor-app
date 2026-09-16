import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../../app';
import { prisma } from '../../../config/database';

// See ../../auth.test.ts for the happy-path registration coverage (a valid
// signup, duplicate-email rejection). This file covers the two behaviors
// the validator/service layer specifically promise but nothing exercises:
// password complexity and email case-normalization.
const WEAK_PW_EMAIL = 'weak_password_test@example.com';
const NORMALIZE_EMAIL_MIXED = 'Normalize_Test@Example.COM';
const NORMALIZE_EMAIL_LOWER = NORMALIZE_EMAIL_MIXED.toLowerCase();

describe('POST /api/auth/register', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [WEAK_PW_EMAIL, NORMALIZE_EMAIL_LOWER] } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [WEAK_PW_EMAIL, NORMALIZE_EMAIL_LOWER] } } });
  });

  it('enforces the password complexity policy', async () => {
    // 12 characters (clears the length floor) but missing an uppercase
    // letter, a number, and a special character — registerSchema's four
    // separate .regex() checks should each surface as their own issue.
    const res = await request(app).post('/api/auth/register').send({
      name: 'Weak Password Test',
      email: WEAK_PW_EMAIL,
      password: 'weakpassword',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation Error');

    const passwordIssues = res.body.errors.filter((e: { field: string }) => e.field === 'password');
    expect(passwordIssues.length).toBeGreaterThan(0);

    // A rejected registration must not leave a user behind.
    const user = await prisma.user.findUnique({ where: { email: WEAK_PW_EMAIL } });
    expect(user).toBeNull();
  });

  it('normalizes email to lowercase before storing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Normalize Test',
      email: NORMALIZE_EMAIL_MIXED,
      password: 'TestPass123!',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(NORMALIZE_EMAIL_LOWER);

    // Confirm it's the actual DB row that's normalized, not just the
    // response body echoing back what was sent.
    const stored = await prisma.user.findUnique({ where: { email: NORMALIZE_EMAIL_LOWER } });
    expect(stored).not.toBeNull();
    expect(stored!.email).toBe(NORMALIZE_EMAIL_LOWER);
  });
});

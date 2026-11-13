import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../app';
import { prisma } from '../../config/database';
import { authConfig } from '../../config/auth';

// QA 2J (P0): "watch specifically for double-booking under concurrency".
//
// book-appointment.test.ts already races two requests, but both come from
// the SAME customer, so the per-customer guards can reject the loser before
// the staff slot itself is ever contended. The production risk is different
// customers grabbing the same stylist at the same minute. This fires N
// bookings from N distinct customers for one staff member + one start time,
// all at once, and checks three layers agree: exactly one 201, every loser a
// clean 409 (never a 500 from an unhandled serialization/exclusion error),
// and exactly one active row in the database.
const N = 15;
const EMAIL_PREFIX = 'race_staff_test_';

describe('concurrent bookings for the same staff + time (distinct customers)', () => {
  const tokens: string[] = [];
  let serviceId: string;
  let staffId: string;
  const start = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000);
  start.setHours(11, 0, 0, 0);

  beforeAll(async () => {
    await prisma.appointment.deleteMany({ where: { user: { email: { startsWith: EMAIL_PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });

    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) throw new Error('No active service found — seed the database before running this test.');
    serviceId = service.id;

    // A dedicated staff member, so no other test's bookings can occupy this slot.
    const staff = await prisma.staff.create({ data: { name: 'Race Test Staff', isActive: true } });
    staffId = staff.id;

    // Users are created directly and tokens minted locally: going through
    // /register + /login N times would just exercise the auth rate limiter.
    for (let i = 0; i < N; i++) {
      const user = await prisma.user.create({
        data: {
          name: `Race Customer ${i}`,
          email: `${EMAIL_PREFIX}${i}@example.com`,
          password_hash: 'not-used-tokens-are-minted-directly',
          role: 'CUSTOMER',
          is_verified: true,
        },
      });
      tokens.push(jwt.sign({ userId: user.id, role: user.role }, authConfig.jwtSecret, { expiresIn: '5m' }));
    }
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { staff_id: staffId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
    await prisma.staff.deleteMany({ where: { id: staffId } });
  });

  it(`lets exactly one of ${N} simultaneous customers win the slot`, async () => {
    const responses = await Promise.all(
      tokens.map(token =>
        request(app)
          .post('/api/appointments/book')
          .set('Authorization', `Bearer ${token}`)
          .send({ service_id: serviceId, staff_id: staffId, appointment_date: start.toISOString() }),
      ),
    );

    const statuses = responses.map(r => r.status);
    const winners = statuses.filter(s => s === 201).length;
    const conflicts = statuses.filter(s => s === 409).length;

    // Any other status (500, 503…) means a race leaked past the error
    // handling — show every status so the failure is easy to read.
    // Anything other than 201/409 is a race leaking past error handling —
    // include its message so a flaky failure explains itself.
    const unexpected = responses
      .filter(r => r.status !== 201 && r.status !== 409)
      .map(r => `${r.status}: ${r.body?.message ?? JSON.stringify(r.body).slice(0, 200)}`);
    expect({ winners, conflicts, statuses: [...new Set(statuses)].sort(), unexpected: [...new Set(unexpected)] })
      .toEqual({ winners: 1, conflicts: N - 1, statuses: [201, 409], unexpected: [] });

    const active = await prisma.appointment.count({
      where: { staff_id: staffId, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] } },
    });
    expect(active).toBe(1);
  });
});

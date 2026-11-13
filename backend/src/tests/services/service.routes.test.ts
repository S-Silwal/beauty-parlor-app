import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

// ServiceService.getAll() was the one list endpoint the hardening audit
// flagged as never having been given the opt-in pagination contract that
// AppointmentService.getAllServices/getAllStaff already use (see
// utils/pagination.ts) — this pins both the backward-compatible unpaginated
// shape and the new paginated shape now that it's been added.

describe('GET /api/services', () => {
  // Compare against what the database actually holds instead of a hardcoded
  // "10 seeded services": that floor broke on any dev database where a
  // service had been deactivated (e.g. through the admin page), even though
  // the endpoint was behaving correctly. Six is the minimum the page-2 test
  // below needs (5 per page) — enough to stay meaningful on real data.
  let activeCount: number;
  beforeAll(async () => {
    activeCount = await prisma.service.count({ where: { isActive: true } });
    expect(activeCount).toBeGreaterThanOrEqual(6);
  });

  it('returns the full unpaginated list when no page/limit query params are given', async () => {
    const res = await request(app).get('/api/services');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.services)).toBe(true);
    // Unpaginated = every active service, no more and no fewer.
    expect(res.body.services.length).toBe(activeCount);
    expect(res.body.pagination).toBeUndefined();
  });

  it('returns a paginated slice with metadata when page/limit are given', async () => {
    const res = await request(app).get('/api/services').query({ page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBe(activeCount);
  });

  it('returns a different, non-overlapping slice on page 2 than page 1', async () => {
    const page1 = await request(app).get('/api/services').query({ page: 1, limit: 5 });
    const page2 = await request(app).get('/api/services').query({ page: 2, limit: 5 });

    const page1Ids = page1.body.services.map((s: { id: string }) => s.id);
    const page2Ids = page2.body.services.map((s: { id: string }) => s.id);

    expect(page2.body.services.length).toBeGreaterThan(0);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });
});

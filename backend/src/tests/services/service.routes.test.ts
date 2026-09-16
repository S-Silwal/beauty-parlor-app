import request from 'supertest';
import app from '../../app';

// ServiceService.getAll() was the one list endpoint the hardening audit
// flagged as never having been given the opt-in pagination contract that
// AppointmentService.getAllServices/getAllStaff already use (see
// utils/pagination.ts) — this pins both the backward-compatible unpaginated
// shape and the new paginated shape now that it's been added.

describe('GET /api/services', () => {
  it('returns the full unpaginated list when no page/limit query params are given', async () => {
    const res = await request(app).get('/api/services');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.services)).toBe(true);
    // Seeded with 10 active services (see utils/seed.ts); no test in this
    // suite creates or deactivates a service, so this floor holds
    // regardless of run order.
    expect(res.body.services.length).toBeGreaterThanOrEqual(10);
    expect(res.body.pagination).toBeUndefined();
  });

  it('returns a paginated slice with metadata when page/limit are given', async () => {
    const res = await request(app).get('/api/services').query({ page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(10);
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

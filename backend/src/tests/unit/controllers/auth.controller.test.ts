import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Response } from 'express';
import { AuthController } from '../../../controllers/auth.controller';
import { AuthService } from '../../../services/auth.service';
import type { AuthRequest } from '../../../middleware/auth.middleware';

// True unit coverage: AuthService is mocked out entirely, so this exercises
// only the controller's own logic (what it calls, how it shapes the
// response, whether it forwards errors to next()) — no real Express app,
// no real Postgres. Complements the integration-level coverage in
// tests/integration/auth/me.test.ts, which hits the real HTTP + DB stack
// for the same endpoint.
jest.mock('../../../services/auth.service');

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res as Response;
}

describe('AuthController.getCurrentUser (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('responds with the user AuthService returns, for an authenticated request', async () => {
    const fakeUser = { id: 'user-1', name: 'Test', email: 'test@example.com', role: 'CUSTOMER' };
    (AuthService.getCurrentUser as jest.Mock).mockResolvedValue(fakeUser);

    const req = { user: { userId: 'user-1', role: 'CUSTOMER' } } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    await AuthController.getCurrentUser(req, res, next);

    expect(AuthService.getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(res.json).toHaveBeenCalledWith({ success: true, user: fakeUser });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 without calling AuthService when the request has no user', async () => {
    const req = {} as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    await AuthController.getCurrentUser(req, res, next);

    expect(AuthService.getCurrentUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized' });
  });

  it('forwards a thrown error to next() instead of responding itself', async () => {
    const boom = new Error('database exploded');
    (AuthService.getCurrentUser as jest.Mock).mockRejectedValue(boom);

    const req = { user: { userId: 'user-1', role: 'CUSTOMER' } } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    await AuthController.getCurrentUser(req, res, next);

    expect(next).toHaveBeenCalledWith(boom);
    expect(res.json).not.toHaveBeenCalled();
  });
});

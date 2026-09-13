import { describe, it } from '@jest/globals';

// See ../../auth.test.ts for the current registration coverage.
describe('POST /api/auth/register', () => {
  it.todo('enforces the password complexity policy');
  it.todo('normalizes email to lowercase before storing');
});

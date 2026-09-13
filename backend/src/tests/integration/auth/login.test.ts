import { describe, it } from '@jest/globals';

describe('POST /api/auth/login', () => {
  it.todo('rejects login for an unverified account');
  it.todo('locks the account after too many failed attempts');
  it.todo('requires OTP when MFA is enabled');
});

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { checkResend } from '../../../utils/externalHealthChecks';

// The /health endpoint reported resend: "down" in production while emails
// were being delivered — a Sending-access key can't call GET /domains.
describe('checkResend', () => {
  const realFetch = global.fetch;
  const realKey = process.env.RESEND_API_KEY;
  const respond = (status: number, body: unknown) =>
    jest.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  beforeEach(() => { process.env.RESEND_API_KEY = 're_test_key'; });
  afterEach(() => { global.fetch = realFetch; process.env.RESEND_API_KEY = realKey; });

  it('is "ok" for a full-access key (200)', async () => {
    global.fetch = respond(200, { data: [] });
    expect(await checkResend()).toBe('ok');
  });

  it('is "ok" for a sending-only key (401 restricted_api_key)', async () => {
    global.fetch = respond(401, { name: 'restricted_api_key', message: 'This API key is restricted to only send emails' });
    expect(await checkResend()).toBe('ok');
  });

  it('is "down" for an invalid key (401 with any other error)', async () => {
    global.fetch = respond(401, { name: 'validation_error', message: 'API key is invalid' });
    expect(await checkResend()).toBe('down');
  });

  it('is "down" when Resend errors or is unreachable', async () => {
    global.fetch = respond(503, {});
    expect(await checkResend()).toBe('down');
    global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    expect(await checkResend()).toBe('down');
  });

  it('is "not_configured" without a key', async () => {
    delete process.env.RESEND_API_KEY;
    expect(await checkResend()).toBe('not_configured');
  });
});

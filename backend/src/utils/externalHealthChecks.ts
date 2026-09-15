// src/utils/externalHealthChecks.ts
//
// The old /health endpoint only pinged Postgres — "so 'all green' can still
// mean silent notification failure" (30-day hardening audit). Each check
// below is a lightweight, read-only call to the provider's own API,
// wrapped in a timeout so a slow/unreachable provider can't hang the whole
// health endpoint. A provider with no credentials configured reports
// "not_configured", not "down" — Twilio (SMS) and QStash (reminders) are
// genuinely optional in this app, so that's a real, distinct state from an
// outage.
//
// Endpoints used (verified against each provider's own docs):
//   Resend:     GET https://api.resend.com/domains        (Bearer token)
//   Twilio:     GET /2010-04-01/Accounts/{Sid}.json        (Basic auth)
//   Cloudinary: cloudinary.api.ping()                       (Admin API)
//   QStash:     GET https://qstash.upstash.io/v2/logs      (Bearer token)

export type CheckStatus = "ok" | "down" | "not_configured";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

const TIMEOUT_MS = 4000;

export async function checkResend(): Promise<CheckStatus> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "not_configured";
  try {
    const res = await withTimeout(
      fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
      }),
      TIMEOUT_MS
    );
    return res.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function checkTwilio(): Promise<CheckStatus> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return "not_configured";
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await withTimeout(
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${auth}` },
      }),
      TIMEOUT_MS
    );
    return res.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function checkCloudinary(): Promise<CheckStatus> {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return "not_configured";
  }
  try {
    const { cloudinary } = await import("../config/cloudinary");
    await withTimeout(cloudinary.api.ping(), TIMEOUT_MS);
    return "ok";
  } catch {
    return "down";
  }
}

export async function checkQstash(): Promise<CheckStatus> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return "not_configured";
  try {
    const res = await withTimeout(
      fetch("https://qstash.upstash.io/v2/logs", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      TIMEOUT_MS
    );
    return res.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function checkAllIntegrations(): Promise<{
  resend: CheckStatus;
  twilio: CheckStatus;
  cloudinary: CheckStatus;
  qstash: CheckStatus;
}> {
  const [resend, twilio, cloudinary, qstash] = await Promise.all([
    checkResend(),
    checkTwilio(),
    checkCloudinary(),
    checkQstash(),
  ]);
  return { resend, twilio, cloudinary, qstash };
}

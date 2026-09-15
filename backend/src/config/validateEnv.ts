// src/config/validateEnv.ts
//
// Fails fast with one clear message instead of letting a missing secret
// surface later as a confusing runtime error deep inside some unrelated
// request (e.g. jwt.sign() throwing on an undefined secret).

const REQUIRED = ["DATABASE_URL", "JWT_SECRET", "REFRESH_SECRET"];

// Missing any of these just disables that one feature (email, SMS, uploads,
// scheduled reminders) rather than breaking the whole app, so we only warn.
const RECOMMENDED = [
  "RESEND_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "SENTRY_DSN",
];

export function validateEnv(): void {
  const missingRequired = REQUIRED.filter((key) => !process.env[key]);
  if (missingRequired.length > 0) {
    console.error(
      `❌ Missing required environment variable(s): ${missingRequired.join(", ")}. ` +
      `Copy .env.example to .env and fill these in before starting the server.`
    );
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(
      `⚠️  Missing optional environment variable(s): ${missingRecommended.join(", ")}. ` +
      `The related feature(s) (email/SMS/uploads/reminders) won't work until these are set.`
    );
  }
}

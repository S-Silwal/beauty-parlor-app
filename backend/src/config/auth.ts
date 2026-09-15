// src/config/auth.ts
import dotenv from "dotenv";//reads your .env file and loads its content into process.env so your code can access them
dotenv.config();

export const authConfig = {
  jwtSecret:          process.env.JWT_SECRET!,
  // No fallback to JWT_SECRET here on purpose: validateEnv's REQUIRED list
  // already refuses to boot the app if REFRESH_SECRET is unset, so a
  // fallback could never actually run — it was dead code that read as if
  // the app had a weaker guarantee (silently reusing JWT_SECRET) than it
  // actually enforces (REFRESH_SECRET is mandatory, full stop). See the
  // 30-day hardening audit's note on this line.
  refreshSecret:      process.env.REFRESH_SECRET!,//secret key used to sign refresh tokens

  // ✅ as const narrows the type from string → "15m" and "7d" exactly
  // jwt.sign() needs the literal type, not just string
  accessTokenExpiry:  "15m"  as const,
  refreshTokenExpiry: "7d"   as const,

  refreshTokenMs:     7 * 24 * 60 * 60 * 1000,

  bcryptRounds: 10,//controls how many times the password hashing algorithm runs, higher is more secure but slower. 10 is a common default.

  maxFailedAttempts: 5,
  lockDurationMs:    30 * 60 * 1000,

  verificationTokenExpiryMs: 24 * 60 * 60 * 1000,
  resetTokenExpiryMs:        60 * 60 * 1000,
  otpExpiryMs:               10 * 60 * 1000,

  // Long-lived — embedded in outgoing email footers as a one-click unsubscribe link
  unsubscribeTokenExpiry: "365d" as const,

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",//used in email links for verification and password reset, should match the actual frontend URL in production
} as const;

export type AuthConfigType = typeof authConfig;
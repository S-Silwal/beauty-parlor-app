// src/config/auth.ts
import dotenv from "dotenv";//reads your .env file and loads its content into process.env so your code can access them
dotenv.config();

export const authConfig = {
  jwtSecret:          process.env.JWT_SECRET!,
  refreshSecret:      process.env.REFRESH_SECRET || process.env.JWT_SECRET!,//secret key used to sign refresh tokens, fallback to JWT_SECRET if not provided

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

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",//used in email links for verification and password reset, should match the actual frontend URL in production
} as const;

export type AuthConfigType = typeof authConfig;
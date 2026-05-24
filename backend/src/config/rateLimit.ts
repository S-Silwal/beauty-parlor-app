// src/config/rateLimit.ts
export const rateLimitConfig = {

  // General API — all routes
  api: {
    windowMs: 60 * 1000,   // 1 minute
    max:      60,           // 60 requests per minute
  },

  // Login attempts
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max:      10,               // 10 attempts (was wrongly set to 100)
  },

  // Account registration
  createAccount: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    max:      5,                // 5 accounts (was wrongly set to 150)
  },

  // OTP verification
  otp: {
    windowMs: 10 * 60 * 1000,  // 10 minutes
    max:      5,
  },

  // Forgot password requests
  forgotPassword: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    max:      3,
  },

  // Reset password submissions
  resetPassword: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    max:      5,
  },

  // Refresh token requests
  refreshToken: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max:      15,
  },

  // Appointment booking
  appointmentBooking: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    max:      8,
  },

} as const;

export type RateLimitConfigType = typeof rateLimitConfig;
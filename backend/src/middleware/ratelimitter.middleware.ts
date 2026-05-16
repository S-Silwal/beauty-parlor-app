// src/middleware/rateLimiter.middleware.ts
import rateLimit from 'express-rate-limit';

// Login / Auth Rate Limiter (Strict)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,        // 15 minutes
  max: 100,                         // 10 attempts per 15 minutes
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Account Creation Limiter
export const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,        // 1 hour
  max: 150,                          // 5 accounts per hour
  message: {
    success: false,
    message: "Too many accounts created. Please try again after 1 hour.",
  },
  standardHeaders: true,
});

// General API Rate Limiter
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,             // 1 minute
  max: 60,                         // 60 requests per minute
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
});
// OTP Verification Limiter
export const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,        // 10 minutes
  max: 5,
  message: { success: false, message: "Too many OTP attempts. Try again later." },
  standardHeaders: true,
});

// Forgot Password Limiter
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,        // 1 hour
  max: 3,
  message: { success: false, message: "Too many password reset requests." },
  standardHeaders: true,
});

// Refresh Token Limiter
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: "Too many refresh attempts." },
});
/** Reset Password Rate Limiter */
export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,        // 1 hour
  max: 5,                          // Max 5 reset attempts per hour
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again after 1 hour.",
  },
  standardHeaders: true,
});

/** Appointment Booking Rate Limiter (Per User) */
export const appointmentBookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,        // 1 hour
  max: 8,                          // Max 8 bookings per hour per IP
  message: {
    success: false,
    message: "Too many appointment booking attempts. Please try again after 1 hour.",
  },
  standardHeaders: true,
  // Optional: You can make it per user later using keyGenerator
});
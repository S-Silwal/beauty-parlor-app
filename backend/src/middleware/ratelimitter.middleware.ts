// src/middleware/rateLimiter.middleware.ts
import rateLimit from 'express-rate-limit';
import { rateLimitConfig } from '../config/rateLimit';

// Login / Auth Rate Limiter (Strict)
export const authRateLimiter = rateLimit({
  windowMs: rateLimitConfig.auth.windowMs,
  max: rateLimitConfig.auth.max,               // 10 attempts per 15 minutes
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Account Creation Limiter
export const createAccountLimiter = rateLimit({
  windowMs: rateLimitConfig.createAccount.windowMs,
  max: rateLimitConfig.createAccount.max,      // 5 accounts per hour
  message: {
    success: false,
    message: "Too many accounts created. Please try again after 1 hour.",
  },
  standardHeaders: true,
});

// General API Rate Limiter
export const apiRateLimiter = rateLimit({
  windowMs: rateLimitConfig.api.windowMs,
  max: rateLimitConfig.api.max,                // 60 requests per minute
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
});

// OTP Verification Limiter
export const otpRateLimiter = rateLimit({
  windowMs: rateLimitConfig.otp.windowMs,
  max: rateLimitConfig.otp.max,
  message: { success: false, message: "Too many OTP attempts. Try again later." },
  standardHeaders: true,
});

// Forgot Password Limiter
export const forgotPasswordLimiter = rateLimit({
  windowMs: rateLimitConfig.forgotPassword.windowMs,
  max: rateLimitConfig.forgotPassword.max,
  message: { success: false, message: "Too many password reset requests." },
  standardHeaders: true,
});

// Refresh Token Limiter
export const refreshTokenLimiter = rateLimit({
  windowMs: rateLimitConfig.refreshToken.windowMs,
  max: rateLimitConfig.refreshToken.max,
  message: { success: false, message: "Too many refresh attempts." },
});

/** Reset Password Rate Limiter */
export const resetPasswordLimiter = rateLimit({
  windowMs: rateLimitConfig.resetPassword.windowMs,
  max: rateLimitConfig.resetPassword.max,      // Max 5 reset attempts per hour
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again after 1 hour.",
  },
  standardHeaders: true,
});

/** Appointment Booking Rate Limiter (Per User) */
export const appointmentBookingLimiter = rateLimit({
  windowMs: rateLimitConfig.appointmentBooking.windowMs,
  max: rateLimitConfig.appointmentBooking.max, // Max 8 bookings per hour per IP
  message: {
    success: false,
    message: "Too many appointment booking attempts. Please try again after 1 hour.",
  },
  standardHeaders: true,
  // Optional: You can make it per user later using keyGenerator
});

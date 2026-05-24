// src/validators/auth.validator.ts
import { z } from "zod";

/**
 * US phone number validation
 * Accepts: (123) 456-7890, 123-456-7890, 1234567890, +11234567890
 * Strips formatting and validates 10 digits
 */
const usPhoneSchema = z
  .string()
  .optional()
  .transform(val => {//
    if (!val || val.trim() === '') return undefined;//val
    // Strip everything except digits and leading +
    return val.replace(/[^\d+]/g, '');//returns only digits and leading +, removes spaces, dashes, parentheses, etc.
  })
  .refine(val => {
    if (!val) return true; // optional — skip if empty
    // Remove leading +1 or 1 if present
    const digits = val.replace(/^\+?1/, '');
    return /^\d{10}$/.test(digits);
  }, { message: "Please enter a valid US phone number (10 digits)" })
  .refine(val => {
    if (!val) return true;
    const digits = val.replace(/^\+?1/, '');
    // Reject obviously invalid area codes (000, 911, etc.)
    const areaCode = digits.substring(0, 3);
    return !['000', '911', '555'].includes(areaCode);
  }, { message: "Please enter a valid US phone number" });

/**
 * Register Schema
 */
export const registerSchema = z.object({//expported for validation rules
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),

  email: z
    .string()
    .email("Please enter a valid email address")
    .trim()
    .toLowerCase(),

  // ✅ Optional US phone
  phone: usPhoneSchema,

  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

/**
 * Login Schema
 */
export const loginSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

/**
 * Forgot Password Schema
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
});

/**
 * Reset Password Schema
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

/**
 * Verify OTP Schema
 */
export const verifyOTPSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

// ====================== TYPES ======================
export type RegisterInput = z.infer<typeof registerSchema>;//exports a TypeScript type based on the Zod schema, which can be used for type checking in the rest of the codebase. It ensures that any data passed as RegisterInput adheres to the structure and validation rules defined in registerSchema.
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>;
// src/routes/auth.routes.ts
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
  authRateLimiter,
  createAccountLimiter,
  resetPasswordLimiter,
} from "../middleware/ratelimitter.middleware";

const router = Router();

// ====================== PUBLIC ROUTES ======================
router.post("/register",              createAccountLimiter,  AuthController.register);
router.post("/login",                 authRateLimiter,       AuthController.login);
router.post("/refresh",               authRateLimiter,       AuthController.refresh);
router.post("/logout",                                       AuthController.logout);

// ====================== EMAIL VERIFICATION ======================
router.get ("/verify-email",          AuthController.verifyEmail);         // GET ?token=xxx
router.post("/resend-verification",   authRateLimiter, AuthController.resendVerification);

// ====================== PASSWORD RESET ======================
router.post("/forgot-password",       authRateLimiter,       AuthController.forgotPassword);
router.post("/reset-password",        resetPasswordLimiter,  AuthController.resetPassword);

// ====================== OTP / MFA ======================
router.post("/verify-otp",            authRateLimiter,       AuthController.verifyOTP);

// ====================== PROTECTED ROUTES ======================
router.get ("/me",                    authenticate,          AuthController.getCurrentUser);
router.post("/enable-mfa",            authenticate,          AuthController.enableMFA);
router.post("/disable-mfa",           authenticate,          AuthController.disableMFA);

export default router;
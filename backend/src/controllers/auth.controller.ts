// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOTPSchema,
} from "../validators/auth.validator";

export class AuthController {

  // ====================== PUBLIC ROUTES ======================

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await AuthService.register(validated);
      res.status(201).json({
        success: true,
        message: "Account created! Please check your email to verify your account before logging in.",
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await AuthService.login(validated.email, validated.password);

      if (result.mfaRequired === true) {
        return res.status(200).json({
          success: true,
          mfaRequired: true,
          userId: (result as any).userId,
          message: (result as any).message || "MFA verification required",
        });
      }

      res.cookie("refreshToken", (result as any).refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        user: (result as any).user,
        accessToken: (result as any).accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const oldRefreshToken = req.cookies.refreshToken;
      if (!oldRefreshToken) {
        return res.status(401).json({ success: false, message: "Refresh token is required" });
      }
      const result = await AuthService.refreshAccessToken(oldRefreshToken);
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ success: true, message: "Token refreshed", accessToken: result.accessToken, user: result.user });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (refreshToken) await AuthService.logout(refreshToken);
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  }

  // ====================== EMAIL VERIFICATION ======================

  /** GET /api/auth/verify-email?token=xxx */
  static async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.query as { token: string };
      if (!token) return res.status(400).json({ success: false, message: "Token is required" });
      const result = await AuthService.verifyEmail(token);
      res.json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/auth/resend-verification */
  static async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: "Email is required" });
      const result = await AuthService.resendVerificationEmail(email);
      res.json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  // ====================== PASSWORD RESET ======================

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      await AuthService.forgotPassword(validated.email);
      // Always return success (prevent email enumeration)
      res.json({ success: true, message: "If an account exists with this email, a reset link has been sent." });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = resetPasswordSchema.parse(req.body);
      await AuthService.resetPassword(validated.token, validated.newPassword);
      res.json({ success: true, message: "Password reset successfully. You can now log in." });
    } catch (error) {
      next(error);
    }
  }

  static async verifyOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = verifyOTPSchema.parse(req.body);
      const result = await AuthService.verifyOTP(validated.userId, validated.otp);
      res.json({ success: true, message: "OTP verified successfully", ...result });
    } catch (error) {
      next(error);
    }
  }

  // ====================== PROTECTED ROUTES ======================

  static async getCurrentUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
      const user = await AuthService.getCurrentUser(req.user.userId);
      res.json({ success: true, user });
    } catch (error) {
      next(error);
    }
  }

  static async enableMFA(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
      await AuthService.enableMFA(req.user.userId);
      res.json({ success: true, message: "MFA enabled successfully" });
    } catch (error) {
      next(error);
    }
  }

  static async disableMFA(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
      await AuthService.disableMFA(req.user.userId);
      res.json({ success: true, message: "MFA disabled successfully" });
    } catch (error) {
      next(error);
    }
  }
}
// src/controllers/user.controller.ts
import { Response } from "express";
import { UserService } from "../services/user.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { updateProfileSchema, changePasswordSchema } from "../validators/user.validator";

export class UserController {

  static async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const user = await UserService.getProfile(req.user.userId);
      res.json({ success: true, user });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const validatedData = updateProfileSchema.parse(req.body);
      const user = await UserService.updateProfile(req.user.userId, validatedData);

      res.json({ success: true, message: "Profile updated successfully", user });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const validatedData = changePasswordSchema.parse(req.body);
      await UserService.changePassword(req.user.userId, validatedData);

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
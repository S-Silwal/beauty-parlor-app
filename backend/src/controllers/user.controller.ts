// src/controllers/user.controller.ts
import { Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { updateProfileSchema, changePasswordSchema } from "../validators/user.validator";

export class UserController {

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const user = await UserService.getProfile(req.user.userId);
      res.json({ success: true, user });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const validatedData = updateProfileSchema.parse(req.body);
      const user = await UserService.updateProfile(req.user.userId, validatedData);

      res.json({ success: true, message: "Profile updated successfully", user });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const validatedData = changePasswordSchema.parse(req.body);
      await UserService.changePassword(req.user.userId, validatedData);

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      next(error);
    }
  }

  // Role is already enforced by isAdmin middleware on this route. Lets the
  // admin UI look up a user's ID to link as staff (see StaffService.create/
  // update's user_id field) without going through Prisma Studio.
  static async listAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const users = await UserService.listAccounts();
      res.json({ success: true, users });
    } catch (error) {
      next(error);
    }
  }
}

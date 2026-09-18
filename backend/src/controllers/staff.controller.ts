// src/controllers/staff.controller.ts
import { Request, Response, NextFunction } from "express";
import { StaffService } from "../services/staff.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { createStaffSchema, updateStaffSchema } from "../validators/staff.validator";

export class StaffController {

  static async getAllStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await StaffService.getAll();
      res.json({ success: true, staff });
    } catch (error) {
      next(error);
    }
  }

  // Role is already enforced by isAdmin middleware on this route. Includes
  // the staff<->login linkage the public listing above withholds.
  static async getAllStaffAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const staff = await StaffService.getAllForAdmin();
      res.json({ success: true, staff });
    } catch (error) {
      next(error);
    }
  }

  // Get a signed Cloudinary upload URL (frontend uploads directly to
  // Cloudinary) — same pattern as GET /api/hero-slides/signed-url and
  // GET /api/services/signed-url.
  static async getSignedUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const signedData = await StaffService.generateSignedUploadUrl();
      res.json({ success: true, ...signedData });
    } catch (error) {
      next(error);
    }
  }

  // Role is already enforced by isAdmin middleware on this route.
  static async createStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = createStaffSchema.parse(req.body);
      const staff = await StaffService.create(validatedData);

      res.status(201).json({
        success: true,
        message: "Staff member created successfully",
        staff,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedData = updateStaffSchema.parse(req.body);
      const staff = await StaffService.update(id, validatedData, {
        userId: req.user!.userId,
        role:   req.user!.role,
      });

      res.json({ success: true, message: "Staff updated successfully", staff });
    } catch (error) {
      next(error);
    }
  }

  static async deleteStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await StaffService.delete(id);

      res.json({ success: true, message: "Staff member removed successfully" });
    } catch (error) {
      next(error);
    }
  }
}

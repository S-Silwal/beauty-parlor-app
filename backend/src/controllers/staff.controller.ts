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
      const staff = await StaffService.update(id, validatedData);

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

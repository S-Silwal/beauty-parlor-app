// src/controllers/staff.controller.ts
import { Request, Response } from "express";
import { StaffService } from "../services/staff.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { createStaffSchema, updateStaffSchema } from "../validators/staff.validator";

export class StaffController {

  static async getAllStaff(req: Request, res: Response) {
    try {
      const staff = await StaffService.getAll();
      res.json({ success: true, staff });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createStaff(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const validatedData = createStaffSchema.parse(req.body);
      const staff = await StaffService.create(validatedData);

      res.status(201).json({
        success: true,
        message: "Staff member created successfully",
        staff,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateStaff(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const { id } = req.params;
      const validatedData = updateStaffSchema.parse(req.body);
      const staff = await StaffService.update(id, validatedData);

      res.json({ success: true, message: "Staff updated successfully", staff });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // ✅ NEW — Delete (soft delete) staff member
  static async deleteStaff(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const { id } = req.params;
      await StaffService.delete(id);

      res.json({ success: true, message: "Staff member removed successfully" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
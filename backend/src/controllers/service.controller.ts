// src/controllers/service.controller.ts
import { Request, Response } from "express";
import { ServiceService } from "../services/service.service"; // You'll create this next
import { AuthRequest } from "../middleware/auth.middleware";
import { createServiceSchema, updateServiceSchema } from "../validators/service.validator";

export class ServiceController {

  static async getAllServices(req: Request, res: Response) {
    try {
      const services = await ServiceService.getAll();
      res.json({ success: true, services });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createService(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const validatedData = createServiceSchema.parse(req.body);
      const service = await ServiceService.create(validatedData);

      res.status(201).json({
        success: true,
        message: "Service created successfully",
        service,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateService(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const { id } = req.params;
      const validatedData = updateServiceSchema.parse(req.body);

      const service = await ServiceService.update(id, validatedData);

      res.json({
        success: true,
        message: "Service updated successfully",
        service,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteService(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const { id } = req.params;
      await ServiceService.delete(id);

      res.json({ success: true, message: "Service deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
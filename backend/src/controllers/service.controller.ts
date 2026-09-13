// src/controllers/service.controller.ts
import { Request, Response, NextFunction } from "express";
import { ServiceService } from "../services/service.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { createServiceSchema, updateServiceSchema } from "../validators/service.validator";

export class ServiceController {

  static async getAllServices(req: Request, res: Response, next: NextFunction) {
    try {
      const services = await ServiceService.getAll();
      res.json({ success: true, services });
    } catch (error) {
      next(error);
    }
  }

  // Role is already enforced by isAdmin middleware on this route.
  static async createService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = createServiceSchema.parse(req.body);
      const service = await ServiceService.create(validatedData);

      res.status(201).json({
        success: true,
        message: "Service created successfully",
        service,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedData = updateServiceSchema.parse(req.body);

      const service = await ServiceService.update(id, validatedData);

      res.json({
        success: true,
        message: "Service updated successfully",
        service,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await ServiceService.delete(id);

      res.json({ success: true, message: "Service deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  // ── Get signed Cloudinary upload URL (admin only — enforced by isAdmin middleware) ────
  // Frontend uses this to upload a service photo directly to Cloudinary
  static async getSignedUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const signedData = await ServiceService.generateSignedUploadUrl();
      res.json({ success: true, ...signedData });
    } catch (error) {
      next(error);
    }
  }
}

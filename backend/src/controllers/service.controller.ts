// src/controllers/service.controller.ts
import { Request, Response, NextFunction } from "express";
import { ServiceService } from "../services/service.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { createServiceSchema, updateServiceSchema } from "../validators/service.validator";
import { parsePagination } from "../utils/pagination";

export class ServiceController {

  static async getAllServices(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req.query);
      const result = await ServiceService.getAll(pagination ?? undefined);
      // Unpaginated (default) callers get back exactly what they always did
      // — a plain `services` array — so this stays backward compatible.
      if (Array.isArray(result)) {
        res.json({ success: true, services: result });
      } else {
        res.json({ success: true, services: result.items, pagination: {
          total: result.total, page: result.page, limit: result.limit,
        }});
      }
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

      const service = await ServiceService.update(id, validatedData, {
        userId: req.user!.userId,
        role:   req.user!.role,
      });

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

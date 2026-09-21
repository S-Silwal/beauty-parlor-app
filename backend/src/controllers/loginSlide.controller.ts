// src/controllers/loginSlide.controller.ts
import { Response, NextFunction, Request } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { LoginSlideService } from "../services/loginSlide.service";
import {
  createLoginSlideSchema,
  updateLoginSlideSchema,
  reorderLoginSlideSchema,
} from "../validators/loginSlide.validator";

export class LoginSlideController {
  // ====================== PUBLIC ======================
  static async getPublicSlides(req: Request, res: Response, next: NextFunction) {
    try {
      const slides = await LoginSlideService.getActiveSlides();
      res.json({ success: true, slides });
    } catch (error) {
      next(error);
    }
  }

  // ====================== ADMIN ======================
  static async getAllSlides(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const slides = await LoginSlideService.getAllSlides();
      res.json({ success: true, slides });
    } catch (error) {
      next(error);
    }
  }

  // Get a signed Cloudinary upload URL (frontend uploads directly to Cloudinary)
  static async getSignedUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const signedData = await LoginSlideService.generateSignedUploadUrl();
      res.json({ success: true, ...signedData });
    } catch (error) {
      next(error);
    }
  }

  static async createSlide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const validated = createLoginSlideSchema.parse(req.body);
      const slide = await LoginSlideService.createSlide(validated);
      res.status(201).json({ success: true, message: "Login slide created", slide });
    } catch (error) {
      next(error);
    }
  }

  static async updateSlide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateLoginSlideSchema.parse(req.body);
      const slide = await LoginSlideService.updateSlide(id, validated);
      res.json({ success: true, message: "Login slide updated", slide });
    } catch (error) {
      next(error);
    }
  }

  static async reorderSlide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = reorderLoginSlideSchema.parse(req.body);
      const slides = await LoginSlideService.reorderSlide(id, validated.direction);
      res.json({ success: true, slides });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSlide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await LoginSlideService.deleteSlide(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

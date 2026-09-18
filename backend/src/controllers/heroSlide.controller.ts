// src/controllers/heroSlide.controller.ts
import { Response, NextFunction, Request } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { HeroSlideService } from "../services/heroSlide.service";
import {
  createHeroSlideSchema,
  updateHeroSlideSchema,
  reorderHeroSlideSchema,
} from "../validators/heroSlide.validator";

export class HeroSlideController {
  // ====================== PUBLIC ======================
  static async getPublicSlides(req: Request, res: Response, next: NextFunction) {
    try {
      const slides = await HeroSlideService.getActiveSlides();
      res.json({ success: true, slides });
    } catch (error) {
      next(error);
    }
  }

  // ====================== ADMIN ======================
  static async getAllSlides(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const slides = await HeroSlideService.getAllSlides();
      res.json({ success: true, slides });
    } catch (error) {
      next(error);
    }
  }

  // Get a signed Cloudinary upload URL (frontend uploads directly to Cloudinary)
  static async getSignedUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const signedData = await HeroSlideService.generateSignedUploadUrl();
      res.json({ success: true, ...signedData });
    } catch (error) {
      next(error);
    }
  }

  static async createSlide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const validated = createHeroSlideSchema.parse(req.body);
      const slide = await HeroSlideService.createSlide(validated);
      res.status(201).json({ success: true, message: "Hero slide created", slide });
    } catch (error) {
      next(error);
    }
  }

  static async updateSlide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateHeroSlideSchema.parse(req.body);
      const slide = await HeroSlideService.updateSlide(id, validated);
      res.json({ success: true, message: "Hero slide updated", slide });
    } catch (error) {
      next(error);
    }
  }

  static async reorderSlide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = reorderHeroSlideSchema.parse(req.body);
      const slides = await HeroSlideService.reorderSlide(id, validated.direction);
      res.json({ success: true, slides });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSlide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await HeroSlideService.deleteSlide(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

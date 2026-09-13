// src/controllers/review.controller.ts
import { Request, Response, NextFunction } from "express";
import { ReviewService } from "../services/review.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { createReviewSchema } from "../validators/review.validator";

export class ReviewController {
  // ====================== PUBLIC ======================
  // Powers the homepage's "Average Rating" stat.
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await ReviewService.getReviewStats();
      res.json({ success: true, ...stats });
    } catch (error) {
      next(error);
    }
  }

  // Powers the homepage's public review cards — no login required. Returns
  // only reviews with a comment, and only the reviewer's first name.
  static async getPublicReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const reviews = await ReviewService.getPublicReviews(
        limit && !Number.isNaN(limit) ? limit : undefined
      );
      res.json({ success: true, reviews });
    } catch (error) {
      next(error);
    }
  }

  // ====================== CUSTOMER PROTECTED ======================
  static async getMyReviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const reviews = await ReviewService.getMyReviews(req.user.userId);
      res.json({ success: true, reviews });
    } catch (error) {
      next(error);
    }
  }

  static async createReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const validated = createReviewSchema.parse(req.body);
      const review = await ReviewService.createReview(req.user.userId, validated);

      res.status(201).json({
        success: true,
        message: "Thanks for your feedback!",
        review,
      });
    } catch (error) {
      next(error);
    }
  }
}

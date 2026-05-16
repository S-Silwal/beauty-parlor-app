// src/controllers/gallery.controller.ts
import { Request, Response, NextFunction } from "express";
import { GalleryService } from "../services/gallery.service";
import { AuthRequest } from "../middleware/auth.middleware";

export class GalleryController {

  // ── Get all active images (public) ───────────────────────────────────────
  static async getAllImages(req: Request, res: Response, next: NextFunction) {
    try {
      const images = await GalleryService.getAllImages();
      res.json({ success: true, images });
    } catch (error) {
      next(error);
    }
  }

  // ── Get signed Cloudinary upload URL (admin only) ────────────────────────
  // Frontend uses this to upload directly to Cloudinary without going through your server
  static async getSignedUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const signedData = await GalleryService.generateSignedUploadUrl();
      res.json({ success: true, ...signedData });
    } catch (error) {
      next(error);
    }
  }

  // ── Save image record after Cloudinary upload (admin only) ───────────────
  static async saveImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const { url, public_id, alt_text, category } = req.body;

      if (!url) {
        return res.status(400).json({ success: false, message: "Image URL is required" });
      }

      const image = await GalleryService.saveImage({ url, public_id, alt_text, category });

      res.status(201).json({
        success: true,
        message: "Image saved to gallery successfully",
        image,
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Legacy direct upload (admin only) ────────────────────────────────────
  static async uploadImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const { category } = req.body;
      const image = await GalleryService.uploadImage(req.file, category);

      res.status(201).json({ success: true, message: "Image uploaded successfully", image });
    } catch (error) {
      next(error);
    }
  }

  // ── Soft delete image (admin only) ───────────────────────────────────────
  static async deleteImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Admin access only" });
      }

      const { id } = req.params;
      const result = await GalleryService.deleteImage(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
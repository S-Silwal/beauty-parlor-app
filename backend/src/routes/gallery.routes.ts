// src/routes/gallery.routes.ts — UPDATED with signed upload endpoint
import { Router } from "express";
import { GalleryController } from "../controllers/gallery.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isAdmin } from "../middleware/role.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

// ── Public ───────────────────────────────────────────────────────────────────
router.get("/", GalleryController.getAllImages);

// ── Admin ────────────────────────────────────────────────────────────────────

// ✅ Get a signed Cloudinary upload URL (frontend uploads directly to Cloudinary)
router.get("/signed-url", authenticate, isAdmin, GalleryController.getSignedUrl);

// ✅ Save image record after frontend has uploaded to Cloudinary
router.post("/save", authenticate, isAdmin, GalleryController.saveImage);

// Legacy direct upload (keep for backward compatibility)
router.post(
  "/upload",
  authenticate,
  isAdmin,
  upload.single("image"),
  GalleryController.uploadImage
);

router.delete("/:id", authenticate, isAdmin, GalleryController.deleteImage);

export default router;
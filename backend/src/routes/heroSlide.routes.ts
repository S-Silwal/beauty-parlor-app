// src/routes/heroSlide.routes.ts
import { Router } from "express";
import { HeroSlideController } from "../controllers/heroSlide.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isAdmin } from "../middleware/role.middleware";

const router = Router();

// ── Public ───────────────────────────────────────────────────────────────
// Active slides only, in on-page order — this is what the homepage renders.
router.get("/", HeroSlideController.getPublicSlides);

// ── Admin ────────────────────────────────────────────────────────────────
router.get("/admin", authenticate, isAdmin, HeroSlideController.getAllSlides);

// Signed Cloudinary upload URL (frontend uploads directly to Cloudinary,
// then POSTs / PUTs the resulting URL below) — same flow as /api/gallery.
router.get("/signed-url", authenticate, isAdmin, HeroSlideController.getSignedUrl);

router.post("/", authenticate, isAdmin, HeroSlideController.createSlide);
router.put("/:id", authenticate, isAdmin, HeroSlideController.updateSlide);
router.patch("/:id/reorder", authenticate, isAdmin, HeroSlideController.reorderSlide);
router.delete("/:id", authenticate, isAdmin, HeroSlideController.deleteSlide);

export default router;

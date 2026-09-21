// src/routes/loginSlide.routes.ts
import { Router } from "express";
import { LoginSlideController } from "../controllers/loginSlide.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isAdmin } from "../middleware/role.middleware";

const router = Router();

// ── Public ───────────────────────────────────────────────────────────────
// Active slides only, in on-page order — this is what the login page's
// left-column slideshow renders.
router.get("/", LoginSlideController.getPublicSlides);

// ── Admin ────────────────────────────────────────────────────────────────
router.get("/admin", authenticate, isAdmin, LoginSlideController.getAllSlides);

// Signed Cloudinary upload URL (frontend uploads directly to Cloudinary,
// then POSTs / PUTs the resulting URL below) — same flow as /api/hero-slides.
router.get("/signed-url", authenticate, isAdmin, LoginSlideController.getSignedUrl);

router.post("/", authenticate, isAdmin, LoginSlideController.createSlide);
router.put("/:id", authenticate, isAdmin, LoginSlideController.updateSlide);
router.patch("/:id/reorder", authenticate, isAdmin, LoginSlideController.reorderSlide);
router.delete("/:id", authenticate, isAdmin, LoginSlideController.deleteSlide);

export default router;

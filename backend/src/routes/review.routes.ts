// src/routes/review.routes.ts
import { Router } from "express";
import { ReviewController } from "../controllers/review.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// ====================== PUBLIC ROUTES ======================
// Aggregate average + count, powering the homepage stat.
router.get("/stats", ReviewController.getStats);

// Individual reviews (service name, rating, comment, reviewer first name,
// date) for the homepage's public review cards. No auth — anyone visiting
// the site can see social proof without an account.
router.get("/public", ReviewController.getPublicReviews);

// ====================== CUSTOMER PROTECTED ROUTES ======================
router.get("/mine", authenticate, ReviewController.getMyReviews);
router.post("/", authenticate, ReviewController.createReview);

export default router;

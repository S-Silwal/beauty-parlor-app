 // src/routes/staff.routes.ts
import { Router } from "express";
import { StaffController } from "../controllers/staff.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isAdmin } from "../middleware/role.middleware";

const router = Router();

// ====================== PUBLIC ROUTES ======================
router.get("/", StaffController.getAllStaff);

// ====================== ADMIN ONLY ROUTES ======================
// Includes the staff<->login linkage the public GET "/" above withholds —
// used by the admin Staff Management UI.
router.get   ("/admin", authenticate, isAdmin, StaffController.getAllStaffAdmin);

// Signed Cloudinary upload URL (frontend uploads directly to Cloudinary,
// then POSTs/PATCHes the resulting URL below) — same flow as
// /api/gallery and /api/hero-slides.
router.get   ("/signed-url", authenticate, isAdmin, StaffController.getSignedUrl);

router.post  ("/",    authenticate, isAdmin, StaffController.createStaff);
router.patch ("/:id", authenticate, isAdmin, StaffController.updateStaff);
router.delete("/:id", authenticate, isAdmin, StaffController.deleteStaff); // ✅ uncommented
export default router; // ✅ ADDED — was missing
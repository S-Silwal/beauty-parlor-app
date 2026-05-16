 // src/routes/staff.routes.ts
import { Router } from "express";
import { StaffController } from "../controllers/staff.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isAdmin } from "../middleware/role.middleware";

const router = Router();

// ====================== PUBLIC ROUTES ======================
router.get("/", StaffController.getAllStaff);

// ====================== ADMIN ONLY ROUTES ======================
router.post  ("/",    authenticate, isAdmin, StaffController.createStaff);
router.patch ("/:id", authenticate, isAdmin, StaffController.updateStaff);
router.delete("/:id", authenticate, isAdmin, StaffController.deleteStaff); // ✅ uncommented
export default router; // ✅ ADDED — was missing
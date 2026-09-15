// src/routes/user.routes.ts
import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isAdmin } from "../middleware/role.middleware";

const router = Router();

// ====================== PROTECTED ROUTES (Logged-in User) ======================
router.get("/me", authenticate, UserController.getProfile);
router.patch("/profile", authenticate, UserController.updateProfile);
router.patch("/change-password", authenticate, UserController.changePassword);

// ====================== ADMIN ONLY ROUTES ======================
router.get("/", authenticate, isAdmin, UserController.listAccounts);

export default router;
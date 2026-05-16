// src/routes/service.routes.ts
import { Router } from "express";
import { ServiceController } from "../controllers/service.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isAdmin } from "../middleware/role.middleware";

const router = Router();

// ====================== PUBLIC ROUTES ======================
router.get("/", ServiceController.getAllServices);

// ====================== ADMIN ONLY ROUTES ======================
router.post("/", authenticate, isAdmin, ServiceController.createService);
router.patch("/:id", authenticate, isAdmin, ServiceController.updateService);
router.delete("/:id", authenticate, isAdmin, ServiceController.deleteService);

export default router;
// src/routes/appointment.routes.ts
import { Router } from "express";
import { AppointmentController } from "../controllers/appointment.controller";

// Correct Middleware Imports
import { authenticate } from "../middleware/auth.middleware";
import { isStaffOrAdmin } from "../middleware/role.middleware";

const router = Router();

// ====================== PUBLIC ROUTES (No Login Required) ======================
router.get("/services", AppointmentController.getServices);
router.get("/staff", AppointmentController.getStaff);

// ====================== AVAILABLE TIME SLOTS (Public - Very Important) ======================
router.get("/available-slots", AppointmentController.getAvailableSlots);

// ====================== CUSTOMER PROTECTED ROUTES ======================
router.post("/book", authenticate, AppointmentController.bookAppointment);
router.get("/my-bookings", authenticate, AppointmentController.getMyAppointments);
router.delete("/:id/cancel", authenticate, AppointmentController.cancelAppointment);
router.patch("/:id/reschedule", authenticate, AppointmentController.rescheduleAppointment);

// ====================== ADMIN & STAFF PROTECTED ROUTES ======================
router.get(
  "/all",
  authenticate,
  isStaffOrAdmin,
  AppointmentController.getAllAppointments
);

router.patch(
  "/:id/status",
  authenticate,
  isStaffOrAdmin,
  AppointmentController.updateStatus
);

export default router;
// src/routes/appointment.routes.ts
import { Router } from "express";
import { AppointmentController } from "../controllers/appointment.controller";
import { ChangeRequestController } from "../controllers/changeRequest.controller";

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

// ====================== CUSTOMER CHANGE REQUESTS ======================
// Unlike the instant cancel/reschedule above, these never touch the
// appointment directly — they create a request that only takes effect once
// an admin approves it (see ChangeRequestController / ChangeRequestService).
router.get("/my-change-requests", authenticate, ChangeRequestController.getMyRequests);
router.post("/:id/request-edit", authenticate, ChangeRequestController.requestEdit);
router.post("/:id/request-cancel", authenticate, ChangeRequestController.requestCancel);

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

// ── Admin review of customer change requests ──────────────────────────────
router.get(
  "/change-requests/pending",
  authenticate,
  isStaffOrAdmin,
  ChangeRequestController.getPending
);

router.patch(
  "/change-requests/:id/resolve",
  authenticate,
  isStaffOrAdmin,
  ChangeRequestController.resolve
);

export default router;
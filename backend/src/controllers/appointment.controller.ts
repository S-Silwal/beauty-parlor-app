// src/controllers/appointment.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppointmentService } from "../services/appointment.service";
import { StaffService } from "../services/staff.service";

// ✅ Correct Import - Remove local interface
import { AuthRequest } from "../middleware/auth.middleware";

// Validators
import {
  createAppointmentSchema,
  rescheduleSchema,
  updateStatusSchema,
  getAvailableSlotsSchema,
} from "../validators/appointment.validator";
import { parsePagination } from "../utils/pagination";

export class AppointmentController {

  // ====================== PUBLIC ROUTES ======================
  static async getServices(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req.query);
      const result = await AppointmentService.getAllServices(pagination ?? undefined);
      // Unpaginated (default) callers get back exactly what they always did
      // — a plain `services` array — so this stays backward compatible.
      if (Array.isArray(result)) {
        res.json({ success: true, services: result });
      } else {
        res.json({ success: true, services: result.items, pagination: {
          total: result.total, page: result.page, limit: result.limit,
        }});
      }
    } catch (error) {
      next(error);
    }
  }

  static async getStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req.query);
      const result = await AppointmentService.getAllStaff(pagination ?? undefined);
      if (Array.isArray(result)) {
        res.json({ success: true, staff: result });
      } else {
        res.json({ success: true, staff: result.items, pagination: {
          total: result.total, page: result.page, limit: result.limit,
        }});
      }
    } catch (error) {
      next(error);
    }
  }

  // ====================== CUSTOMER PROTECTED ROUTES ======================
  static async bookAppointment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const validated = createAppointmentSchema.parse(req.body);

      const appointment = await AppointmentService.bookAppointment(
        req.user.userId,
        {
          service_id: validated.service_id,
          staff_id: validated.staff_id,
          appointment_date: validated.appointment_date,
          notes: validated.notes,
        }
      );

      res.status(201).json({
        success: true,
        message: "Appointment booked successfully!",
        appointment,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Get Available Time Slots (Public Route)
   */
  static async getAvailableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = getAvailableSlotsSchema.parse(req.query);

      const result = await AppointmentService.getAvailableSlots({
        date: validated.date,
        service_id: validated.service_id,
        staff_id: validated.staff_id,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
  static async getMyAppointments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const appointments = await AppointmentService.getUserAppointments(req.user.userId);
      res.json({ success: true, appointments });
    } catch (error) {
      next(error);
    }
  }

  static async cancelAppointment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const { id } = req.params;
      const appointment = await AppointmentService.cancelAppointment(id, req.user.userId);

      res.json({
        success: true,
        message: "Appointment cancelled successfully",
        appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async rescheduleAppointment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const { id } = req.params;
      const validated = rescheduleSchema.parse(req.body);

      const appointment = await AppointmentService.rescheduleAppointment(id, req.user.userId, {
        appointment_date: new Date(validated.appointment_date),
        staff_id: validated.staff_id,
        notes: validated.notes,
      });

      res.json({
        success: true,
        message: "Appointment rescheduled successfully",
        appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  // ====================== ADMIN / STAFF ROUTES ======================
  // Role is already enforced by isStaffOrAdmin middleware on these routes.
  // Beyond that, a STAFF caller is further scoped to only their own
  // assigned appointments — see StaffService.resolveCallerStaffId(). ADMIN
  // gets `undefined` back (no filter), preserving the old unrestricted view.
  static async getAllAppointments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const staffId = await StaffService.resolveCallerStaffId(req.user!);
      const pagination = parsePagination(req.query);
      const result = await AppointmentService.getAllAppointments({ staffId, pagination: pagination ?? undefined });
      if (Array.isArray(result)) {
        res.json({ success: true, appointments: result });
      } else {
        res.json({ success: true, appointments: result.items, pagination: {
          total: result.total, page: result.page, limit: result.limit,
        }});
      }
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateStatusSchema.parse(req.body);
      const staffId = await StaffService.resolveCallerStaffId(req.user!);

      // Marking a booking COMPLETED is also what records the payment: it
      // must flip payment_status to PAID and create the Transaction row,
      // or the amount would never satisfy the Revenue section's
      // "COMPLETED + PAID" definition of earned revenue. Every other
      // status transition goes through the plain status update. Passing
      // staffId (undefined for ADMIN) enforces that a staff caller can only
      // touch appointments assigned to them.
      const actor = { userId: req.user!.userId, role: req.user!.role };
      const appointment = validated.status === "COMPLETED"
        ? await AppointmentService.completeAppointmentWithPayment(id, staffId, actor)
        : await AppointmentService.updateAppointmentStatus(id, validated.status, staffId, actor);

      res.json({
        success: true,
        message: `Appointment status updated to ${validated.status}`,
        appointment,
      });
    } catch (error) {
      next(error);
    }
  }
}
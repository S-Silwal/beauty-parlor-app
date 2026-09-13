// src/controllers/appointment.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppointmentService } from "../services/appointment.service";

// ✅ Correct Import - Remove local interface
import { AuthRequest } from "../middleware/auth.middleware";

// Validators
import {
  createAppointmentSchema,
  rescheduleSchema,
  updateStatusSchema,
  getAvailableSlotsSchema,
} from "../validators/appointment.validator";

export class AppointmentController {

  // ====================== PUBLIC ROUTES ======================
  static async getServices(req: Request, res: Response, next: NextFunction) {
    try {
      const services = await AppointmentService.getAllServices();
      res.json({ success: true, services });
    } catch (error) {
      next(error);
    }
  }

  static async getStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await AppointmentService.getAllStaff();
      res.json({ success: true, staff });
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
  static async getAllAppointments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const appointments = await AppointmentService.getAllAppointments();
      res.json({ success: true, appointments });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateStatusSchema.parse(req.body);

      // Marking a booking COMPLETED is also what records the payment: it
      // must flip payment_status to PAID and create the Transaction row,
      // or the amount would never satisfy the Revenue section's
      // "COMPLETED + PAID" definition of earned revenue. Every other
      // status transition goes through the plain status update.
      const appointment = validated.status === "COMPLETED"
        ? await AppointmentService.completeAppointmentWithPayment(id)
        : await AppointmentService.updateAppointmentStatus(id, validated.status);

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
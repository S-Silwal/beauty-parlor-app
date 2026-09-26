// src/validators/appointment.validator.ts
import { z } from "zod";
import { salonTodayStr } from "../utils/timezone";

/**
 * Create Appointment Schema
 */
export const createAppointmentSchema = z.object({
  service_id: z.string().uuid("Invalid service ID format"),
  staff_id: z.string().uuid("Invalid staff ID format").optional(),
  // .datetime() requires an unambiguous UTC "Z" suffix (or, with
  // { offset: true }, an explicit +HH:mm) — a bare local-looking string
  // like "2026-09-27T11:00:00" is REJECTED here rather than silently
  // parsed as the server process's own timezone (UTC on Railway, not the
  // salon's America/Indiana/Indianapolis, and not the customer's browser
  // either). The client is responsible for converting the salon-local
  // date+slot the customer picked into this real UTC instant before
  // sending it — see frontend/src/lib/timezone.ts's salonWallTimeToUtc().
  appointment_date: z
    .string()
    .datetime({ message: "Appointment date must be a valid ISO-8601 UTC date-time" })
    .refine((date) => new Date(date) > new Date(), {
      message: "Appointment date must be in the future",
    }),
  notes: z
    .string()
    .max(500, "Notes cannot exceed 500 characters")
    .optional(),
});

/**
 * Reschedule Appointment Schema
 */
export const rescheduleSchema = z.object({
  appointment_date: z
    .string()
    .datetime({ message: "New appointment date must be valid" })
    .refine((date) => new Date(date) > new Date(), {
      message: "New appointment date must be in the future",
    }),
  staff_id: z.string().uuid("Invalid staff ID format").optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
});

/**
 * Update Appointment Status Schema (Admin Only)
 */
export const updateStatusSchema = z.object({
  status: z.enum(
    ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"],
    {
      message: "Invalid status. Must be PENDING, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, RESCHEDULED or NO_SHOW"
    }
  ),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
});

/**
 * Cancel Appointment Schema
 */
export const cancelAppointmentSchema = z.object({
  reason: z.string().max(300, "Reason cannot exceed 300 characters").optional(),
});

/**
 * Get Available Time Slots Schema (NEW)
 */
export const getAvailableSlotsSchema = z.object({
  date: z
    .string()
    .date("Date must be in YYYY-MM-DD format")
    .refine((dateStr) => {
      // Compare against "today" as a plain "YYYY-MM-DD" string, computed
      // for the SALON's own calendar (America/Indiana/Indianapolis) — never
      // `new Date(dateStr)` (parsed as UTC midnight) and never
      // `now.getFullYear()/getDate()` (the server process's own timezone,
      // UTC on Railway). Either of those can register the salon's actual
      // "today" as "in the past" for a few hours around midnight, or accept
      // a date that's already over at the salon. ISO date strings sort
      // correctly as strings once both sides are in the same zone.
      return dateStr >= salonTodayStr();
    }, {
      message: "Date cannot be in the past",
    }),

  service_id: z.string().uuid("Invalid service ID format").optional(),
  staff_id: z.string().uuid("Invalid staff ID format").optional(),
});

// ====================== TYPES ======================
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;
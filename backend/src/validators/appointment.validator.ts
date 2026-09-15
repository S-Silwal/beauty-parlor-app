// src/validators/appointment.validator.ts
import { z } from "zod";

/**
 * Create Appointment Schema
 */
export const createAppointmentSchema = z.object({
  service_id: z.string().uuid("Invalid service ID format"),
  staff_id: z.string().uuid("Invalid staff ID format").optional(),
appointment_date: z
  .string()
  .refine((date) => !isNaN(new Date(date).getTime()), {
    message: "Appointment date must be a valid date and time",
  })
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
      // Plain string comparison against today's LOCAL calendar date —
      // never round-trip through `new Date(dateStr)`. A bare "YYYY-MM-DD"
      // is parsed as UTC midnight, which in any negative-UTC-offset
      // timezone (all of the Americas) sits a few hours *before* local
      // midnight — so comparing it against a locally-zeroed `new Date()`
      // made today's own date register as "in the past" and blocked every
      // same-day booking. ISO date strings sort correctly as strings, so
      // no Date object (and no timezone) needs to enter the comparison.
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return dateStr >= todayStr;
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
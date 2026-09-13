// src/validators/changeRequest.validator.ts
import { z } from "zod";

/**
 * Customer requests an edit to an upcoming booking (date/time, staff,
 * and/or service). At least one of the three must actually be provided —
 * an empty request has nothing for an admin to approve.
 */
export const requestEditSchema = z
  .object({
    // Deliberately NOT z.string().datetime() (which requires a UTC "Z"
    // suffix) — the booking form sends a bare local "YYYY-MM-DDTHH:mm:ss"
    // string, same as createAppointmentSchema.appointment_date, and since
    // the browser and this backend run on the same machine/timezone that's
    // parsed consistently by both sides.
    requested_date: z
      .string()
      .refine((date) => !isNaN(new Date(date).getTime()), {
        message: "Requested date must be a valid date and time",
      })
      .refine((date) => new Date(date) > new Date(), {
        message: "Requested date must be in the future",
      })
      .optional(),
    requested_staff_id: z.string().uuid("Invalid staff ID format").optional(),
    requested_service_id: z.string().uuid("Invalid service ID format").optional(),
  })
  .refine(
    (data) =>
      data.requested_date !== undefined ||
      data.requested_staff_id !== undefined ||
      data.requested_service_id !== undefined,
    { message: "Change at least one of: date/time, staff, or service" }
  );

/**
 * Customer requests a cancellation. No slot check needed — freeing a slot
 * never conflicts with anything.
 */
export const requestCancelSchema = z.object({
  reason: z.string().max(300, "Reason cannot exceed 300 characters").optional(),
});

/**
 * Admin approves or declines a pending change request.
 */
export const resolveChangeRequestSchema = z.object({
  decision: z.enum(["APPROVED", "DECLINED"], {
    message: "Decision must be APPROVED or DECLINED",
  }),
  decline_reason: z.string().max(300, "Reason cannot exceed 300 characters").optional(),
});

export type RequestEditInput = z.infer<typeof requestEditSchema>;
export type RequestCancelInput = z.infer<typeof requestCancelSchema>;
export type ResolveChangeRequestInput = z.infer<typeof resolveChangeRequestSchema>;

// src/validators/changeRequest.validator.ts
import { z } from "zod";

/**
 * Customer requests an edit to an upcoming booking (date/time, staff,
 * and/or service). At least one of the three must actually be provided —
 * an empty request has nothing for an admin to approve.
 */
export const requestEditSchema = z
  .object({
    // .datetime() requires an unambiguous UTC "Z" suffix — a bare local-
    // looking string like "2026-09-27T11:00:00" is REJECTED here rather
    // than silently parsed as the server process's own timezone (UTC on
    // Railway — not the salon's America/Indiana/Indianapolis, and not
    // necessarily the customer's browser either). This mirrors
    // createAppointmentSchema.appointment_date; the client converts the
    // salon-local date+slot the customer picked into this real UTC instant
    // before sending it — see frontend/src/lib/timezone.ts's
    // salonWallTimeToUtc().
    requested_date: z
      .string()
      .datetime({ message: "Requested date must be a valid ISO-8601 UTC date-time" })
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

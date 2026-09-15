// src/validators/staff.validator.ts
import { z } from "zod";

export const createStaffSchema = z.object({
  name: z
    .string()
    .min(3, "Staff name must be at least 3 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),

  specialization: z
    .string()
    .max(150, "Specialization cannot exceed 150 characters")
    .optional(),

  // ✅ Added
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal('')),

  // ✅ Added
  phone: z
    .string()
    .max(20, "Phone number too long")
    .optional()
    .or(z.literal('')),

  isActive: z.boolean().default(true),

  // Links this staff record to an existing User account (which is promoted
  // to role=STAFF) so that user's login can be scoped to only this staff
  // member's own appointments/change-requests. Omit for a staff member with
  // no portal login of their own.
  user_id: z.string().uuid("Invalid user ID format").optional(),
});

export const updateStaffSchema = createStaffSchema.partial().extend({
  // Unlike create, update allows explicitly clearing the link (send
  // user_id: null) as well as setting or leaving it untouched (omit it).
  user_id: z.string().uuid("Invalid user ID format").nullable().optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
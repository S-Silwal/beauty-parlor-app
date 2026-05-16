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
});

export const updateStaffSchema = createStaffSchema.partial();

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
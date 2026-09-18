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

  // Shown on the admin Staff card and the public About page "Meet Our
  // Team" bio paragraph.
  bio: z
    .string()
    .max(500, "Bio cannot exceed 500 characters")
    .optional()
    .or(z.literal('')),

  // avatarUrl/avatarPublicId come from the client after it has already
  // uploaded to Cloudinary via the signed-upload flow (see
  // StaffService.generateSignedUploadUrl) — same pattern as hero slides
  // and service photos. Optional on create: a staff member can exist with
  // no photo yet.
  avatar: z.string().url("Invalid image URL").optional(),
  avatarPublicId: z.string().optional(),

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

  // Explicitly clearing the photo (the admin's "Remove photo" button)
  // sends avatar: null — distinct from omitting it, which leaves the
  // existing photo untouched. See StaffService.update().
  avatar: z.string().url("Invalid image URL").nullable().optional(),
  avatarPublicId: z.string().nullable().optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
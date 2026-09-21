// src/validators/loginSlide.validator.ts
import { z } from "zod";

/**
 * Create Login Slide Schema
 * `imageUrl`/`imagePublicId` come from the client after it has already
 * uploaded to Cloudinary via the signed-upload flow (see
 * LoginSlideService.generateSignedUploadUrl) — this schema validates the
 * text fields that make the slide, not the upload itself. No CTA fields
 * here (unlike hero slides) — this is a decorative backdrop, not a
 * clickable banner.
 */
export const createLoginSlideSchema = z.object({
  imageUrl: z.string().url("Invalid image URL"),
  imagePublicId: z.string().optional(),

  label: z
    .string()
    .min(1, "Label is required")
    .max(40, "Label cannot exceed 40 characters")
    .trim(),

  headline: z
    .string()
    .min(1, "Headline is required")
    .max(80, "Headline cannot exceed 80 characters")
    .trim(),

  description: z
    .string()
    .min(1, "Description is required")
    .max(300, "Description cannot exceed 300 characters")
    .trim(),

  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Update Login Slide Schema — every field optional (partial edit); a new
 * image is optional too, since "replace image without losing text" (and
 * the reverse) both have to work from the same endpoint.
 */
export const updateLoginSlideSchema = createLoginSlideSchema.partial();

/**
 * Reorder Login Slide Schema — move one slide up or down relative to its
 * current neighbor, matching the admin UI's up/down arrows.
 */
export const reorderLoginSlideSchema = z.object({
  direction: z.enum(["up", "down"], {
    message: "Direction must be 'up' or 'down'",
  }),
});

export type CreateLoginSlideInput = z.infer<typeof createLoginSlideSchema>;
export type UpdateLoginSlideInput = z.infer<typeof updateLoginSlideSchema>;
export type ReorderLoginSlideInput = z.infer<typeof reorderLoginSlideSchema>;

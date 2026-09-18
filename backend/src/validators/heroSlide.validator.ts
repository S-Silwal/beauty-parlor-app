// src/validators/heroSlide.validator.ts
import { z } from "zod";

/**
 * Create Hero Slide Schema
 * `imageUrl`/`imagePublicId` come from the client after it has already
 * uploaded to Cloudinary via the signed-upload flow (see
 * HeroSlideService.generateSignedUploadUrl) — this schema validates the
 * text/link fields that make the slide, not the upload itself.
 */
export const createHeroSlideSchema = z.object({
  imageUrl: z.string().url("Invalid image URL"),
  imagePublicId: z.string().optional(),

  title: z
    .string()
    .min(1, "Title is required")
    .max(80, "Title cannot exceed 80 characters")
    .trim(),

  titleAccent: z
    .string()
    .max(80, "Accent line cannot exceed 80 characters")
    .trim()
    .optional(),

  description: z
    .string()
    .min(1, "Description is required")
    .max(300, "Description cannot exceed 300 characters")
    .trim(),

  ctaLabel: z
    .string()
    .min(1, "Button label is required")
    .max(40, "Button label cannot exceed 40 characters")
    .trim(),

  // Internal path (e.g. "/services") or a full URL — both are valid CTA
  // targets, so this isn't restricted to z.string().url().
  ctaHref: z
    .string()
    .min(1, "Button link is required")
    .max(300, "Button link cannot exceed 300 characters")
    .trim(),

  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Update Hero Slide Schema — every field optional (partial edit); a new
 * image is optional too, since "replace image without losing text" (and
 * the reverse) both have to work from the same endpoint.
 */
export const updateHeroSlideSchema = createHeroSlideSchema.partial();

/**
 * Reorder Hero Slide Schema — move one slide up or down relative to its
 * current neighbor. Swapping sortOrder with whichever slide is adjacent
 * keeps this a single, unambiguous operation per click, matching the
 * admin UI's up/down arrows (no drag-and-drop library needed).
 */
export const reorderHeroSlideSchema = z.object({
  direction: z.enum(["up", "down"], {
    message: "Direction must be 'up' or 'down'",
  }),
});

export type CreateHeroSlideInput = z.infer<typeof createHeroSlideSchema>;
export type UpdateHeroSlideInput = z.infer<typeof updateHeroSlideSchema>;
export type ReorderHeroSlideInput = z.infer<typeof reorderHeroSlideSchema>;

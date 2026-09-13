// src/validators/review.validator.ts
import { z } from "zod";

/**
 * Create Review Schema (Customer Only)
 *
 * One review per completed appointment — enforced again at the service
 * layer (ownership + COMPLETED status + no existing review), since none
 * of that can be expressed here.
 */
export const createReviewSchema = z.object({
  appointment_id: z.string().uuid("Invalid appointment ID format"),
  rating: z
    .number({ message: "Rating is required" })
    .int("Rating must be a whole number")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  comment: z
    .string()
    .max(500, "Comment cannot exceed 500 characters")
    .optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

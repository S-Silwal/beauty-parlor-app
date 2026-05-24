// src/validators/service.validator.ts//validation logic to create, update and query services. It ensures that incoming data for service-related operations adheres to the defined structure and rules, preventing invalid data from being processed by the application.
import { z } from "zod";
import { ServiceCategory } from "@prisma/client";

/**
 * Create Service Schema
 */
export const createServiceSchema = z.object({
  name: z
    .string()
    .min(3, "Service name must be at least 3 characters")
    .max(100, "Service name cannot exceed 100 characters")
    .trim(),

  // ✅ Fixed: Proper way for nativeEnum
  category: z.nativeEnum(ServiceCategory, {
    message: "Invalid service category",
  }),

  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),

  duration: z
    .number()
    .int("Duration must be a whole number")
    .positive("Duration must be greater than 0")
    .max(480, "Duration cannot exceed 8 hours"),

  price: z
    .number()
    .positive("Price must be greater than 0")
    .max(10000, "Price seems too high"),

  is_popular: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

/**
 * Update Service Schema (Partial)
 */
export const updateServiceSchema = createServiceSchema.partial();

/**
 * Query Schema for filtering services
 */
export const getServicesQuerySchema = z.object({
  category: z.nativeEnum(ServiceCategory).optional(),
  isActive: z.boolean().optional(),
  is_popular: z.boolean().optional(),
  search: z.string().optional(),
});

// ====================== TYPES ======================
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type GetServicesQuery = z.infer<typeof getServicesQuerySchema>;
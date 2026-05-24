export * from "./auth.validator";
export * from "./appointment.validator";
export * from "./service.validator";
export * from "./staff.validator";
export * from "./user.validator";
//index file that re-exports all validators, allowing for cleaner imports elsewhere in the codebase. Instead of importing each validator individually, you can now import them all from this single file. For example, instead of writing import { registerSchema } from "./validators/auth.validator"; you can simply write import { registerSchema } from "./validators";
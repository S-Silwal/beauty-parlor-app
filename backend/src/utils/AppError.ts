// src/utils/AppError.ts
//
// A plain `throw new Error("...")` from a service always ends up as a 500
// in error.middleware.ts (it only special-cases ZodError/Prisma/JWT errors,
// then falls back to `error.statusCode || 500`). AppError lets services
// attach the right HTTP status to a business-logic error without the
// controller having to know or care — `next(error)` still works unchanged.
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

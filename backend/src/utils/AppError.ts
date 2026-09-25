// src/utils/AppError.ts
//
// A plain `throw new Error("...")` from a service always ends up as a 500
// in error.middleware.ts (it only special-cases ZodError/Prisma/JWT errors,
// then falls back to `error.statusCode || 500`). AppError lets services
// attach the right HTTP status to a business-logic error without the
// controller having to know or care — `next(error)` still works unchanged.
//
// `code` and `existingBookingId` are optional, stable machine-readable
// fields (CUSTOMER_TIME_CONFLICT | SLOT_UNAVAILABLE | DUPLICATE_BOOKING |
// DUPLICATE_SERVICE_SAME_DAY, today) so a frontend can branch on the failure reason instead of
// string-matching `message`. See error.middleware.ts for how these surface
// in the JSON response.
export class AppError extends Error {
  statusCode: number;
  code?: string;
  existingBookingId?: string;

  constructor(message: string, statusCode: number = 400, code?: string, existingBookingId?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.existingBookingId = existingBookingId;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

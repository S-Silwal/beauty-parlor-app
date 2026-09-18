// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  // Stable machine-readable failure reason (e.g. CUSTOMER_TIME_CONFLICT,
  // SLOT_UNAVAILABLE, DUPLICATE_BOOKING) so a client can branch on it
  // instead of string-matching `message`. See utils/AppError.ts.
  code?: string;
  existingBookingId?: string;
}

/**
 * Global Error Handling Middleware
 * Should be the LAST middleware in server.ts
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const error = { ...err };
  error.message = err.message || "Internal Server Error";

  // ====================== ZOD VALIDATION ERROR ======================
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: err.issues.map((issue) => ({     // ← Fixed: Use .issues
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // ====================== PRISMA ERRORS ======================
  if (err.name === "PrismaClientKnownRequestError") {
    if (err.message.includes("Unique constraint")) {
      return res.status(409).json({
        success: false,
        message: "This record already exists",
      });
    }
  }

  // ====================== JWT ERRORS ======================
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Your session has expired. Please login again.",
    });
  }

  // ====================== DEFAULT ERROR ======================
  const statusCode = error.statusCode || 500;
  const status = error.status || "error";

  // Structured + correlated to req.requestId (see requestContext.middleware
  // and utils/logger.ts) — this is what lets a 500 here be tied back to
  // whatever background job (e.g. a notification send) it also broke,
  // instead of two unrelated-looking console lines.
  logger.error("request failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    errorName: err.name,
    errorMessage: error.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });

  res.status(statusCode).json({
    success: false,
    status,
    message: error.message,
    // Both fields are omitted entirely when not set, so this is fully
    // backward-compatible with clients that only ever read `message`.
    ...(error.code && { error: error.code }),
    ...(error.existingBookingId && { existingBookingId: error.existingBookingId }),
    requestId: req.requestId,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
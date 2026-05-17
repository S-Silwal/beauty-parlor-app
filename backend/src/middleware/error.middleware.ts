// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
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

  if (process.env.NODE_ENV === "development") {
    console.error(`[ERROR] ${req.method} ${req.url}`);
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    status,
    message: error.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
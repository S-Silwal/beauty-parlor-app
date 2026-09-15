// src/middleware/requestContext.middleware.ts
//
// Assigns every incoming request a unique ID (also echoed back as the
// X-Request-Id response header, so a customer/support report of "it failed"
// can be tied back to a specific server-side log line) and logs a single
// structured line per request on completion — method, path, status code,
// duration, and the request ID. See utils/logger.ts and H6 in
// PRODUCTION_READINESS_AUDIT.md for why this exists.
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? "error" : "info";
    logger[level]("request completed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}

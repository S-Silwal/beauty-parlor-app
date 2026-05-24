// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authConfig } from "../config/auth";
/**
 * Extended Express Request Interface
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

/**
 * JWT Authentication Middleware
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Access token is required. Use format: Bearer <token>",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
      return;
    }

  const decoded = jwt.verify(token, authConfig.jwtSecret) as {
  userId: string;
  role: string;
};

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({ success: false, message: "Token has expired. Please login again." });
    } else if (error.name === "JsonWebTokenError") {
      res.status(401).json({ success: false, message: "Invalid token" });
    } else {
      res.status(401).json({ success: false, message: "Authentication failed" });
    }
  }
};
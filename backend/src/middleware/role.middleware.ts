// src/middleware/role.middleware.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

/**
 * Role-based Authorization Middleware
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please login.",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
        yourRole: req.user.role,
      });
      return;
    }

    next();
  };
};

// ====================== CONVENIENCE MIDDLEWARES ======================
export const isAdmin = authorize(["ADMIN"]);
export const isStaff = authorize(["STAFF"]);
export const isStaffOrAdmin = authorize(["STAFF", "ADMIN"]);
export const isCustomer = authorize(["CUSTOMER"]);
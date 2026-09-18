// src/controllers/changeRequest.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { ChangeRequestService } from "../services/changeRequest.service";
import { StaffService } from "../services/staff.service";
import {
  requestEditSchema,
  requestCancelSchema,
  resolveChangeRequestSchema,
} from "../validators/changeRequest.validator";

export class ChangeRequestController {
  // ====================== CUSTOMER ======================
  static async requestEdit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const { id } = req.params;
      const validated = requestEditSchema.parse(req.body);

      const request = await ChangeRequestService.requestEdit(req.user.userId, id, {
        requested_date: validated.requested_date ? new Date(validated.requested_date) : undefined,
        requested_staff_id: validated.requested_staff_id,
        requested_service_id: validated.requested_service_id,
      });

      res.status(201).json({
        success: true,
        message: "Your change request has been submitted for approval.",
        request,
      });
    } catch (error) {
      next(error);
    }
  }

  static async requestCancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const { id } = req.params;
      const validated = requestCancelSchema.parse(req.body);

      const request = await ChangeRequestService.requestCancel(req.user.userId, id, validated.reason);

      res.status(201).json({
        success: true,
        message: "Your cancellation request has been submitted for approval.",
        request,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const requests = await ChangeRequestService.getMyRequests(req.user.userId);
      res.json({ success: true, requests });
    } catch (error) {
      next(error);
    }
  }

  static async withdraw(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

      const { id } = req.params;
      const request = await ChangeRequestService.withdraw(req.user.userId, id);

      res.json({ success: true, message: "Request withdrawn.", request });
    } catch (error) {
      next(error);
    }
  }

  // ====================== ADMIN / STAFF ======================
  // Role is already enforced by isStaffOrAdmin middleware on these routes.
  // A STAFF caller is further scoped to only requests against their own
  // assigned appointments — see StaffService.resolveCallerStaffId().
  static async getPending(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const staffId = await StaffService.resolveCallerStaffId(req.user!);
      const requests = await ChangeRequestService.getPendingRequests({ staffId });
      res.json({ success: true, requests });
    } catch (error) {
      next(error);
    }
  }

  static async resolve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = resolveChangeRequestSchema.parse(req.body);
      const staffId = await StaffService.resolveCallerStaffId(req.user!);

      const request = await ChangeRequestService.resolve(
        id,
        validated.decision,
        validated.decline_reason,
        staffId
      );

      res.json({
        success: true,
        message: `Request ${validated.decision.toLowerCase()}`,
        request,
      });
    } catch (error) {
      next(error);
    }
  }
}

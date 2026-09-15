// src/services/staff.service.ts
import { prisma } from "../config/database";
import { Prisma } from "@prisma/client";
import { CreateStaffInput, UpdateStaffInput } from "../validators/staff.validator";
import { AppError } from "../utils/AppError";
import { recordAuditLog, diffFields, AuditActor } from "./adminAuditLog.service";

type Tx = Prisma.TransactionClient;

// Fields safe to hand back on the public GET /api/staff listing. Excludes
// user_id — that's an internal linkage to a login account and has no
// business being visible to an unauthenticated visitor picking a stylist.
const PUBLIC_STAFF_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  specialization: true,
  bio: true,
  avatar: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class StaffService {

  static async getAll() {
    return await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: PUBLIC_STAFF_SELECT,
    });
  }

  // Admin-only listing (see GET /api/staff/admin) — includes `user_id` and a
  // summary of the linked login account, which the public listing above
  // deliberately withholds. This is what the admin Staff Management UI uses
  // so it can show/edit the staff<->login link.
  static async getAllForAdmin() {
    return await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  // Resolves the linked User account for a `user_id` staff-link request,
  // enforcing the rules that make the link meaningful:
  //  - the user must actually exist
  //  - an admin account can never be relinked as staff (would silently
  //    strip their admin role — see the promotion below)
  //  - the user can't already be linked to a *different* staff row
  // Returns nothing; throws AppError on any violation.
  private static async assertLinkable(userId: string, staffIdBeingLinked?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("No user found with that ID", 404);
    if (user.role === "ADMIN") {
      throw new AppError("Cannot link an admin account as a staff member", 409);
    }

    const existingLink = await prisma.staff.findUnique({ where: { user_id: userId } });
    if (existingLink && existingLink.id !== staffIdBeingLinked) {
      throw new AppError("That user is already linked to a different staff member", 409);
    }
  }

  static async create(data: CreateStaffInput) {
    if (data.user_id) {
      await StaffService.assertLinkable(data.user_id);
    }

    // Creating the staff row and promoting the linked user to STAFF must
    // succeed or fail together — a staff row pointing at a user who never
    // actually got the STAFF role (or vice versa) is exactly the broken
    // half-state that made staff scoping impossible before this existed.
    return await prisma.$transaction(async (tx: Tx) => {
      const staff = await tx.staff.create({
        data: {
          name:           data.name,
          specialization: data.specialization,
          email:          data.email,
          phone:          data.phone,
          isActive:       data.isActive ?? true,
          user_id:        data.user_id,
        },
      });

      if (data.user_id) {
        await tx.user.update({ where: { id: data.user_id }, data: { role: "STAFF" } });
      }

      return staff;
    });
  }

  static async update(id: string, data: UpdateStaffInput, actor?: AuditActor) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new AppError("Staff member not found", 404);

    const isLinking = data.user_id !== undefined && data.user_id !== null;
    const isUnlinking = data.user_id === null && staff.user_id !== null;

    if (isLinking) {
      await StaffService.assertLinkable(data.user_id as string, id);
    }

    const result = await prisma.$transaction(async (tx: Tx) => {
      const updated = await tx.staff.update({
        where: { id },
        data: {
          name:           data.name,
          specialization: data.specialization,
          email:          data.email,
          phone:          data.phone,
          isActive:       data.isActive,
          ...(data.user_id !== undefined && { user_id: data.user_id }),
        },
      });

      if (isLinking) {
        await tx.user.update({ where: { id: data.user_id as string }, data: { role: "STAFF" } });
      } else if (isUnlinking) {
        // Demote back to CUSTOMER — a staff member unlinked from their
        // profile shouldn't retain STAFF-gated dashboard access. (The
        // admin-guard in assertLinkable means this is never an ADMIN.)
        await tx.user.update({
          where: { id: staff.user_id as string },
          data: { role: "CUSTOMER" },
        }).catch(() => {
          // The linked user may have been deleted independently; the FK's
          // ON DELETE SET NULL already cleared staff.user_id in that case,
          // so there's nothing left to demote.
        });
      }

      return updated;
    });

    recordAuditLog({
      actor,
      action:     "STAFF_UPDATE",
      entityType: "Staff",
      entityId:   id,
      changes: diffFields(
        { name: staff.name, specialization: staff.specialization, email: staff.email, phone: staff.phone, isActive: staff.isActive },
        { name: data.name, specialization: data.specialization, email: data.email, phone: data.phone, isActive: data.isActive }
      ),
    }).catch(() => {});

    return result;
  }

  // ✅ Soft delete — sets isActive to false instead of deleting from DB
  // This preserves historical appointment records that reference this staff
  static async delete(id: string) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new AppError("Staff member not found", 404);

    return await prisma.$transaction(async (tx: Tx) => {
      const updated = await tx.staff.update({
        where: { id },
        data: { isActive: false, user_id: null },
      });

      if (staff.user_id) {
        await tx.user.update({
          where: { id: staff.user_id },
          data: { role: "CUSTOMER" },
        }).catch(() => {
          // Same as update() above — user may already be gone.
        });
      }

      return updated;
    });
  }

  // ── Staff-scoping support ───────────────────────────────────────────────
  // Resolves which Staff row (if any) a logged-in user corresponds to, and
  // decides what a caller with this role is allowed to see:
  //  - ADMIN: undefined (no filter — sees everything, as before)
  //  - STAFF: their own staff.id, so callers can filter to just that
  //  - STAFF with no linked staff row: a 403, rather than silently showing
  //    everything (the pre-existing bug this replaces) or nothing.
  static async resolveCallerStaffId(user: { userId: string; role: string }): Promise<string | undefined> {
    if (user.role !== "STAFF") return undefined;

    const staff = await prisma.staff.findUnique({ where: { user_id: user.userId } });
    if (!staff) {
      throw new AppError(
        "Your account isn't linked to a staff profile yet. Ask an admin to link it before you can view or manage bookings.",
        403
      );
    }
    return staff.id;
  }
}

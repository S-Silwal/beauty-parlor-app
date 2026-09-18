// src/services/staff.service.ts
import { prisma } from "../config/database";
import { Prisma } from "@prisma/client";
import { CreateStaffInput, UpdateStaffInput } from "../validators/staff.validator";
import { AppError } from "../utils/AppError";
import { recordAuditLog, diffFields, AuditActor } from "./adminAuditLog.service";
import {
  cloudinary,
  extractCloudinaryPublicId,
  verifyCloudinaryImage,
  ALLOWED_IMAGE_FORMATS,
} from "../config/cloudinary";
import crypto from "crypto";
import { emitStaffUpdated } from "../socket";

type Tx = Prisma.TransactionClient;

// Same "beauty-parlor/<feature>" namespacing GalleryService/HeroSlideService use.
const STAFF_FOLDER = "beauty-parlor/staff";

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

  // ── Generate signed Cloudinary upload URL ─────────────────────────────────
  // Identical pattern to HeroSlideService/GalleryService — the frontend
  // uploads the staff photo straight to Cloudinary with this signature, so
  // the image bytes never pass through our server.
  static async generateSignedUploadUrl() {
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!apiSecret || !apiKey || !cloudName) {
      throw new AppError(
        "Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
        503
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = STAFF_FOLDER;
    const allowedFormats = ALLOWED_IMAGE_FORMATS.join(",");

    const paramsToSign = `allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha256")
      .update(paramsToSign + apiSecret)
      .digest("hex");

    return {
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      allowedFormats,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }

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

    // Re-verify the uploaded photo against Cloudinary's own record before
    // trusting it — see verifyCloudinaryImage()'s comment in
    // config/cloudinary for why the signed params alone aren't enough.
    if (data.avatar) {
      await verifyCloudinaryImage(data.avatar, STAFF_FOLDER);
    }

    // Creating the staff row and promoting the linked user to STAFF must
    // succeed or fail together — a staff row pointing at a user who never
    // actually got the STAFF role (or vice versa) is exactly the broken
    // half-state that made staff scoping impossible before this existed.
    const staff = await prisma.$transaction(async (tx: Tx) => {
      const created = await tx.staff.create({
        data: {
          name:           data.name,
          specialization: data.specialization,
          email:          data.email,
          phone:          data.phone,
          bio:            data.bio,
          avatar:         data.avatar,
          avatarPublicId: data.avatarPublicId,
          isActive:       data.isActive ?? true,
          user_id:        data.user_id,
        },
      });

      if (data.user_id) {
        await tx.user.update({ where: { id: data.user_id }, data: { role: "STAFF" } });
      }

      return created;
    });

    // Best-effort — a new staff member (if isActive) can now show up on the
    // public About page's "Meet Our Team" section without a manual refresh.
    emitStaffUpdated();

    return staff;
  }

  static async update(id: string, data: UpdateStaffInput, actor?: AuditActor) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new AppError("Staff member not found", 404);

    const isLinking = data.user_id !== undefined && data.user_id !== null;
    const isUnlinking = data.user_id === null && staff.user_id !== null;

    if (isLinking) {
      await StaffService.assertLinkable(data.user_id as string, id);
    }

    // Photo handling mirrors HeroSlideService.updateSlide: `avatar` is
    // omitted entirely for a text-only edit (existing photo untouched),
    // `null` for the admin's explicit "Remove photo" action, or a genuinely
    // new Cloudinary URL to replace the current one. Only a real
    // replacement needs re-verifying against Cloudinary's own record.
    const isRemovingAvatar = data.avatar === null;
    const isReplacingAvatar = typeof data.avatar === "string" && data.avatar !== staff.avatar;
    if (isReplacingAvatar) {
      await verifyCloudinaryImage(data.avatar as string, STAFF_FOLDER);
    }

    const result = await prisma.$transaction(async (tx: Tx) => {
      const updated = await tx.staff.update({
        where: { id },
        data: {
          name:           data.name,
          specialization: data.specialization,
          email:          data.email,
          phone:          data.phone,
          bio:            data.bio,
          isActive:       data.isActive,
          ...(data.user_id !== undefined && { user_id: data.user_id }),
          ...(isReplacingAvatar && { avatar: data.avatar, avatarPublicId: data.avatarPublicId }),
          ...(isRemovingAvatar && { avatar: null, avatarPublicId: null }),
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

    // Clean up the old Cloudinary asset once the DB write has committed —
    // a replaced or removed photo shouldn't linger as an orphaned upload.
    if (isReplacingAvatar || isRemovingAvatar) {
      const oldPublicId = staff.avatarPublicId ?? (staff.avatar ? extractCloudinaryPublicId(staff.avatar) : null);
      if (oldPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId);
        } catch (err: any) {
          console.error(`⚠️  Failed to delete replaced/removed staff photo ${oldPublicId}:`, err.message);
        }
      }
    }

    recordAuditLog({
      actor,
      action:     "STAFF_UPDATE",
      entityType: "Staff",
      entityId:   id,
      changes: diffFields(
        { name: staff.name, specialization: staff.specialization, email: staff.email, phone: staff.phone, bio: staff.bio, isActive: staff.isActive },
        { name: data.name, specialization: data.specialization, email: data.email, phone: data.phone, bio: data.bio, isActive: data.isActive }
      ),
    }).catch(() => {});

    // Best-effort — covers name/photo/bio edits AND an isActive flip, so
    // the public About page (which only shows isActive staff) updates
    // immediately either way.
    emitStaffUpdated();

    return result;
  }

  // ✅ Soft delete — sets isActive to false instead of deleting from DB
  // This preserves historical appointment records that reference this staff.
  // The Cloudinary photo, if any, is deliberately left alone (not
  // destroyed) — a soft-deleted staff member can be reactivated later via
  // update(), and their photo should still be there when that happens.
  static async delete(id: string) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new AppError("Staff member not found", 404);

    const updated = await prisma.$transaction(async (tx: Tx) => {
      const result = await tx.staff.update({
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

      return result;
    });

    // Best-effort — this staff member should disappear from the public
    // About page immediately, same as any other isActive flip.
    emitStaffUpdated();

    return updated;
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

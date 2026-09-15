// src/services/user.service.ts
import { prisma } from "../config/database";
import bcrypt from "bcryptjs";
import { UpdateProfileInput, ChangePasswordInput } from "../validators/user.validator";
import { AuthService } from "./auth.service";
import { authConfig } from "../config/auth";
import { AppError } from "../utils/AppError";

export class UserService {

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_verified: true,
        mfa_enabled: true,
        created_at: true,
      },
    });

    if (!user) throw new AppError("User not found", 404);
    return user;
  }

  static async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);

    const updateData: { name?: string; email?: string; is_verified?: boolean } = {
      name: data.name,
    };

    // Changing the email means the new address hasn't been proven to belong
    // to this user — check it isn't already someone else's, then require
    // re-verification the same way a fresh registration would.
    const emailChanged = data.email !== undefined && data.email !== user.email;
    if (emailChanged) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new AppError("This email is already in use by another account", 409);

      updateData.email = data.email;
      updateData.is_verified = false;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_verified: true,
      },
    });

    if (emailChanged) {
      await AuthService.sendVerificationEmail(updated.id, updated.email, updated.name);
    }

    return updated;
  }

  // ── Admin: list accounts (to link one as staff, etc.) ───────────────────────
  // Excludes ADMIN accounts — StaffService.assertLinkable() already refuses
  // to link an admin as staff, so there's no reason to surface them here as
  // candidates. No pagination: fine for a single-salon staff/customer list;
  // revisit if this ever needs to scale past a few hundred accounts.
  static async listAccounts() {
    return prisma.user.findMany({
      where: { role: { in: ["CUSTOMER", "STAFF"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  static async changePassword(userId: string, data: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password_hash: true },
    });

    if (!user) throw new AppError("User not found", 404);

    const isMatch = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!isMatch) throw new AppError("Current password is incorrect", 401);

    const newPasswordHash = await bcrypt.hash(data.newPassword, authConfig.bcryptRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newPasswordHash },
    });

    // Revoke existing sessions — a stolen refresh token shouldn't survive a
    // password change (mirrors AuthService.resetPassword).
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } });

    return { message: "Password changed successfully" };
  }
}
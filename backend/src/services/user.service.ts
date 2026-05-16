// src/services/user.service.ts
import { prisma } from "../config/database";
import bcrypt from "bcryptjs";
import { UpdateProfileInput, ChangePasswordInput } from "../validators/user.validator";

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

    if (!user) throw new Error("User not found");
    return user;
  }

  static async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    return await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
  }

  static async changePassword(userId: string, data: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password_hash: true },
    });

    if (!user) throw new Error("User not found");

    const isMatch = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!isMatch) throw new Error("Current password is incorrect");

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(data.newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newPasswordHash },
    });

    return { message: "Password changed successfully" };
  }
}
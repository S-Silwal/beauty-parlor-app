// src/services/staff.service.ts
import { prisma } from "../config/database";
import { CreateStaffInput, UpdateStaffInput } from "../validators/staff.validator";

export class StaffService {

  static async getAll() {
    return await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  static async create(data: CreateStaffInput) {
    return await prisma.staff.create({
      data: {
        name:           data.name,
        specialization: data.specialization,
        email:          data.email,
        phone:          data.phone,
        isActive:       data.isActive ?? true,
      },
    });
  }

  static async update(id: string, data: UpdateStaffInput) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new Error("Staff member not found");

    return await prisma.staff.update({
      where: { id },
      data: {
        name:           data.name,
        specialization: data.specialization,
        email:          data.email,
        phone:          data.phone,
        isActive:       data.isActive,
      },
    });
  }

  // ✅ Soft delete — sets isActive to false instead of deleting from DB
  // This preserves historical appointment records that reference this staff
  static async delete(id: string) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new Error("Staff member not found");

    return await prisma.staff.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
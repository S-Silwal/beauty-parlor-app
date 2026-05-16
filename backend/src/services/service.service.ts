// src/services/service.service.ts
import { prisma } from "../config/database";
import { CreateServiceInput, UpdateServiceInput } from "../validators/service.validator";

export class ServiceService {

  static async getAll() {
    return await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  static async create(data: CreateServiceInput) {
    return await prisma.service.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description,
        duration: data.duration,
        price: data.price,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async update(id: string, data: UpdateServiceInput) {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new Error("Service not found");

    return await prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        duration: data.duration,
        price: data.price,
        isActive: data.isActive,
      },
    });
  }

  static async delete(id: string) {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new Error("Service not found");

    // Soft delete (recommended) or hard delete
    return await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
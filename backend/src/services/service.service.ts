// src/services/service.service.ts
import { prisma } from "../config/database";
import crypto from "crypto";
import { CreateServiceInput, UpdateServiceInput } from "../validators/service.validator";
import { AppError } from "../utils/AppError";

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
        image: data.image,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async update(id: string, data: UpdateServiceInput) {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new AppError("Service not found", 404);

    return await prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category, // was missing — updateServiceSchema allows it, but it was silently dropped
        description: data.description,
        duration: data.duration,
        price: data.price,
        image: data.image,
        isActive: data.isActive,
      },
    });
  }

  // ── Generate signed Cloudinary upload URL ─────────────────────────────────
  // Mirrors GalleryService.generateSignedUploadUrl but uploads into a
  // dedicated folder so service photos and gallery photos don't mix.
  // The frontend uploads directly to Cloudinary with this signature.
  static async generateSignedUploadUrl() {
    const apiSecret  = process.env.CLOUDINARY_API_SECRET;
    const apiKey     = process.env.CLOUDINARY_API_KEY;
    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;

    if (!apiSecret || !apiKey || !cloudName) {
      throw new AppError(
        "Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
        503
      );
    }

    const timestamp  = Math.round(Date.now() / 1000);
    const folder     = "beauty-parlor/services";

    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature    = crypto
      .createHash("sha256")
      .update(paramsToSign + apiSecret)
      .digest("hex");

    return {
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }

  static async delete(id: string) {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new AppError("Service not found", 404);

    // Soft delete (recommended) or hard delete
    return await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
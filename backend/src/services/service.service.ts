// src/services/service.service.ts
import { prisma } from "../config/database";
import crypto from "crypto";
import { CreateServiceInput, UpdateServiceInput } from "../validators/service.validator";
import { AppError } from "../utils/AppError";
import { verifyCloudinaryImage, ALLOWED_IMAGE_FORMATS } from "../config/cloudinary";
import { recordAuditLog, diffFields, AuditActor } from "./adminAuditLog.service";

const SERVICE_IMAGE_FOLDER = "beauty-parlor/services";

export class ServiceService {

  static async getAll() {
    return await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  static async create(data: CreateServiceInput) {
    // Same trust gap as GalleryService.saveImage() — an `image` URL isn't
    // taken at face value, it's checked against Cloudinary's own record of
    // the asset first. See verifyCloudinaryImage()'s comment for why.
    if (data.image) {
      await verifyCloudinaryImage(data.image, SERVICE_IMAGE_FOLDER);
    }

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

  static async update(id: string, data: UpdateServiceInput, actor?: AuditActor) {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new AppError("Service not found", 404);

    // Only re-verify when the image is actually changing — an unrelated
    // field update on an already-trusted image shouldn't re-hit Cloudinary.
    if (data.image && data.image !== service.image) {
      await verifyCloudinaryImage(data.image, SERVICE_IMAGE_FOLDER);
    }

    const updated = await prisma.service.update({
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

    // Price changes especially are exactly the kind of edit that needs a
    // who/when trail — "No admin audit log for price/status/customer-data
    // changes" in the hardening audit.
    recordAuditLog({
      actor,
      action:     "SERVICE_UPDATE",
      entityType: "Service",
      entityId:   id,
      changes: diffFields(
        { name: service.name, category: service.category, price: service.price, duration: service.duration, isActive: service.isActive },
        { name: data.name, category: data.category, price: data.price, duration: data.duration, isActive: data.isActive }
      ),
    }).catch(() => {});

    return updated;
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

    const timestamp      = Math.round(Date.now() / 1000);
    const folder         = SERVICE_IMAGE_FOLDER;
    const allowedFormats = ALLOWED_IMAGE_FORMATS.join(",");

    // Alphabetical order (allowed_formats, folder, timestamp) — how
    // Cloudinary itself builds the string it verifies the signature against.
    const paramsToSign = `allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}`;
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
      allowedFormats,
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
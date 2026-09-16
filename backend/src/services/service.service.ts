// src/services/service.service.ts
import { prisma } from "../config/database";
import crypto from "crypto";
import { CreateServiceInput, UpdateServiceInput } from "../validators/service.validator";
import { AppError } from "../utils/AppError";
import { verifyCloudinaryImage, ALLOWED_IMAGE_FORMATS } from "../config/cloudinary";
import { recordAuditLog, diffFields, AuditActor } from "./adminAuditLog.service";
import { PageParams, PaginatedResult } from "../utils/pagination";

const SERVICE_IMAGE_FOLDER = "beauty-parlor/services";

export class ServiceService {

  // `pagination` is optional and opt-in (see utils/pagination.ts) — omit it
  // and this returns the full array exactly as before, so the existing
  // admin services table is unaffected until it adds a page control.
  // Mirrors AppointmentService.getAllServices/getAllStaff, which already
  // used this same convention for the public booking-page listings (H7 in
  // the audit flagged this method specifically as the one list endpoint
  // that never got it).
  static async getAll(pagination?: PageParams): Promise<any[] | PaginatedResult<any>> {
    const where = { isActive: true };
    const orderBy = { name: "asc" as const };

    if (!pagination) {
      return await prisma.service.findMany({ where, orderBy });
    }

    const [items, total] = await Promise.all([
      prisma.service.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take }),
      prisma.service.count({ where }),
    ]);
    return { items, total, page: pagination.page, limit: pagination.limit };
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
        { name: service.name, category: service.category, price: service.price.toNumber(), duration: service.duration, isActive: service.isActive },
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
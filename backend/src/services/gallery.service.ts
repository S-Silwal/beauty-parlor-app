// src/services/gallery.service.ts
import { prisma } from "../config/database";
import {
  cloudinary,
  extractCloudinaryPublicId,
  verifyCloudinaryImage,
  ALLOWED_IMAGE_FORMATS,
} from "../config/cloudinary";
import crypto from "crypto";
import { AppError } from "../utils/AppError";
import { PageParams, PaginatedResult } from "../utils/pagination";

const GALLERY_FOLDER = "beauty-parlor/gallery";

export class GalleryService {

  // ── Get all active images ─────────────────────────────────────────────────
  // `pagination` is optional and opt-in (see utils/pagination.ts) — omit it
  // and this returns the full array exactly as before.
  static async getAllImages(pagination?: PageParams): Promise<any[] | PaginatedResult<any>> {
    const where = { is_active: true };
    if (!pagination) {
      return await prisma.galleryImage.findMany({ where, orderBy: { created_at: "desc" } });
    }

    const [items, total] = await Promise.all([
      prisma.galleryImage.findMany({
        where, orderBy: { created_at: "desc" }, skip: pagination.skip, take: pagination.take,
      }),
      prisma.galleryImage.count({ where }),
    ]);
    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  // ── Generate signed Cloudinary upload URL ─────────────────────────────────
  // Frontend uploads directly to Cloudinary using this signature
  // This is the industry-standard approach — image never hits your server
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

    const timestamp     = Math.round(Date.now() / 1000);
    const folder        = GALLERY_FOLDER;
    const allowedFormats = ALLOWED_IMAGE_FORMATS.join(",");

    // Signed params must be included here in the exact string Cloudinary is
    // told to verify — alphabetical order (allowed_formats, folder,
    // timestamp) is how Cloudinary itself builds the string to sign.
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

  // ── Save image record to DB after Cloudinary upload ───────────────────────
  // Re-verifies the asset against Cloudinary's own record before trusting it
  // — see verifyCloudinaryImage()'s comment for why the signed params alone
  // aren't enough. Any URL that isn't a real, in-policy asset in this
  // account's gallery folder is rejected (and cleaned up if it does exist
  // but violates policy) rather than persisted.
  static async saveImage(data: {
    url:        string;
    public_id?: string;
    alt_text?:  string;
    category?:  string;
  }) {
    await verifyCloudinaryImage(data.url, GALLERY_FOLDER);

    return await prisma.galleryImage.create({
      data: {
        url:          data.url,
        alt_text:     data.alt_text || "",
        category:     data.category || "general",
        is_active:    true,
        uploaded_by:  "ADMIN",
      },
    });
  }

  // ── Legacy: upload file through server → Cloudinary ──────────────────────
  static async uploadImage(file: Express.Multer.File, category: string = "gallery") {
    const result = await cloudinary.uploader.upload(
      `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      { folder: "beauty-parlor/gallery", resource_type: "image" }
    );

    return await prisma.galleryImage.create({
      data: {
        url:         result.secure_url,
        alt_text:    file.originalname,
        category,
        is_active:   true,
        uploaded_by: "ADMIN",
      },
    });
  }

  // ── Soft delete (DB) + hard delete (Cloudinary storage) ───────────────────
  static async deleteImage(id: string) {
    const image = await prisma.galleryImage.findUnique({ where: { id } });
    if (!image) throw new AppError("Image not found", 404);

    const publicId = extractCloudinaryPublicId(image.url);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err: any) {
        // Best-effort — a storage cleanup failure shouldn't block removing
        // the image from the gallery.
        console.error(`⚠️  Failed to delete Cloudinary asset ${publicId}:`, err.message);
      }
    }

    await prisma.galleryImage.update({
      where: { id },
      data: { is_active: false },
    });

    return { success: true, message: "Image removed from gallery" };
  }
}
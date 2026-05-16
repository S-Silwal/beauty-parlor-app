// src/services/gallery.service.ts
import { prisma } from "../config/database";
import { cloudinary } from "../config/cloudinary";
import crypto from "crypto";

export class GalleryService {

  // ── Get all active images ─────────────────────────────────────────────────
  static async getAllImages() {
    return await prisma.galleryImage.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
    });
  }

  // ── Generate signed Cloudinary upload URL ─────────────────────────────────
  // Frontend uploads directly to Cloudinary using this signature
  // This is the industry-standard approach — image never hits your server
  static async generateSignedUploadUrl() {
    const timestamp  = Math.round(Date.now() / 1000);
    const folder     = "beauty-parlor/gallery";
    const apiSecret  = process.env.CLOUDINARY_API_SECRET!;
    const apiKey     = process.env.CLOUDINARY_API_KEY!;
    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME!;

    // Create signature string
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

  // ── Save image record to DB after Cloudinary upload ───────────────────────
  static async saveImage(data: {
    url:        string;
    public_id?: string;
    alt_text?:  string;
    category?:  string;
  }) {
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

  // ── Soft delete ───────────────────────────────────────────────────────────
  static async deleteImage(id: string) {
    const image = await prisma.galleryImage.findUnique({ where: { id } });
    if (!image) throw new Error("Image not found");

    await prisma.galleryImage.update({
      where: { id },
      data: { is_active: false },
    });

    return { success: true, message: "Image removed from gallery" };
  }
}
// src/services/loginSlide.service.ts
import { prisma } from "../config/database";
import {
  cloudinary,
  extractCloudinaryPublicId,
  verifyCloudinaryImage,
  ALLOWED_IMAGE_FORMATS,
} from "../config/cloudinary";
import crypto from "crypto";
import { AppError } from "../utils/AppError";

// Same "beauty-parlor/<feature>" namespacing GalleryService/HeroSlideService use.
const LOGIN_SLIDE_FOLDER = "beauty-parlor/login-slides";

export class LoginSlideService {
  // ── Public: active slides only, in on-page order ──────────────────────────
  static async getActiveSlides() {
    return prisma.loginSlide.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  // ── Admin: every slide, active or not ──────────────────────────────────────
  static async getAllSlides() {
    return prisma.loginSlide.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  // ── Generate signed Cloudinary upload URL ─────────────────────────────────
  // Identical pattern to HeroSlideService/GalleryService.generateSignedUploadUrl.
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
    const folder = LOGIN_SLIDE_FOLDER;
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

  // ── Create a slide ─────────────────────────────────────────────────────────
  static async createSlide(data: {
    imageUrl: string;
    imagePublicId?: string;
    label: string;
    headline: string;
    description: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    await verifyCloudinaryImage(data.imageUrl, LOGIN_SLIDE_FOLDER);

    // New slides default to the end of the sequence unless a position was
    // explicitly given, so adding one never silently reorders the others.
    const sortOrder =
      data.sortOrder ??
      ((await prisma.loginSlide.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;

    return prisma.loginSlide.create({
      data: {
        imageUrl: data.imageUrl,
        imagePublicId: data.imagePublicId,
        label: data.label,
        headline: data.headline,
        description: data.description,
        sortOrder,
        isActive: data.isActive ?? true,
      },
    });
  }

  // ── Update a slide ──────────────────────────────────────────────────────────
  // "Replace image without losing text": imageUrl is optional here — when
  // it's provided (a genuinely new upload, not just re-saving the same
  // URL), the new asset is verified and the old one is cleaned up from
  // Cloudinary storage so replacing a photo doesn't leak orphaned assets.
  // Text-only edits never touch Cloudinary at all.
  static async updateSlide(
    id: string,
    data: {
      imageUrl?: string;
      imagePublicId?: string;
      label?: string;
      headline?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.loginSlide.findUnique({ where: { id } });
    if (!existing) throw new AppError("Login slide not found", 404);

    const replacingImage = !!data.imageUrl && data.imageUrl !== existing.imageUrl;
    if (replacingImage) {
      await verifyCloudinaryImage(data.imageUrl!, LOGIN_SLIDE_FOLDER);
    }

    const updated = await prisma.loginSlide.update({
      where: { id },
      data: {
        ...(replacingImage && { imageUrl: data.imageUrl, imagePublicId: data.imagePublicId }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.headline !== undefined && { headline: data.headline }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    if (replacingImage) {
      const oldPublicId = existing.imagePublicId ?? extractCloudinaryPublicId(existing.imageUrl);
      if (oldPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId);
        } catch (err: any) {
          console.error(`⚠️  Failed to delete replaced login-slide image ${oldPublicId}:`, err.message);
        }
      }
    }

    return updated;
  }

  // ── Reorder: swap sortOrder with the adjacent slide in that direction ─────
  static async reorderSlide(id: string, direction: "up" | "down") {
    const slides = await prisma.loginSlide.findMany({ orderBy: { sortOrder: "asc" } });
    const index = slides.findIndex((s) => s.id === id);
    if (index === -1) throw new AppError("Login slide not found", 404);

    const swapWithIndex = direction === "up" ? index - 1 : index + 1;
    if (swapWithIndex < 0 || swapWithIndex >= slides.length) {
      // Already first/last — nothing to do, not an error (a UI that just
      // disables the boundary arrow could still race a click here).
      return slides;
    }

    const current = slides[index];
    const neighbor = slides[swapWithIndex];

    await prisma.$transaction([
      prisma.loginSlide.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }),
      prisma.loginSlide.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } }),
    ]);

    return prisma.loginSlide.findMany({ orderBy: { sortOrder: "asc" } });
  }

  // ── Delete a slide (Cloudinary asset + row) ────────────────────────────────
  static async deleteSlide(id: string) {
    const slide = await prisma.loginSlide.findUnique({ where: { id } });
    if (!slide) throw new AppError("Login slide not found", 404);

    const publicId = slide.imagePublicId ?? extractCloudinaryPublicId(slide.imageUrl);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err: any) {
        // Best-effort — a storage cleanup failure shouldn't block removing
        // the slide itself.
        console.error(`⚠️  Failed to delete Cloudinary asset ${publicId}:`, err.message);
      }
    }

    await prisma.loginSlide.delete({ where: { id } });
    return { success: true, message: "Login slide deleted" };
  }
}

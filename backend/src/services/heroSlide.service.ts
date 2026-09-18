// src/services/heroSlide.service.ts
import { prisma } from "../config/database";
import {
  cloudinary,
  extractCloudinaryPublicId,
  verifyCloudinaryImage,
  ALLOWED_IMAGE_FORMATS,
} from "../config/cloudinary";
import crypto from "crypto";
import { AppError } from "../utils/AppError";

// Same "beauty-parlor/<feature>" namespacing GalleryService uses.
const HERO_FOLDER = "beauty-parlor/hero";

export class HeroSlideService {
  // ── Public: active slides only, in on-page order ──────────────────────────
  static async getActiveSlides() {
    return prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  // ── Admin: every slide, active or not ──────────────────────────────────────
  static async getAllSlides() {
    return prisma.heroSlide.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  // ── Generate signed Cloudinary upload URL ─────────────────────────────────
  // Identical pattern to GalleryService.generateSignedUploadUrl — the
  // frontend uploads straight to Cloudinary with this signature, so the
  // image bytes never pass through our server.
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
    const folder = HERO_FOLDER;
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
  // Re-verifies the uploaded asset against Cloudinary's own record before
  // trusting it — see verifyCloudinaryImage()'s comment in config/cloudinary
  // for why the signed params alone aren't enough.
  static async createSlide(data: {
    imageUrl: string;
    imagePublicId?: string;
    title: string;
    titleAccent?: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    await verifyCloudinaryImage(data.imageUrl, HERO_FOLDER);

    // New slides default to the end of the sequence unless a position was
    // explicitly given, so adding one never silently reorders the others.
    const sortOrder =
      data.sortOrder ??
      ((await prisma.heroSlide.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;

    return prisma.heroSlide.create({
      data: {
        imageUrl: data.imageUrl,
        imagePublicId: data.imagePublicId,
        title: data.title,
        titleAccent: data.titleAccent,
        description: data.description,
        ctaLabel: data.ctaLabel,
        ctaHref: data.ctaHref,
        sortOrder,
        isActive: data.isActive ?? true,
      },
    });
  }

  // ── Update a slide ──────────────────────────────────────────────────────────
  // "Replace image without losing text": imageUrl is optional here — when
  // it's provided (a genuinely new upload, not just re-saving the same
  // URL), the new asset is verified and the old one is cleaned up from
  // Cloudinary storage so replacing a background doesn't leak orphaned
  // assets. Text-only edits never touch Cloudinary at all.
  static async updateSlide(
    id: string,
    data: {
      imageUrl?: string;
      imagePublicId?: string;
      title?: string;
      titleAccent?: string;
      description?: string;
      ctaLabel?: string;
      ctaHref?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.heroSlide.findUnique({ where: { id } });
    if (!existing) throw new AppError("Hero slide not found", 404);

    const replacingImage = !!data.imageUrl && data.imageUrl !== existing.imageUrl;
    if (replacingImage) {
      await verifyCloudinaryImage(data.imageUrl!, HERO_FOLDER);
    }

    const updated = await prisma.heroSlide.update({
      where: { id },
      data: {
        ...(replacingImage && { imageUrl: data.imageUrl, imagePublicId: data.imagePublicId }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.titleAccent !== undefined && { titleAccent: data.titleAccent }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.ctaLabel !== undefined && { ctaLabel: data.ctaLabel }),
        ...(data.ctaHref !== undefined && { ctaHref: data.ctaHref }),
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
          console.error(`⚠️  Failed to delete replaced hero image ${oldPublicId}:`, err.message);
        }
      }
    }

    return updated;
  }

  // ── Reorder: swap sortOrder with the adjacent slide in that direction ─────
  static async reorderSlide(id: string, direction: "up" | "down") {
    const slides = await prisma.heroSlide.findMany({ orderBy: { sortOrder: "asc" } });
    const index = slides.findIndex((s) => s.id === id);
    if (index === -1) throw new AppError("Hero slide not found", 404);

    const swapWithIndex = direction === "up" ? index - 1 : index + 1;
    if (swapWithIndex < 0 || swapWithIndex >= slides.length) {
      // Already first/last — nothing to do, not an error (a UI that just
      // disables the boundary arrow could still race a click here).
      return slides;
    }

    const current = slides[index];
    const neighbor = slides[swapWithIndex];

    await prisma.$transaction([
      prisma.heroSlide.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }),
      prisma.heroSlide.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } }),
    ]);

    return prisma.heroSlide.findMany({ orderBy: { sortOrder: "asc" } });
  }

  // ── Delete a slide (Cloudinary asset + row) ────────────────────────────────
  static async deleteSlide(id: string) {
    const slide = await prisma.heroSlide.findUnique({ where: { id } });
    if (!slide) throw new AppError("Hero slide not found", 404);

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

    await prisma.heroSlide.delete({ where: { id } });
    return { success: true, message: "Hero slide deleted" };
  }
}

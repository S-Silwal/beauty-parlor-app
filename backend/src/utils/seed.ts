// src/utils/seed.ts
import { prisma } from "../config/database";
import bcrypt from "bcryptjs";
import { ServiceCategory } from "@prisma/client";

// Seeds the CURRENT homepage hero exactly as it looks today, as slide 1 —
// see HeroSlide in schema.prisma and app/page.tsx's HeroSlider usage. This
// is the fallback image already hardcoded in the homepage's CSS before the
// admin-managed hero existed; imagePublicId is null because it's an
// Unsplash URL, not a Cloudinary asset (deleteSlide/updateSlide already
// handle a null publicId gracefully, same as GalleryService does).
const sampleHeroSlides = [
  {
    imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1800&q=85",
    imagePublicId: null,
    title: "Where beauty",
    titleAccent: "meets ritual.",
    description:
      "Premium beauty treatments crafted with precision, care, and artistry — for every version of you.",
    ctaLabel: "Explore Services",
    ctaHref: "/services",
    sortOrder: 0,
    isActive: true,
  },
];

const sampleServices = [
  {
    name: "Eyebrow Shaping / Threading",
    category: ServiceCategory.EYEBROW_LASH,
    description: "Professional eyebrow shaping using traditional thread technique",
    duration: 20,
    price: 50,
    is_popular: true,
    isActive: true,
  },
  {
    name: "Eyebrow Lamination",
    category: ServiceCategory.EYEBROW_LASH,
    description: "Get fluffy, lifted and perfectly shaped eyebrows",
    duration: 45,
    price: 50,
    is_popular: true,
    isActive: true,
  },
  {
    name: "Eyelash Extension Classic",
    category: ServiceCategory.EYEBROW_LASH,
    description: "Natural looking eyelash extensions",
    duration: 60,
    price: 65,
    isActive: true,
  },
  {
    name: "Eyelash Lift & Tint",
    category: ServiceCategory.EYEBROW_LASH,
    description: "Lash lift with tint for curled and darker lashes",
    duration: 60,
    price: 80,
    isActive: true,
  },
  {
    name: "Full Face Waxing",
    category: ServiceCategory.WAXING,
    description: "Upper lip, chin, forehead and cheeks",
    duration: 25,
    price: 70,
    isActive: true,
  },
  {
    name: "Brazilian Wax (Full)",
    category: ServiceCategory.WAXING,
    description: "Complete bikini area waxing",
    duration: 30,
    price: 75,
    is_popular: true,
    isActive: true,
  },
  {
    name: "Full Body Wax Package",
    category: ServiceCategory.WAXING,
    description: "Arms, legs, underarms and bikini",
    duration: 120,
    price: 150,
    isActive: true,
  },
  {
    name: "Classic Facial",
    category: ServiceCategory.FACIAL_SKINCARE,
    description: "Deep cleansing, exfoliation and hydration",
    duration: 60,
    price: 120,
    isActive: true,
  },
  {
    name: "Glow / Hydrating Facial",
    category: ServiceCategory.FACIAL_SKINCARE,
    description: "Instant glow and brightening facial",
    duration: 75,
    price: 100,
    is_popular: true,
    isActive: true,
  },
  {
    name: "Anti-Ageing Facial",
    category: ServiceCategory.FACIAL_SKINCARE,
    description: "Wrinkle reduction and skin firming treatment",
    duration: 70,
    price: 140,
    isActive: true,
  },
];

const sampleStaff = [
  {
    name: "Priya Sharma",
    phone: "9876543210",
    email: "priya@lumina.com",
    specialization: "Eyebrow & Lash Expert",
    bio: "5+ years of experience in threading, lamination and lash extensions",
    isActive: true,
  },
  {
    name: "Neha Kapoor",
    phone: "9876543211",
    email: "neha@lumina.com",
    specialization: "Waxing Specialist",
    bio: "Expert in Brazilian and full body waxing",
    isActive: true,
  },
  {
    name: "Anjali Mehta",
    phone: "9876543212",
    email: "anjali@lumina.com",
    specialization: "Skincare Expert",
    bio: "Specialist in advanced facials and chemical peels",
    isActive: true,
  },
];

// ✅ UPDATED — category values now match frontend tab keys exactly
const sampleGallery = [
  {
    url: "https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800&q=80",
    alt_text: "Eyebrow Threading",
    category: "brows_lashes",   // ✅ matches Brows & Lashes tab
  },
  {
    url: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&q=80",
    alt_text: "Eyebrow Lamination",
    category: "brows_lashes",   // ✅ matches Brows & Lashes tab
  },
  {
    url: "https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=800&q=80",
    alt_text: "Eyelash Extensions",
    category: "brows_lashes",   // ✅ matches Brows & Lashes tab
  },
  {
    url: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80",
    alt_text: "Leg Waxing Treatment",
    category: "waxing",         // ✅ matches Waxing tab
  },
  {
    url: "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80",
    alt_text: "Brazilian Waxing",
    category: "waxing",         // ✅ matches Waxing tab
  },
  {
    url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800&q=80",
    alt_text: "Full Face Waxing",
    category: "waxing",         // ✅ matches Waxing tab
  },
  {
    url: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80",
    alt_text: "Classic Facial Treatment",
    category: "facials",        // ✅ matches Facials tab
  },
  {
    url: "https://images.unsplash.com/photo-1552693673-1bf958298935?w=800&q=80",
    alt_text: "Anti-Ageing Facial",
    category: "facials",        // ✅ matches Facials tab
  },
  {
    url: "https://images.unsplash.com/photo-1599407383981-35a45f27e1e9?w=800&q=80",
    alt_text: "Glow Hydrating Facial",
    category: "facials",        // ✅ matches Facials tab
  },
  {
    url: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=800&q=80",
    alt_text: "Eyebrow Before & After",
    category: "before_after",   // ✅ matches Before & After tab
  },
  {
    url: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80",
    alt_text: "Lash Lift Before & After",
    category: "before_after",   // ✅ matches Before & After tab
  },
];

async function seed() {
  // This script creates a known admin/customer login (overridable below, but
  // defaulting to admin123/customer123). Never let it run unattended
  // against a production database.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    console.error(
      "❌ Refusing to seed a production environment (NODE_ENV=production). " +
      "If you really mean to do this, re-run with ALLOW_PROD_SEED=true."
    );
    process.exit(1);
  }

  try {
    console.log("🌱 Starting database seeding...");

    // Seed Services
    for (const service of sampleServices) {
      await prisma.service.upsert({
        where: { name: service.name },
        update: {},
        create: {
          name: service.name,
          category: service.category,
          description: service.description,
          duration: service.duration,
          price: service.price,
          is_popular: service.is_popular ?? false,
          isActive: service.isActive,
        },
      });
    }
    console.log(`✅ ${sampleServices.length} services seeded`);

    // Seed Staff
    await prisma.staff.createMany({
      data: sampleStaff,
      skipDuplicates: true,
    });
    console.log(`✅ ${sampleStaff.length} staff members seeded`);

    // ✅ Clear old gallery images first to avoid stale category values
    await prisma.galleryImage.deleteMany({});
    console.log("🗑️  Old gallery images cleared");

    // Seed Gallery Images
    await prisma.galleryImage.createMany({
      data: sampleGallery,
      skipDuplicates: true,
    });
    console.log(`✅ ${sampleGallery.length} gallery images seeded`);

    // Seed the homepage hero slide — only on a genuinely empty table, so
    // re-running seed in dev never duplicates it or wipes out real edits an
    // admin has since made from /admin's Hero tab (unlike gallery images
    // above, these rows have no natural unique key to de-duplicate on).
    const heroSlideCount = await prisma.heroSlide.count();
    if (heroSlideCount === 0) {
      await prisma.heroSlide.createMany({ data: sampleHeroSlides });
      console.log(`✅ ${sampleHeroSlides.length} hero slide(s) seeded`);
    } else {
      console.log(`ℹ️  Hero slides already exist (${heroSlideCount}) — skipping seed`);
    }

    // Seed Admin User — override via env vars so the credential isn't a
    // permanently-known constant baked into the repo.
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@lumina.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.warn("⚠️  Using default dev admin password — set SEED_ADMIN_PASSWORD to override.");
    }
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: "Lumina Admin",
        email: adminEmail,
        phone: "9876543219",
        password_hash: hashedPassword,
        role: "ADMIN",
        is_verified: true,
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);

    // Seed Test Customer
    const customerEmail = process.env.SEED_CUSTOMER_EMAIL || "customer@lumina.com";
    const customerPassword = process.env.SEED_CUSTOMER_PASSWORD || "customer123";
    const customerHashed = await bcrypt.hash(customerPassword, 10);

    await prisma.user.upsert({
      where: { email: customerEmail },
      update: {},
      create: {
        name: "Riya Patel",
        email: customerEmail,
        phone: "9876543220",
        password_hash: customerHashed,
        role: "CUSTOMER",
        is_verified: true,
      },
    });
    console.log(`✅ Test customer created: ${customerEmail}`);

    console.log("🎉 Database seeding completed successfully! ✨");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();

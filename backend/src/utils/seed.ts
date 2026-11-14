// src/utils/seed.ts
import { prisma } from "../config/database";
import bcrypt from "bcryptjs";
import { ServiceCategory } from "@prisma/client";

// ── Site content: a snapshot of what's live on production ──────────────────
// Captured Nov 12, 2026 from the live API, so re-seeding an empty database
// restores the real site (services, staff, hero/login slides, gallery)
// instead of placeholder samples. Images live in Cloudinary, not Postgres,
// so only their URLs are stored here. When you change content in /admin and
// want it to survive a rebuild, update this snapshot too.
//
// Deliberately NOT included: staff phone numbers and emails (personal data
// doesn't belong in a public repo — re-enter them in /admin), and anything
// customers create (accounts, bookings, reviews): that needs real backups.
const sampleHeroSlides = [
  {
    "imageUrl": "https://res.cloudinary.com/dmvvvkflq/image/upload/v1789750562/beauty-parlor/hero/rdquwh2mjj2rheomuoft.jpg",
    "imagePublicId": "beauty-parlor/hero/rdquwh2mjj2rheomuoft",
    "title": "Where beauty",
    "titleAccent": "meets ritual.",
    "description": "Premium beauty treatments crafted with precision, care, and artistry — for every version of you.",
    "ctaLabel": "Explore Services",
    "ctaHref": "/services",
    "sortOrder": 0,
    "isActive": true
  },
  {
    "imageUrl": "https://res.cloudinary.com/dmvvvkflq/image/upload/v1789750905/beauty-parlor/hero/ka59a5ckzhzmgrieywq3.jpg",
    "imagePublicId": "beauty-parlor/hero/ka59a5ckzhzmgrieywq3",
    "title": "Before & After: The Classic Facial",
    "titleAccent": "",
    "description": "The quiet transformation of a classic facial.",
    "ctaLabel": "Explore Services",
    "ctaHref": "/services",
    "sortOrder": 1,
    "isActive": true
  }
];

const sampleLoginSlides = [
  {
    "imageUrl": "https://res.cloudinary.com/dmvvvkflq/image/upload/v1789971894/beauty-parlor/login-slides/glejlaz1ioky6aet0dam.jpg",
    "imagePublicId": "beauty-parlor/login-slides/glejlaz1ioky6aet0dam",
    "label": "Eyebrow Lamination",
    "headline": ".",
    "description": ".",
    "sortOrder": 0,
    "isActive": true
  }
];

const sampleServices = [
  { name: "Eyebrow Shaping / Threading", category: ServiceCategory.EYEBROW_LASH, description: "Professional eyebrow shaping using traditional thread technique", duration: 20, price: 50, image: "https://res.cloudinary.com/dmvvvkflq/image/upload/v1789787660/beauty-parlor/services/uk3jesdrn7ay252iiihj.jpg", is_popular: true, isActive: true },
  { name: "Eyebrow Lamination", category: ServiceCategory.EYEBROW_LASH, description: "Get fluffy, lifted and perfectly shaped eyebrows", duration: 45, price: 50, image: "https://res.cloudinary.com/dmvvvkflq/image/upload/v1789787447/beauty-parlor/services/fskkbka6htk0iqz1znnd.jpg", is_popular: true, isActive: true },
  { name: "Eyelash Extension Classic", category: ServiceCategory.EYEBROW_LASH, description: "Natural looking eyelash extensions", duration: 60, price: 65, image: "https://res.cloudinary.com/dmvvvkflq/image/upload/v1789786988/beauty-parlor/services/bje6fkggljzer7iflnoi.jpg", is_popular: true, isActive: true },
  { name: "Eyelash Lift & Tint", category: ServiceCategory.EYEBROW_LASH, description: "Lash lift with tint for curled and darker lashes", duration: 60, price: 80, image: null, is_popular: false, isActive: true },
  { name: "Full Body Wax Package", category: ServiceCategory.WAXING, description: "Arms, legs, underarms and bikini", duration: 120, price: 150, image: "https://res.cloudinary.com/dmvvvkflq/image/upload/v1789787026/beauty-parlor/services/ompd4t8omtm8nihhrjuy.jpg", is_popular: false, isActive: true },
  { name: "Full Face Waxing", category: ServiceCategory.WAXING, description: "Upper lip, chin, forehead and cheeks", duration: 25, price: 70, image: null, is_popular: false, isActive: true },
  { name: "Classic Facial", category: ServiceCategory.FACIAL_SKINCARE, description: "Deep cleansing, exfoliation and hydration", duration: 60, price: 120, image: null, is_popular: false, isActive: true },
  { name: "Anti-Ageing Facial", category: ServiceCategory.FACIAL_SKINCARE, description: "Wrinkle reduction and skin firming treatment", duration: 70, price: 140, image: null, is_popular: false, isActive: true },
  { name: "Glow / Hydrating Facial", category: ServiceCategory.FACIAL_SKINCARE, description: "Instant glow and brightening facial", duration: 75, price: 100, image: null, is_popular: true, isActive: true },
];

const sampleStaff = [
  { name: "Anita Silwal", specialization: "Eyebrow", bio: "", isActive: true },
  { name: "Don Farmer", specialization: "Waxing Specialist", bio: "Expert in Brazilian and full body waxing", isActive: true },
  { name: "Jana Cook", specialization: "Skincare Expert", bio: "Specialist in advanced facials and chemical peels", isActive: true },
];

const sampleGallery = [
  { url: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&q=80", alt_text: "Eyebrow Lamination", category: "brows_lashes", is_active: true },
  { url: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80", alt_text: "Leg Waxing Treatment", category: "waxing", is_active: true },
  { url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800&q=80", alt_text: "Full Face Waxing", category: "waxing", is_active: true },
  { url: "https://images.unsplash.com/photo-1552693673-1bf958298935?w=800&q=80", alt_text: "Anti-Ageing Facial", category: "facials", is_active: true },
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

  // Never create the publicly-known default logins in production.
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_CUSTOMER_PASSWORD)
  ) {
    console.error(
      "❌ SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD must be set when seeding production."
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
          image: service.image,
          is_popular: service.is_popular ?? false,
          isActive: service.isActive,
        },
      });
    }
    console.log(`✅ ${sampleServices.length} services seeded`);

    // Seed Staff
    // Staff has no unique column, so createMany(skipDuplicates) re-added
    // everyone on every run. Match by name instead: create only who's missing.
    let staffAdded = 0;
    for (const member of sampleStaff) {
      const exists = await prisma.staff.findFirst({ where: { name: member.name } });
      if (!exists) { await prisma.staff.create({ data: member }); staffAdded++; }
    }
    console.log(`✅ Staff: ${staffAdded} added, ${sampleStaff.length - staffAdded} already present`);

    // Gallery: add only images that aren't there yet. (This used to
    // deleteMany() first, which wiped every photo uploaded through /admin.)
    let galleryAdded = 0;
    for (const image of sampleGallery) {
      const exists = await prisma.galleryImage.findFirst({ where: { url: image.url } });
      if (!exists) { await prisma.galleryImage.create({ data: { ...image, uploaded_by: "SEED" } }); galleryAdded++; }
    }
    console.log(`✅ Gallery: ${galleryAdded} added, ${sampleGallery.length - galleryAdded} already present`);

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

    // Login-page slides: same rule as hero slides — only on an empty table.
    const loginSlideCount = await prisma.loginSlide.count();
    if (loginSlideCount === 0) {
      await prisma.loginSlide.createMany({ data: sampleLoginSlides });
      console.log(`✅ ${sampleLoginSlides.length} login slide(s) seeded`);
    } else {
      console.log(`ℹ️  Login slides already exist (${loginSlideCount}) — skipping seed`);
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

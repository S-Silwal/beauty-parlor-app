// src/utils/restoreGalleryFromCloudinary.ts
//
// One-time recovery tool: `prisma migrate reset` (or `npm run db:reset`)
// wiped the `GalleryImage` rows in Postgres, but it never touched the
// actual files sitting in Cloudinary — those are server-side storage,
// completely separate from the database. This script re-reads whatever
// images still exist in the `beauty-parlor/gallery` Cloudinary folder and
// recreates a GalleryImage row for any of them that isn't already in the
// database (matched by URL, so running this twice is harmless — it will
// never create a duplicate).
//
// Run it once from the backend directory:
//   npx ts-node src/utils/restoreGalleryFromCloudinary.ts
//
// After it runs, open the admin gallery page — the restored images will
// all show up with alt_text derived from their Cloudinary filename and
// category "general". Edit alt_text/category for each one afterward if
// you want them tidied up; this script only aims to get the images back,
// not to guess the exact metadata they used to have (that was lost along
// with the row).

import { prisma } from "../config/database";
import { cloudinary } from "../config/cloudinary";

const GALLERY_FOLDER = "beauty-parlor/gallery";

async function restore() {
  console.log(`🔍 Looking in Cloudinary for images under "${GALLERY_FOLDER}/"...`);

  let resources: { secure_url: string; public_id: string }[] = [];
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix: `${GALLERY_FOLDER}/`,
      max_results: 500,
    });
    resources = result.resources;
  } catch (err: any) {
    console.error("❌ Could not reach Cloudinary — check CLOUDINARY_* vars in .env:", err.message);
    process.exit(1);
  }

  console.log(`   Found ${resources.length} image(s) in that folder.`);

  const existing = await prisma.galleryImage.findMany({ select: { url: true } });
  const existingUrls = new Set(existing.map((i) => i.url));

  let restored = 0;
  let skipped = 0;

  for (const resource of resources) {
    const url = resource.secure_url;
    if (existingUrls.has(url)) {
      skipped++;
      continue; // already has a DB row — don't create a duplicate
    }

    const filename = resource.public_id.split("/").pop() || "Gallery image";

    await prisma.galleryImage.create({
      data: {
        url,
        alt_text: filename,
        category: "general", // edit in the admin panel once restored
        is_active: true,
        uploaded_by: "ADMIN",
      },
    });

    console.log(`  ➕ restored: ${url}`);
    restored++;
  }

  console.log(`\n✅ Done — ${restored} image(s) restored, ${skipped} already had a record.`);
  await prisma.$disconnect();
}

restore().catch(async (err) => {
  console.error("❌ Restore failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});

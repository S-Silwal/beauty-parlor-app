-- Admin-managed homepage hero slides. See schema.prisma's HeroSlide model
-- comment and HeroSlideService for how these are read/written.
CREATE TABLE "hero_slides" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "title" TEXT NOT NULL,
    "titleAccent" TEXT,
    "description" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL,
    "ctaHref" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hero_slides_isActive_sortOrder_idx" ON "hero_slides"("isActive", "sortOrder");

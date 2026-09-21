-- Admin-managed login-page slideshow slides. See schema.prisma's
-- LoginSlide model comment and LoginSlideService for how these are
-- read/written. No CTA fields (unlike hero_slides) — this is a purely
-- decorative backdrop behind the Sign In form.
CREATE TABLE "login_slides" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "label" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_slides_isActive_sortOrder_idx" ON "login_slides"("isActive", "sortOrder");

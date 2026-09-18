-- Adds avatarPublicId to staff, mirroring hero_slides.imagePublicId: lets us
-- delete/replace the Cloudinary asset when an admin uploads a new staff
-- photo, instead of leaking orphaned assets. See StaffService for the
-- verify/replace/delete flow and cloudinary.ts's verifyCloudinaryImage.
ALTER TABLE "staff" ADD COLUMN "avatarPublicId" TEXT;

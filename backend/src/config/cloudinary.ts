// src/config/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';//renamed as cloudinary instead of writing v2.uploader.upload(...)to avoid naming conflict with the package
import { AppError } from '../utils/AppError';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Upload policy (shared by every "sign a direct-to-Cloudinary upload" path) ─
// Cloudinary's signed-upload API only binds the params you actually put into
// the signature — anything else (resource_type, format, file size) the
// client is free to change before it POSTs, since the signature doesn't
// cover it. Signing `allowed_formats` closes the format hole at Cloudinary's
// end; MAX_UPLOAD_BYTES is enforced by us afterward (see verifyCloudinaryImage
// below), since there's no signable per-request size cap in Cloudinary's API.
export const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — matches the frontend's own client-side size check

/**
 * Best-effort extraction of a Cloudinary public_id from a stored secure_url.
 * We don't persist public_id separately, so this is derived from the URL's
 * well-known shape: .../upload/[v<version>/]<public_id>.<ext> — this app
 * never requests transformation segments, so that's always the public_id.
 * Returns null for anything that doesn't look like a Cloudinary upload URL
 * (e.g. the Unsplash URLs used by seed data).
 */
export function extractCloudinaryPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  return match ? match[1] : null;
}

/**
 * Closes the gap where saveImage()/ServiceService.update() used to persist
 * whatever `url` string was POSTed with no check it was actually an asset
 * this Cloudinary account owns, let alone one that respects our size/type
 * policy. The signed-upload params (folder, allowed_formats, timestamp)
 * only constrain what Cloudinary *accepts* — a client can still swap
 * resource_type by posting to a different endpoint with the same signature,
 * or a large file could slip through since there's no signable size cap. So
 * every image URL a client hands back is re-verified here, server-side,
 * against Cloudinary's own record of it before we trust it:
 *   1. it parses as a real Cloudinary public_id at all
 *   2. it actually exists in this Cloudinary account (Admin API lookup)
 *   3. it lives in the expected folder (not some other asset's URL)
 *   4. it's genuinely an image, in an allowed format, under the size cap
 * Anything that fails is rejected — and if it was successfully looked up
 * but violates policy (wrong folder/format/size), it's also deleted from
 * Cloudinary storage so a rejected upload doesn't linger as orphaned data.
 */
export async function verifyCloudinaryImage(url: string, expectedFolder: string) {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) {
    throw new AppError('Image URL is not a recognized Cloudinary asset URL.', 400);
  }

  let resource;
  try {
    resource = await cloudinary.api.resource(publicId, { resource_type: 'image' });
  } catch {
    throw new AppError('Could not verify this image against Cloudinary — it may not exist.', 400);
  }

  const violations: string[] = [];
  if (!publicId.startsWith(`${expectedFolder}/`)) {
    violations.push(`not in the expected folder (${expectedFolder})`);
  }
  if (resource.resource_type !== 'image') {
    violations.push(`resource_type is "${resource.resource_type}", not "image"`);
  }
  if (!ALLOWED_IMAGE_FORMATS.includes((resource.format || '').toLowerCase())) {
    violations.push(`format "${resource.format}" is not one of ${ALLOWED_IMAGE_FORMATS.join(', ')}`);
  }
  if (resource.bytes > MAX_UPLOAD_BYTES) {
    violations.push(`${resource.bytes} bytes exceeds the ${MAX_UPLOAD_BYTES} byte limit`);
  }

  if (violations.length > 0) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err: any) {
      console.error(`⚠️  Failed to clean up rejected Cloudinary asset ${publicId}:`, err.message);
    }
    throw new AppError(`Rejected upload: ${violations.join('; ')}.`, 400);
  }

  return { publicId, resource };
}

export { cloudinary };
export default cloudinary;

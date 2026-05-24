// src/config/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';//renamed as cloudinary instead of writing v2.uploader.upload(...)to avoid naming conflict with the package

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };
export default cloudinary;
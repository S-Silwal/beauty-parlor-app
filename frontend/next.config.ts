// next.config.ts
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  // ✅ Allow access from other devices on your network
  allowedDevOrigins: [
    '10.0.0.193',     // Your current IP
    'localhost',
    '127.0.0.1',
  ],

  // ✅ Allow external images (Gallery)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '**.picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '**',           // Allow all external images (good for development)
      },
    ],
  },
};

export default nextConfig;
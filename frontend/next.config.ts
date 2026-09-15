// next.config.ts
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained .next/standalone build (server.js +
  // only the node_modules actually used) — the production Dockerfile copies
  // just that output instead of the full node_modules tree.
  output: 'standalone',

  turbopack: {
    root: path.resolve(__dirname),
  },

  // Hides the dev-mode route indicator (the small "N" badge pinned to a
  // screen corner) — it's a Next.js dev-only overlay, never present in a
  // production build, but distracting while reviewing the UI locally.
  devIndicators: false,

  // ✅ Allow access from other devices on your network
  allowedDevOrigins: [
    '10.0.0.193',     // Your current IP
    'localhost',
    '127.0.0.1',
  ],

  // Only the hosts the gallery actually serves images from — Cloudinary for
  // real uploads, Unsplash for seed data. A wildcard here would let Next's
  // image optimizer fetch (server-side) any URL an admin/attacker supplies.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
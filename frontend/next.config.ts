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

  // Don't advertise the framework in every response (x-powered-by: Next.js).
  poweredByHeader: false,

  // Security headers on every page. The backend gets these from helmet(),
  // but Next.js serves the HTML users actually load, and Railway's edge
  // adds none of its own. The CSP is intentionally minimal (anti-framing,
  // no plugins, no <base> hijack); a full script-src policy for Next needs
  // per-request nonces and is a separate task.
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      // Deny powerful browser features this site never uses (flagged missing by securityheaders.com)
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    ],
  }];
},

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
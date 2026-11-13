// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SiteChrome from "../components/SiteChrome";
import { AuthProvider } from "@/context/AuthContext";

// Sitewide type system — three roles, self-hosted through next/font instead
// of the per-page <style>@import this replaced (Cormorant Garamond + Jost),
// so there's one font load instead of one per page and no render-blocking
// Google Fonts request.
//   --font-display : editorial serif for heroes, section titles, card names
//   --font-body    : warm humanist sans for prose (About story, hero sub, descriptions)
//   --font-ui      : neo-grotesk for chrome — buttons, labels, prices, durations, stats
// Self-hosted (next/font/local) rather than next/font/google: the Google
// loader downloads the fonts during every `next build`, and when that
// request was slow or blocked the whole CI build failed (runs #97 and
// #109). The files in ./fonts are the same Latin subsets from Fontsource,
// licensed under the SIL OFL (see ./fonts/OFL-*.txt). Next still preloads
// them, adds size-adjusted fallbacks, and serves them from our own domain.
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/fraunces-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/fraunces-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/fraunces-latin-500-italic.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});
const karla = localFont({
  src: [
    { path: "./fonts/karla-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/karla-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});
const archivo = localFont({
  src: [
    { path: "./fonts/archivo-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/archivo-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/archivo-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crown & Glow | Premium Beauty Salon Indianapolis",
  description: "Book your premium beauty services with Crown & Glow in Indianapolis, Indiana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pins the site to the light salon palette regardless of the visitor's
            OS/browser dark-mode setting — without this, browsers that auto-dark
            unstyled form controls and inherited text can wash gold/cream copy
            out to near-invisible on a light background (e.g. the login page). */}
        <meta name="color-scheme" content="light" />
      </head>
      <body
        className={`${fraunces.variable} ${karla.variable} ${archivo.variable} ${karla.className}`}
        style={{ margin: 0, background: "#faf6f1" }}
      >
        <AuthProvider>
          <SiteChrome>{children}</SiteChrome>
        </AuthProvider>
      </body>
    </html>
  );
}

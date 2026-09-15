// app/layout.tsx
import type { Metadata } from "next";
import { Didact_Gothic } from "next/font/google";
import "./globals.css";
import SiteChrome from "../components/SiteChrome";
import { AuthProvider } from "@/context/AuthContext";

// Individual pages each pull in their own display faces (Cormorant Garamond,
// Jost, etc.) via their own inline <style>@import — this is only the body's
// sitewide fallback face, self-hosted through next/font instead of a <link>
// so it doesn't trigger a render-blocking request or the single-page-font
// lint warning.
const didactGothic = Didact_Gothic({ subsets: ["latin"], weight: "400" });

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
      <body className={didactGothic.className} style={{ margin: 0, background: "#faf6f1" }}>
        <AuthProvider>
          <SiteChrome>{children}</SiteChrome>
        </AuthProvider>
      </body>
    </html>
  );
}

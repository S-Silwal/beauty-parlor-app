// app/layout.tsx
import type { Metadata } from "next";
import { Fraunces, Karla, Archivo } from "next/font/google";
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
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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

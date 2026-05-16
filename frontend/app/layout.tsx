// app/layout.tsx
import type { NextConfig } from 'next';
import type { Metadata } from "next";
import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/footer";
import { AuthProvider } from "@/context/AuthContext";

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
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Didact+Gothic&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: "#faf6f1", fontFamily: "'Didact Gothic', sans-serif" }}>
        <AuthProvider>
          <Navbar />
          <main className="min-h-[calc(100vh-140px)]">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
// components/SiteChrome.tsx
'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './footer';

/**
 * Wraps every page with the public Navbar + Footer — except admin routes,
 * which render their own self-contained header (see app/admin/page.tsx).
 * Without this, the root layout's Navbar/Footer would render around the
 * admin page's own header/footer too, producing two stacked navbars, two
 * logout buttons, and the user's name shown twice.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-140px)]">{children}</main>
      <Footer />
    </>
  );
}

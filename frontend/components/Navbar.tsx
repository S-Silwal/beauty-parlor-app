// src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@300;400;500;600&display=swap');

        .nb {
          --cream:    #FDFAF6;
          --cream-bd: #EDE6DC;
          --gold:     #B89A6A;
          --gold-lt:  #D4B896;
          --charcoal: #2C2825;
          --mid:      #6B635A;
          --soft:     #9E968E;
          position: sticky; top: 0; z-index: 50;
          background: var(--cream);
          border-bottom: 1px solid var(--cream-bd);
          box-shadow: 0 2px 24px rgba(44,40,37,0.06);
          font-family: 'Jost', sans-serif;
        }

        .nb-inner {
          max-width: 1280px; margin: 0 auto;
          padding: 0 32px; height: 72px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px;
        }

        .nb-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px; font-weight: 500;
          color: var(--charcoal); letter-spacing: .01em;
          text-decoration: none; flex-shrink: 0;
          transition: color .2s;
        }
        .nb-logo em { font-style: italic; color: var(--gold); }
        .nb-logo:hover { color: var(--gold); }

        .nb-links {
          display: flex; align-items: center;
          gap: 2px; list-style: none; margin: 0; padding: 0;
        }
        .nb-link {
          font-size: 13px; font-weight: 500;
          letter-spacing: .06em; text-transform: uppercase;
          color: var(--mid); text-decoration: none;
          padding: 8px 14px; border-radius: 2px;
          transition: color .2s, background .2s;
          white-space: nowrap;
        }
        .nb-link:hover { color: var(--charcoal); background: var(--cream-bd); }

        .nb-auth { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

        .nb-greeting {
          font-size: 13px; font-weight: 400; color: var(--soft);
          white-space: nowrap;
        }
        .nb-greeting strong { color: var(--charcoal); font-weight: 600; }
        .nb-admin-tag {
          font-size: 10px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: var(--gold); margin-left: 4px;
        }

        .nb-btn-ghost {
          font-family: 'Jost', sans-serif;
          font-size: 12px; font-weight: 600;
          letter-spacing: .1em; text-transform: uppercase;
          color: var(--mid); text-decoration: none;
          padding: 9px 18px;
          border: 1px solid var(--cream-bd);
          border-radius: 2px; background: transparent; cursor: pointer;
          transition: color .2s, border-color .2s, background .2s;
          white-space: nowrap;
        }
        .nb-btn-ghost:hover {
          color: var(--charcoal); border-color: var(--gold);
          background: rgba(184,154,106,0.06);
        }

        .nb-btn-solid {
          font-family: 'Jost', sans-serif;
          font-size: 12px; font-weight: 700;
          letter-spacing: .1em; text-transform: uppercase;
          color: var(--cream); text-decoration: none;
          padding: 9px 22px;
          background: var(--charcoal); border: 1px solid var(--charcoal);
          border-radius: 2px; cursor: pointer;
          transition: background .22s, border-color .22s, transform .2s;
          white-space: nowrap;
        }
        .nb-btn-solid:hover {
          background: var(--gold); border-color: var(--gold);
          transform: translateY(-1px);
        }

        .nb-btn-admin {
          font-family: 'Jost', sans-serif;
          font-size: 12px; font-weight: 700;
          letter-spacing: .1em; text-transform: uppercase;
          color: var(--charcoal); text-decoration: none;
          padding: 9px 22px;
          background: var(--gold); border: 1px solid var(--gold);
          border-radius: 2px; cursor: pointer;
          transition: background .22s, transform .2s; white-space: nowrap;
        }
        .nb-btn-admin:hover { background: var(--gold-lt); transform: translateY(-1px); }

        .nb-sep { width: 1px; height: 20px; background: var(--cream-bd); flex-shrink: 0; }

        @media (max-width: 900px) {
          .nb-links { display: none; }
          .nb-inner { padding: 0 20px; }
        }
        @media (max-width: 480px) {
          .nb-logo { font-size: 22px; }
          .nb-btn-ghost, .nb-btn-solid { padding: 8px 14px; font-size: 11px; }
        }
      `}</style>

      <nav className="nb">
        <div className="nb-inner">

          {/* Logo */}
          <Link href="/" className="nb-logo">
            Crown <em>&amp; Glow</em>
          </Link>

          {/* Nav links */}
          <ul className="nb-links">
            <li><Link href="/"         className="nb-link">Home</Link></li>
            <li><Link href="/services"  className="nb-link">Services</Link></li>
            {/* ✅ Hide "Book Appointment" from admin — they manage, not book */}
            {!isAdmin && (
              <li><Link href="/booking" className="nb-link">Book Appointment</Link></li>
            )}
            <li><Link href="/gallery"  className="nb-link">Gallery</Link></li>
            <li><Link href="/about"    className="nb-link">About Us</Link></li>
            <li><Link href="/contact"  className="nb-link">Contact</Link></li>
          </ul>

          {/* Auth */}
          <div className="nb-auth">
            {user ? (
              <>
                {/* Greeting */}
                <span className="nb-greeting">
                  Hi, <strong>{user.name.split(' ')[0]}</strong>
                  {isAdmin && <span className="nb-admin-tag">Admin</span>}
                </span>

                <div className="nb-sep" />

                {/* ✅ Customers only — Dashboard button */}
                {!isAdmin && (
                  <Link href="/dashboard" className="nb-btn-ghost">
                    Dashboard
                  </Link>
                )}

                {/* Logout — everyone */}
                <button onClick={handleLogout} className="nb-btn-ghost">
                  Logout
                </button>

                {/* ✅ Admins only — Admin Panel button */}
                {isAdmin && (
                  <Link href="/admin" className="nb-btn-admin">
                    Admin Panel
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/login"    className="nb-btn-ghost">Login</Link>
                <Link href="/register" className="nb-btn-solid">Register</Link>
              </>
            )}
          </div>

        </div>
      </nav>
    </>
  );
}

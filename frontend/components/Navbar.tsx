// src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login'; // marks Login as the current page below
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
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
          /* Plain brand mark, not a link — "Home" already covers that in
             .nb-links, so the logo no longer shows a pointer/hand cursor
             hinting at a separate destination it doesn't actually go to. */
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px; font-weight: 500;
          color: var(--charcoal); letter-spacing: .01em;
          flex-shrink: 0; cursor: default; user-select: none;
        }
        .nb-logo em { font-style: italic; color: var(--gold); }

        .nb-links {
          /* gap (8px) + link padding (8px each side) ≈ 32px of breathing
             room between adjacent link labels, per design spec */
          display: flex; align-items: center;
          gap: 8px; list-style: none; margin: 0; padding: 0;
        }
        .nb-link {
          position: relative;
          font-size: 13px; font-weight: 500;
          letter-spacing: .06em; text-transform: uppercase;
          color: var(--mid); text-decoration: none;
          padding: 8px 14px;
          transition: color .2s;
          white-space: nowrap;
        }
        /* Gold underline on hover/focus instead of a background color jump */
        .nb-link::after {
          content: ''; position: absolute; left: 14px; right: 14px; bottom: 4px;
          height: 1px; background: var(--gold);
          transform: scaleX(0); transform-origin: left;
          transition: transform .25s ease;
        }
        .nb-link:hover, .nb-link:focus-visible { color: var(--charcoal); }
        .nb-link:hover::after, .nb-link:focus-visible::after { transform: scaleX(1); }
        .nb-link:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

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
        /* Marks Login as the current page when already on /login */
        .nb-btn-ghost.nb-current {
          color: var(--charcoal); border-color: var(--gold);
          background: rgba(184,154,106,0.08);
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

        /* Hamburger toggle — hidden on desktop */
        .nb-burger {
          display: none;
          width: 40px; height: 40px;
          padding: 0; border: none; background: transparent;
          cursor: pointer; flex-shrink: 0;
          align-items: center; justify-content: center;
          flex-direction: column; gap: 5px;
        }
        .nb-burger span {
          display: block; width: 22px; height: 2px; background: var(--charcoal);
          transition: transform .25s ease, opacity .2s ease;
        }
        .nb-burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .nb-burger.open span:nth-child(2) { opacity: 0; }
        .nb-burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        .nb-mobile-panel { display: none; }

        @media (max-width: 900px) {
          .nb-links { display: none; }
          .nb-auth { display: none; }
          .nb-inner { padding: 0 20px; }
          .nb-burger { display: flex; }

          .nb-mobile-panel {
            display: block;
            max-height: 0; overflow: hidden;
            background: var(--cream); border-top: 1px solid transparent;
            transition: max-height .3s ease, border-color .3s ease;
          }
          .nb-mobile-panel.open {
            max-height: 640px;
            border-top: 1px solid var(--cream-bd);
          }
          .nb-mobile-links {
            list-style: none; margin: 0; padding: 12px 20px 8px;
            display: flex; flex-direction: column; gap: 2px;
          }
          .nb-mobile-links .nb-link {
            display: block; padding: 12px 4px; width: 100%; box-sizing: border-box;
          }
          .nb-mobile-links .nb-link::after { display: none; }

          .nb-mobile-auth {
            display: flex; flex-direction: column; gap: 10px;
            padding: 16px 20px 24px; border-top: 1px solid var(--cream-bd);
          }
          .nb-mobile-auth .nb-btn-ghost,
          .nb-mobile-auth .nb-btn-solid,
          .nb-mobile-auth .nb-btn-admin {
            width: 100%; text-align: center; box-sizing: border-box;
          }
          .nb-mobile-greeting {
            font-size: 14px; color: var(--mid); padding: 4px 4px 8px;
          }
        }

        @media (max-width: 480px) {
          .nb-logo { font-size: 22px; }
          .nb-inner { height: 64px; padding: 0 16px; }
          .nb-mobile-links, .nb-mobile-auth { padding-left: 16px; padding-right: 16px; }
        }
      `}</style>

      <nav className="nb">
        <div className="nb-inner">

          {/* Logo — brand mark only, not a link (see .nb-logo above) */}
          <span className="nb-logo">
            Crown <em>&amp; Glow</em>
          </span>

          {/* Nav links — desktop only, see .nb-mobile-links for the mobile equivalent */}
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

          {/* Auth — desktop only, see .nb-mobile-auth for the mobile equivalent */}
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
                <Link
                  href="/login"
                  className={`nb-btn-ghost${isLoginPage ? ' nb-current' : ''}`}
                  aria-current={isLoginPage ? 'page' : undefined}
                >
                  Login
                </Link>
                <Link href="/register" className="nb-btn-solid">Register</Link>
              </>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            type="button"
            className={`nb-burger${menuOpen ? ' open' : ''}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
        </div>

        {/* Mobile slide-down panel */}
        <div className={`nb-mobile-panel${menuOpen ? ' open' : ''}`}>
          <ul className="nb-mobile-links">
            <li><Link href="/" className="nb-link" onClick={closeMenu}>Home</Link></li>
            <li><Link href="/services" className="nb-link" onClick={closeMenu}>Services</Link></li>
            {!isAdmin && (
              <li><Link href="/booking" className="nb-link" onClick={closeMenu}>Book Appointment</Link></li>
            )}
            <li><Link href="/gallery" className="nb-link" onClick={closeMenu}>Gallery</Link></li>
            <li><Link href="/about" className="nb-link" onClick={closeMenu}>About Us</Link></li>
            <li><Link href="/contact" className="nb-link" onClick={closeMenu}>Contact</Link></li>
          </ul>

          <div className="nb-mobile-auth">
            {user ? (
              <>
                <span className="nb-mobile-greeting">
                  Hi, <strong>{user.name.split(' ')[0]}</strong>
                  {isAdmin && <span className="nb-admin-tag">Admin</span>}
                </span>

                {!isAdmin && (
                  <Link href="/dashboard" className="nb-btn-ghost" onClick={closeMenu}>
                    Dashboard
                  </Link>
                )}

                <button onClick={handleLogout} className="nb-btn-ghost">
                  Logout
                </button>

                {isAdmin && (
                  <Link href="/admin" className="nb-btn-admin" onClick={closeMenu}>
                    Admin Panel
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`nb-btn-ghost${isLoginPage ? ' nb-current' : ''}`}
                  aria-current={isLoginPage ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  Login
                </Link>
                <Link href="/register" className="nb-btn-solid" onClick={closeMenu}>Register</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

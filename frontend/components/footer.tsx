// src/components/footer.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// The shop is physically in Indianapolis — "open now" has to be evaluated
// against ITS local clock, not the visitor's (or the server's) timezone,
// or someone browsing from another timezone would see the wrong status.
const STORE_TIMEZONE = 'America/Indiana/Indianapolis';

// Mirrors the hours actually printed in the Opening Hours column below —
// if those ever change, update them here too. `display` feeds the
// "Today · Sat 9:00 AM – 7:00 PM" line above the status badge.
const HOURS: Record<string, { open: number; close: number; display: string }> = {
  Mon: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Tue: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Wed: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Thu: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Fri: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Sat: { open: 9 * 60,  close: 19 * 60, display: '9:00 AM – 7:00 PM' },
  Sun: { open: 10 * 60, close: 17 * 60, display: '10:00 AM – 5:00 PM' },
};

interface StoreStatus {
  weekday: string;   // "Mon" … "Sun", in STORE_TIMEZONE
  hoursLabel: string;
  isOpen: boolean;
}

function getStoreStatus(): StoreStatus {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const weekday = get('weekday');
  const today = HOURS[weekday];
  const minutesNow = Number(get('hour')) * 60 + Number(get('minute'));

  return {
    weekday,
    hoursLabel: today?.display ?? '',
    isOpen: !!today && minutesNow >= today.open && minutesNow < today.close,
  };
}

export default function Footer() {
  // Computed directly (not in an effect) so the very first render — server
  // or client — already shows the correct status instead of a placeholder.
  const [status, setStatus] = useState(getStoreStatus);

  // Re-check periodically so the badge flips from Open to Closed (or back)
  // on its own if someone leaves the page open across a boundary, with no
  // refresh needed.
  useEffect(() => {
    const id = setInterval(() => setStatus(getStoreStatus()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');

        .ft {
          --cream:    #FDFAF6;
          --cream-md: #EDE6DC;
          --cream-dk: #E0D6C8;
          --gold:     #B89A6A;
          --gold-lt:  #D4B896;
          --charcoal: #2C2825;
          --mid:      #6B635A;
          --soft:     #9E968E;
          background: var(--charcoal);
          color: var(--cream);
          font-family: 'Jost', sans-serif;
        }

        .ft-top {
          max-width: 1280px; margin: 0 auto;
          padding: 80px 40px 64px;
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr 1fr;
          gap: 60px;
        }

        /* Brand column */
        .ft-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px; font-weight: 500;
          color: var(--cream); letter-spacing: .01em;
          margin: 0 0 16px; text-decoration: none;
          display: inline-block;
          transition: color .2s;
        }
        .ft-logo em { font-style: italic; color: var(--gold-lt); }
        .ft-logo:hover { color: var(--gold-lt); }

        /* Social icons */
        .ft-social { display: flex; gap: 10px; }
        .ft-social-btn {
          width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid rgba(212,184,150,0.25);
          display: flex; align-items: center; justify-content: center;
          color: var(--soft); text-decoration: none;
          transition: border-color .2s, color .2s, background .2s;
        }
        .ft-social-btn:hover {
          border-color: var(--gold);
          color: var(--gold-lt);
          background: rgba(184,154,106,0.08);
        }

        /* Column heading */
        .ft-col-head {
          font-size: 10px; font-weight: 700;
          letter-spacing: .2em; text-transform: uppercase;
          color: var(--gold); margin: 0 0 22px;
        }

        /* Links */
        .ft-links { display: flex; flex-direction: column; gap: 12px; }
        .ft-link {
          font-size: 14px; font-weight: 300;
          color: var(--soft); text-decoration: none;
          transition: color .2s; line-height: 1;
          width: fit-content;
          position: relative;
        }
        .ft-link::after {
          content: '';
          position: absolute; bottom: -2px; left: 0;
          width: 0; height: 1px;
          background: var(--gold);
          transition: width .25s ease;
        }
        .ft-link:hover { color: var(--cream); }
        .ft-link:hover::after { width: 100%; }

        /* Contact info */
        .ft-contact { display: flex; flex-direction: column; gap: 14px; }
        .ft-contact-item {
          display: flex; gap: 10px; align-items: flex-start;
        }
        .ft-contact-icon {
          color: var(--gold); flex-shrink: 0; margin-top: 1px;
        }
        /* Contact info, as clickable links (tel: / mailto: / Maps) */
        .ft-contact-link {
          font-size: 13px; font-weight: 300;
          color: var(--soft); line-height: 1.65;
          text-decoration: none; transition: color .2s;
        }
        .ft-contact-link:hover { color: var(--gold-lt); text-decoration: underline; }
        .ft-contact-link strong {
          color: var(--cream); font-weight: 500;
        }

        /* Hours */
        .ft-hours { display: flex; flex-direction: column; gap: 12px; }
        .ft-hour-row {
          display: flex; flex-direction: column; gap: 2px;
        }
        .ft-hour-day {
          font-size: 11px; font-weight: 600;
          letter-spacing: .08em; text-transform: uppercase;
          color: var(--cream);
        }
        .ft-hour-time {
          font-size: 13px; font-weight: 300; color: var(--soft);
        }
        .ft-today {
          font-size: 12px; font-weight: 500;
          color: var(--soft); margin: 4px 0 0;
        }
        .ft-today strong {
          color: var(--cream); font-weight: 600;
        }
        .ft-status-badge {
          display: inline-block; margin-top: 8px;
          font-size: 11px; font-weight: 700;
          letter-spacing: .08em; text-transform: uppercase;
          padding: 5px 12px; border-radius: 999px;
        }
        .ft-status-badge.open   { color: #6EE7B7; background: rgba(16,185,129,0.16); }
        .ft-status-badge.closed { color: #FCA5A5; background: rgba(239,68,68,0.14); }

        /* Divider */
        .ft-divider {
          max-width: 1280px; margin: 0 auto;
          padding: 0 40px;
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(212,184,150,0.2) 20%, rgba(212,184,150,0.2) 80%, transparent);
        }

        /* Bottom bar */
        .ft-bottom {
          max-width: 1280px; margin: 0 auto;
          padding: 24px 40px;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px;
        }
        .ft-copy {
          font-size: 12px; font-weight: 300;
          color: var(--soft); letter-spacing: .04em;
        }
        .ft-copy em { color: var(--gold); font-style: normal; }
        .ft-bottom-links {
          display: flex; gap: 24px;
        }
        .ft-bottom-link {
          font-size: 11px; font-weight: 400;
          letter-spacing: .06em; text-transform: uppercase;
          color: var(--soft); text-decoration: none;
          transition: color .2s;
        }
        .ft-bottom-link:hover { color: var(--gold); }

        @media (max-width: 960px) {
          .ft-top { grid-template-columns: 1fr 1fr; gap: 40px; padding: 60px 28px 48px; }
        }
        @media (max-width: 580px) {
          .ft-top { grid-template-columns: 1fr; gap: 36px; padding: 48px 20px 40px; }
          .ft-bottom { padding: 20px; flex-direction: column; align-items: center; text-align: center; }
          .ft-divider { margin: 0 20px; }
        }
      `}</style>

      <footer className="ft">

        {/* ── Top grid ── */}
        <div className="ft-top">

          {/* Brand */}
          <div>
            <Link href="/" className="ft-logo">
              Crown <em>&amp; Glow</em>
            </Link>
            <div className="ft-social" style={{ marginTop: 16 }}>
              {/* Instagram */}
              <a href="#" className="ft-social-btn" aria-label="Instagram">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="2" width="20" height="20" rx="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
              </a>
              {/* Facebook */}
              <a href="#" className="ft-social-btn" aria-label="Facebook">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <p className="ft-col-head">Quick Links</p>
            <nav className="ft-links">
              <Link href="/"        className="ft-link">Home</Link>
              <Link href="/services" className="ft-link">Services</Link>
              <Link href="/booking"  className="ft-link">Book Appointment</Link>
              <Link href="/gallery"  className="ft-link">Gallery</Link>
              <Link href="/about"    className="ft-link">About Us</Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <p className="ft-col-head">Contact Us</p>
            <div className="ft-contact">
              {/* Dummy address for now — opens the address in Google Maps. */}
              <div className="ft-contact-item">
                <span className="ft-contact-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </span>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=123+Placeholder+Lane+Anytown+ST+00000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ft-contact-link"
                >
                  123 Placeholder Lane, Suite 100<br />
                  Anytown, ST 00000
                </a>
              </div>
              {/* Dummy phone number for now. */}
              <div className="ft-contact-item">
                <span className="ft-contact-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.4 2 2 0 0 1 3.59 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </span>
                <a href="tel:+15551234567" className="ft-contact-link">
                  <strong>(555) 123-4567</strong>
                </a>
              </div>
              {/* Dummy email for now. */}
              <div className="ft-contact-item">
                <span className="ft-contact-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <a href="mailto:hello@example.com" className="ft-contact-link">
                  <strong>hello@example.com</strong>
                </a>
              </div>
            </div>
          </div>

          {/* Hours */}
          <div>
            <p className="ft-col-head">Opening Hours</p>
            <div className="ft-hours">
              <div className="ft-hour-row">
                <span className="ft-hour-day">Monday – Friday</span>
                <span className="ft-hour-time">9:00 AM – 8:00 PM</span>
              </div>
              <div className="ft-hour-row">
                <span className="ft-hour-day">Saturday</span>
                <span className="ft-hour-time">9:00 AM – 7:00 PM</span>
              </div>
              <div className="ft-hour-row">
                <span className="ft-hour-day">Sunday</span>
                <span className="ft-hour-time">10:00 AM – 5:00 PM</span>
              </div>
              <div suppressHydrationWarning>
                <p className="ft-today">
                  Today · <strong>{status.weekday}</strong> {status.hoursLabel}
                </p>
                <span className={`ft-status-badge ${status.isOpen ? 'open' : 'closed'}`}>
                  {status.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="ft-divider" />

        {/* Bottom bar */}
        <div className="ft-bottom">
          <p className="ft-copy">
            © {new Date().getFullYear()} <em>Crown &amp; Glow</em> · Indianapolis, Indiana
          </p>
          <div className="ft-bottom-links">
            <a href="#" className="ft-bottom-link">Privacy Policy</a>
            <a href="#" className="ft-bottom-link">Terms of Service</a>
            <a href="#" className="ft-bottom-link">Accessibility</a>
          </div>
        </div>

      </footer>
    </>
  );
}

// src/components/footer.tsx
import Link from 'next/link';

export default function Footer() {
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

        .ft-tagline {
          font-size: 14px; font-weight: 300;
          color: var(--soft); line-height: 1.8;
          max-width: 220px; margin: 0 0 28px;
        }

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
        .ft-contact-text {
          font-size: 13px; font-weight: 300;
          color: var(--soft); line-height: 1.65;
        }
        .ft-contact-text strong {
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
            <p className="ft-tagline">
              Premium beauty rituals crafted with precision,
              care, and artistry — for every version of you.
            </p>
            <div className="ft-social">
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
              {/* Pinterest */}
              <a href="#" className="ft-social-btn" aria-label="Pinterest">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.236 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.806-2.428 1.808-2.428.853 0 1.267.641 1.267 1.408 0 .858-.546 2.141-.828 3.33-.236.995.498 1.806 1.476 1.806 1.771 0 3.133-1.867 3.133-4.562 0-2.386-1.716-4.054-4.165-4.054-2.837 0-4.5 2.127-4.5 4.326 0 .856.33 1.775.741 2.276a.3.3 0 0 1 .069.286c-.076.311-.244.995-.277 1.134-.044.183-.146.222-.337.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.967-.527-2.292-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                </svg>
              </a>
              {/* TikTok */}
              <a href="#" className="ft-social-btn" aria-label="TikTok">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z"/>
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
              <Link href="/contact"  className="ft-link">Contact</Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <p className="ft-col-head">Contact Us</p>
            <div className="ft-contact">
              <div className="ft-contact-item">
                <span className="ft-contact-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </span>
                <span className="ft-contact-text">
                  456 Glow Avenue, Suite 200<br />
                  Indianapolis, Indiana 46204
                </span>
              </div>
              <div className="ft-contact-item">
                <span className="ft-contact-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.4 2 2 0 0 1 3.59 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </span>
                <span className="ft-contact-text">
                  <strong>(317) 555-0187</strong>
                </span>
              </div>
              <div className="ft-contact-item">
                <span className="ft-contact-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <span className="ft-contact-text">
                  <strong>hello@crownandglow.com</strong>
                </span>
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
              <div style={{ marginTop: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#2C2825', background: '#B89A6A',
                  padding: '5px 12px', borderRadius: 2,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2C2825', display: 'inline-block' }} />
                  Now Open
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

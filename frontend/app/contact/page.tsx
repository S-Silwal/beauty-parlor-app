'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  SITE_ADDRESS_LINE1,
  SITE_ADDRESS_LINE2,
  SITE_MAPS_URL,
  SITE_PHONE_DISPLAY,
  SITE_PHONE_TEL,
  SITE_EMAIL,
  HOURS_SUMMARY,
} from '@/lib/site-info';
import { SALON_TZ } from '@/lib/timezone';

// Which HOURS_SUMMARY row covers today (in the studio's own timezone), so the
// hours list can highlight it. Read through useSyncExternalStore with a null
// server snapshot: the server (UTC) and the browser can disagree about
// "today", so the highlight is only added on the client, after hydration,
// with no hydration mismatch.
function todaysHoursLabel(): string {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: SALON_TZ, weekday: 'short' }).format(new Date());
  if (day === 'Sat') return 'Saturday';
  if (day === 'Sun') return 'Sunday';
  return 'Mon – Fri';
}

const noopSubscribe = () => () => {};

// Small line icons (inherit currentColor) — replaces the emoji, which render
// differently on every OS and clashed with the palette.
const Icon = {
  pin: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5 12 13l8.5-6.5" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState(false);
  const today = useSyncExternalStore(noopSubscribe, todaysHoursLabel, () => null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSuccess(true);
      setTimeout(() => {
        setFormData({ name: '', email: '', phone: '', message: '' });
        setSubmitted(false);
        setSuccess(false);
      }, 2200);
    }, 900);
  };

  const contactRows = [
    { key: 'address', icon: Icon.pin, label: 'Address', lines: [SITE_ADDRESS_LINE1, SITE_ADDRESS_LINE2], href: SITE_MAPS_URL, external: true },
    { key: 'phone', icon: Icon.phone, label: 'Call us', lines: [SITE_PHONE_DISPLAY], href: `tel:${SITE_PHONE_TEL}`, external: false },
    { key: 'email', icon: Icon.mail, label: 'Email', lines: [SITE_EMAIL], href: `mailto:${SITE_EMAIL}`, external: false },
  ];

  return (
    <div className="ct-page">
      <style>{`
        /* Same palette and type roles as the home page, so the site feels like one place */
        .ct-page {
          --cream:     #F7F3EE;
          --cream-md:  #EDE6DC;
          --card-bg:   #FDFAF6;
          --gold:      #B89A6A;
          --gold-text: #7D6232;  /* gold for text on cream — passes WCAG AA */
          --gold-lt:   #D4B896;
          --charcoal:  #2C2825;
          --mid:       #6B635A;
          --line:      #DCD2C4;
          --on-dark:   #F7F3EE;
          --on-dark-2: #BDB4AA;  /* secondary text on charcoal, ~7:1 */
          min-height: 100vh;
          background: var(--cream);
          font-family: var(--font-body), sans-serif;
          color: var(--charcoal);
          padding: 64px 20px 88px;
        }
        @media (max-width: 640px) { .ct-page { padding: 40px 16px 64px; } }

        .ct-wrap { max-width: 1080px; margin: 0 auto; }

        /* ---------- Header ---------- */
        .ct-header { text-align: center; max-width: 620px; margin: 0 auto 48px; }
        .ct-eyebrow {
          font-family: var(--font-ui), sans-serif;
          font-size: 12px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase;
          color: var(--gold-text); margin: 0 0 14px;
          display: inline-flex; align-items: center; gap: 12px;
        }
        .ct-eyebrow::before, .ct-eyebrow::after { content: ''; width: 28px; height: 1px; background: var(--gold); }
        .ct-title {
          font-family: var(--font-display), Georgia, serif;
          font-size: clamp(36px, 5.5vw, 56px); font-weight: 400; line-height: 1.08;
          letter-spacing: -0.01em; margin: 0 0 16px; color: var(--charcoal);
        }
        .ct-title em { font-style: italic; color: var(--gold-text); }
        .ct-sub { font-size: 17px; line-height: 1.65; color: var(--mid); margin: 0; }

        /* ---------- Layout ---------- */
        .ct-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 28px; align-items: stretch; }
        @media (max-width: 860px) { .ct-grid { grid-template-columns: 1fr; } }

        .ct-card {
          background: var(--card-bg);
          border: 1px solid var(--cream-md);
          border-radius: 22px;
          padding: 40px;
          box-shadow: 0 1px 2px rgba(44,40,37,.04), 0 18px 40px -24px rgba(44,40,37,.18);
        }
        @media (max-width: 640px) { .ct-card { padding: 28px 22px; } }
        .ct-card { display: flex; flex-direction: column; }

        .ct-book {
          margin-top: auto; padding-top: 28px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
        }
        .ct-book-inner {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
          padding: 18px 20px; border-radius: 14px; background: var(--cream); border: 1px dashed var(--line);
        }
        .ct-book p { margin: 0; font-size: 15px; color: var(--mid); }
        .ct-book p strong { display: block; color: var(--charcoal); font-weight: 500; }
        .ct-book a {
          display: inline-flex; align-items: center; gap: 8px; text-decoration: none;
          font-family: var(--font-ui), sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .04em;
          color: var(--charcoal); padding: 10px 16px; border-radius: 999px; border: 1.5px solid var(--gold);
          transition: background .15s, color .15s;
        }
        .ct-book a:hover { background: var(--gold); color: #fff; }
        .ct-book a:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }

        .ct-card-title {
          font-family: var(--font-display), Georgia, serif;
          font-size: 28px; font-weight: 400; line-height: 1.2; margin: 0 0 6px;
        }
        .ct-card-sub { font-size: 15px; color: var(--mid); margin: 0 0 28px; line-height: 1.6; }

        /* ---------- Form ---------- */
        .ct-form { display: grid; gap: 20px; }
        .ct-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 560px) { .ct-row-2 { grid-template-columns: 1fr; } }

        .ct-label {
          display: block; margin-bottom: 8px;
          font-family: var(--font-ui), sans-serif;
          font-size: 13px; font-weight: 500; color: var(--charcoal);
        }
        .ct-label .ct-opt { color: var(--mid); font-weight: 500; }
        .ct-input {
          width: 100%; box-sizing: border-box;
          padding: 13px 16px;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 12px;
          font-family: var(--font-body), sans-serif; font-size: 15px; color: var(--charcoal);
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .ct-input::placeholder { color: #9A9188; }
        .ct-input:hover { border-color: var(--gold-lt); }
        .ct-input:focus { border-color: var(--gold); box-shadow: 0 0 0 4px rgba(184,154,106,.18); }
        textarea.ct-input { resize: vertical; min-height: 140px; line-height: 1.6; }

        .ct-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 15px 20px; margin-top: 4px;
          background: var(--charcoal); color: var(--on-dark);
          border: none; border-radius: 12px; cursor: pointer;
          font-family: var(--font-ui), sans-serif; font-size: 14px; font-weight: 600; letter-spacing: .06em;
          transition: background .15s, transform .15s;
        }
        .ct-btn:hover:not(:disabled) { background: #3d3733; transform: translateY(-1px); }
        .ct-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
        .ct-btn:disabled { opacity: .7; cursor: default; }
        .ct-btn.is-success { background: #3B6D11; }

        /* ---------- Info panel (dark) ---------- */
        .ct-info {
          background: var(--charcoal); color: var(--on-dark);
          border-radius: 22px; padding: 40px;
          display: flex; flex-direction: column; gap: 32px;
          position: relative; overflow: hidden;
        }
        .ct-info::before {
          content: ''; position: absolute; width: 320px; height: 320px; border-radius: 50%;
          background: var(--gold); opacity: .12; filter: blur(60px); top: -120px; right: -120px;
          pointer-events: none;
        }
        @media (max-width: 640px) { .ct-info { padding: 28px 22px; } }

        .ct-findus {
          font-family: var(--font-ui), sans-serif;
          font-size: 14px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase;
          color: var(--gold-lt); margin: 0 0 10px;
        }
        .ct-info-title {
          font-family: var(--font-display), Georgia, serif;
          font-size: 30px; font-weight: 400; line-height: 1.2; margin: 0; color: var(--on-dark);
        }

        .ct-list { display: grid; gap: 6px; }
        .ct-item {
          display: flex; align-items: flex-start; gap: 16px;
          padding: 12px; margin: 0 -12px; border-radius: 14px;
          color: inherit; text-decoration: none;
          transition: background .15s;
        }
        .ct-item:hover { background: rgba(247,243,238,.06); }
        .ct-item:focus-visible { outline: 2px solid var(--gold-lt); outline-offset: 2px; }
        .ct-badge {
          flex: none; width: 40px; height: 40px; border-radius: 50%;
          display: grid; place-items: center;
          border: 1px solid rgba(212,184,150,.45); color: var(--gold-lt);
        }
        .ct-item-label {
          display: block; font-family: var(--font-ui), sans-serif;
          font-size: 12px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase;
          color: var(--on-dark-2); margin: 2px 0 4px;
        }
        .ct-item-text { display: block; font-size: 16px; line-height: 1.55; color: var(--on-dark); }

        .ct-hours-head { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; color: var(--gold-lt); }
        .ct-hours-head h3 {
          font-family: var(--font-display), Georgia, serif;
          font-size: 22px; font-weight: 400; margin: 0; color: var(--on-dark);
        }
        .ct-hours { list-style: none; margin: 0; padding: 0; border-top: 1px solid rgba(247,243,238,.12); }
        .ct-hours li {
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          padding: 12px 0; border-bottom: 1px solid rgba(247,243,238,.12);
          font-size: 15px;
        }
        .ct-hours .ct-day { color: var(--on-dark-2); display: inline-flex; align-items: center; gap: 10px; }
        .ct-hours .ct-time {
          font-family: var(--font-ui), sans-serif; font-weight: 500;
          font-variant-numeric: tabular-nums; color: var(--on-dark);
        }
        .ct-hours li.is-today .ct-day { color: var(--on-dark); font-weight: 500; }
        .ct-today-pill {
          font-family: var(--font-ui), sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: .12em; text-transform: uppercase;
          padding: 3px 8px; border-radius: 999px;
          background: var(--gold-lt); color: var(--charcoal);
        }

        .ct-wa {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 18px; border-radius: 16px;
          background: var(--gold-lt); color: var(--charcoal); text-decoration: none;
          transition: transform .15s, background .15s;
          margin-top: auto;
        }
        .ct-wa:hover { background: #DFC7A8; transform: translateY(-1px); }
        .ct-wa:focus-visible { outline: 2px solid var(--on-dark); outline-offset: 3px; }
        .ct-wa-icon { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--charcoal); color: var(--gold-lt); }
        .ct-wa-kicker { display: block; font-family: var(--font-ui), sans-serif; font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
        .ct-wa-num { display: block; font-size: 16px; font-weight: 500; margin-top: 2px; }
        .ct-wa-arrow { margin-left: auto; }
      `}</style>

      <div className="ct-wrap">

        {/* Page header */}
        <header className="ct-header">
          <p className="ct-eyebrow">Contact</p>
          <h1 className="ct-title">Let&apos;s get you <em>glowing</em></h1>
          <p className="ct-sub">
            Questions about a treatment, a special request, or just want to say hello?
            Send us a note and we&apos;ll get back to you soon.
          </p>
        </header>

        <div className="ct-grid">

          {/* Left — form */}
          <section className="ct-card" aria-labelledby="ct-form-title">
            <h2 id="ct-form-title" className="ct-card-title">Send us a message</h2>
            <p className="ct-card-sub">We usually reply within one business day.</p>

            <form onSubmit={handleSubmit} className="ct-form">
              <div>
                <label htmlFor="c-name" className="ct-label">Full name</label>
                <input
                  id="c-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="ct-input"
                />
              </div>

              <div className="ct-row-2">
                <div>
                  <label htmlFor="c-email" className="ct-label">Email</label>
                  <input
                    id="c-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="ct-input"
                  />
                </div>
                <div>
                  <label htmlFor="c-phone" className="ct-label">
                    Phone <span className="ct-opt">(optional)</span>
                  </label>
                  <input
                    id="c-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(317) 555-0123"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="ct-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="c-msg" className="ct-label">Message</label>
                <textarea
                  id="c-msg"
                  required
                  rows={5}
                  placeholder="How can we help you today?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="ct-input"
                />
              </div>

              <button
                type="submit"
                disabled={submitted}
                className={`ct-btn ${success ? 'is-success' : ''}`}
              >
                {success ? 'Message sent ✓' : submitted ? 'Sending…' : <>Send message {Icon.arrow}</>}
              </button>
            </form>

            <div className="ct-book">
              <div className="ct-book-inner">
                <p><strong>Ready to book?</strong>Pick a treatment and time that suits you.</p>
                <Link href="/booking">Book an appointment {Icon.arrow}</Link>
              </div>
            </div>
          </section>

          {/* Right — studio details */}
          <aside className="ct-info" aria-labelledby="ct-info-title">
            <div>
              <p className="ct-findus">Find us</p>
              <h2 id="ct-info-title" className="ct-info-title">Visit our studio</h2>
            </div>

            <div className="ct-list">
              {contactRows.map(({ key, icon, label, lines, href, external }) => (
                <a
                  key={key}
                  href={href}
                  className="ct-item"
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <span className="ct-badge">{icon}</span>
                  <span>
                    <span className="ct-item-label">{label}</span>
                    {lines.map((line) => (
                      <span key={line} className="ct-item-text">{line}</span>
                    ))}
                  </span>
                </a>
              ))}
            </div>

            <div>
              <div className="ct-hours-head">
                {Icon.clock}
                <h3>Opening hours</h3>
              </div>
              <ul className="ct-hours">
                {HOURS_SUMMARY.map(({ label, time }) => {
                  const isToday = label === today;
                  return (
                    <li key={label} className={isToday ? 'is-today' : undefined}>
                      <span className="ct-day">
                        {label}
                        {isToday && <span className="ct-today-pill">Today</span>}
                      </span>
                      <span className="ct-time">{time}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <a
              href={`https://wa.me/${SITE_PHONE_TEL.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ct-wa"
            >
              <span className="ct-wa-icon">{Icon.chat}</span>
              <span>
                <span className="ct-wa-kicker">Quick reply on WhatsApp</span>
                <span className="ct-wa-num">{SITE_PHONE_DISPLAY}</span>
              </span>
              <span className="ct-wa-arrow">{Icon.arrow}</span>
            </a>
          </aside>

        </div>
      </div>
    </div>
  );
}

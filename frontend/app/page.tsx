// app/page.tsx
import Link from 'next/link';

const CATEGORIES = [
  {
    key: 'EYEBROW_LASH',
    title: 'Brows & Lashes',
    desc: 'Precision threading, lamination, and extensions that frame your eyes beautifully.',
    img: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=700&q=80',
  },
  {
    key: 'WAXING',
    title: 'Waxing',
    desc: 'Smooth, long-lasting results with a gentle touch — from face to full body.',
    img: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=700&q=80',
  },
  {
    key: 'FACIAL_SKINCARE',
    title: 'Facials & Skincare',
    desc: 'Customized treatments that reveal your healthiest, most radiant skin.',
    img: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=700&q=80',
  },
];

const VALUES = [
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="hm-value-icon-svg">
        <path d="M16 4 C16 4 6 10 6 18 a10 10 0 0 0 20 0 C26 10 16 4 16 4Z" />
        <path d="M16 14 v6 M13 17 h6" strokeLinecap="round" />
      </svg>
    ),
    title: 'Clean Beauty',
    desc: 'Only premium, ethically sourced products — kind to your skin and the planet.',
  },
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="hm-value-icon-svg">
        <circle cx="16" cy="16" r="11" />
        <path d="M16 10 v6 l4 3" strokeLinecap="round" />
      </svg>
    ),
    title: 'Your Time, Respected',
    desc: 'Punctual appointments, zero waiting. We honour your schedule as much as you do.',
  },
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="hm-value-icon-svg">
        <path d="M8 20 Q16 8 24 20" strokeLinecap="round" />
        <path d="M10 20 Q16 28 22 20" strokeLinecap="round" />
      </svg>
    ),
    title: 'Artisan Craft',
    desc: 'Every service performed with the precision and care of a true artisan.',
  },
];

// Everything except the rating is still a fixed brand claim — only the
// rating stat is backed by real data (see fetchRatingStat below).
const BASE_STATS = [
  { value: '12+', label: 'Years of Excellence' },
  { value: '3,000+', label: 'Happy Clients' },
  { value: '15+', label: 'Expert Treatments' },
];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  service_name: string;
  reviewer_name: string;
  created_at: string;
}

// Server-side fetch (this page has no 'use client') so the real average
// renders on first paint with no loading flicker. `no-store` keeps it fresh
// on every request rather than baking a stale number in at build time.
// e.g. big value "4.8★", caption "12 Reviews" — together they read as
// "4.8 ★ · 12 reviews" the way the stats bar already pairs a big number
// with a small caption underneath.
async function fetchRatingStat(): Promise<{ value: string; label: string }> {
  try {
    const res = await fetch(`${API}/api/reviews/stats`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success && data.averageRating !== null && data.totalReviews > 0) {
      const noun = data.totalReviews === 1 ? 'Review' : 'Reviews';
      return { value: `${data.averageRating}★`, label: `${data.totalReviews} ${noun}` };
    }
  } catch {
    // Backend unreachable at render time — fall through to the placeholder
    // below rather than breaking the whole homepage over one stat.
  }
  return { value: 'New', label: 'Be the First to Review' };
}

// Individual public reviews (service, stars, comment, first name, date) for
// the "Client Love" section below. Visible to everyone, no account needed.
async function fetchPublicReviews(): Promise<PublicReview[]> {
  try {
    const res = await fetch(`${API}/api/reviews/public?limit=6`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success) return data.reviews || [];
  } catch {
    // Backend unreachable — the section below simply renders nothing.
  }
  return [];
}

export default async function HomePage() {
  const [ratingStat, reviews] = await Promise.all([fetchRatingStat(), fetchPublicReviews()]);
  const STATS = [...BASE_STATS, ratingStat];
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');

        .hm {
          --cream:    #F7F3EE;
          --cream-md: #EDE6DC;
          --card-bg:  #FDFAF6;
          --gold:     #B89A6A;
          --gold-lt:  #D4B896;
          --charcoal: #2C2825;
          --mid:      #6B635A;
          --soft:     #9E968E;
          background: var(--cream);
          color: var(--charcoal);
          font-family: 'Jost', sans-serif;
        }

        /* ── Hero ── */
        .hm-hero {
          position: relative; overflow: hidden;
          min-height: 88vh; display: flex; align-items: center;
          background: linear-gradient(160deg, rgba(20,16,12,.72) 0%, rgba(44,35,25,.55) 55%, rgba(184,154,106,.28) 100%),
                      url('https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1800&q=85') center/cover;
          padding: 120px 24px 100px;
        }
        .hm-hero-inner { max-width: 640px; position: relative; z-index: 1; }
        /* Small decorative mark replacing the old location eyebrow — signals
           "start of content" without repeating the brand name (the Navbar
           already carries it) or a location line no longer needed. */
        .hm-hero-rule {
          display: block; width: 46px; height: 2px;
          background: var(--gold-lt); margin-bottom: 30px;
        }
        .hm-h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(46px, 7vw, 80px); font-weight: 300;
          color: #F7F3EE; line-height: 1.08; margin: 0 0 26px;
        }
        .hm-h1 em { font-style: italic; color: var(--gold-lt); }
        .hm-hero-p {
          font-size: 17px; font-weight: 300; color: #D9D1C7;
          max-width: 460px; line-height: 1.85; margin: 0 0 44px;
        }
        .hm-hero-actions { display: flex; gap: 16px; flex-wrap: wrap; }
        .hm-btn-primary {
          display: inline-block; background: var(--gold); color: var(--charcoal);
          font-family: 'Jost', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: .14em; text-transform: uppercase;
          padding: 17px 36px; border-radius: 2px; text-decoration: none;
          transition: background .22s, transform .22s;
        }
        .hm-btn-primary:hover { background: var(--gold-lt); transform: translateY(-2px); }
        /* Single hero CTA — since it now stands alone (no paired primary
           button), it gets more presence than the old ghost secondary:
           a wider outline, a sliding arrow on hover, and a full gold fill
           on hover instead of a faint tint. */
        .hm-hero-cta {
          display: inline-flex; align-items: center; gap: 10px;
          background: transparent; color: #F7F3EE;
          border: 1.5px solid var(--gold-lt);
          font-family: 'Jost', sans-serif; font-size: 12px; font-weight: 600;
          letter-spacing: .16em; text-transform: uppercase;
          padding: 18px 38px; border-radius: 2px; text-decoration: none;
          transition: background .25s ease, color .25s ease, gap .25s ease;
        }
        .hm-hero-cta svg { width: 14px; height: 14px; transition: transform .25s ease; }
        .hm-hero-cta:hover { background: var(--gold-lt); color: var(--charcoal); gap: 14px; }
        .hm-hero-cta:hover svg { transform: translateX(3px); }

        /* ── Stats bar ── */
        .hm-stats { background: var(--charcoal); padding: 56px 24px; }
        .hm-stats-grid {
          max-width: 1100px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 32px; text-align: center;
        }
        .hm-stat-val {
          font-family: 'Cormorant Garamond', serif; font-size: 44px; font-weight: 300;
          color: var(--gold-lt); line-height: 1; margin-bottom: 8px;
        }
        .hm-stat-label {
          font-size: 10px; font-weight: 600; letter-spacing: .14em;
          text-transform: uppercase; color: var(--soft);
        }

        /* ── Section shared ── */
        .hm-container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
        .hm-section { padding: 100px 0; }
        .hm-section-header { text-align: center; margin-bottom: 56px; }
        .hm-kicker {
          font-size: 11px; font-weight: 600; letter-spacing: .2em;
          text-transform: uppercase; color: var(--gold); margin-bottom: 12px;
        }
        .hm-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(32px, 4.5vw, 50px); font-weight: 400;
          margin: 0; line-height: 1.1;
        }
        .hm-section-title em { font-style: italic; color: var(--gold); }
        .hm-section-sub {
          font-size: 15px; font-weight: 300; color: var(--mid);
          max-width: 480px; margin: 14px auto 0; line-height: 1.8;
        }

        /* ── Services grid ── */
        .hm-services-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px;
        }
        .hm-service-card {
          background: var(--card-bg); border: 1px solid var(--cream-md);
          border-radius: 6px; overflow: hidden; text-decoration: none; color: inherit;
          display: block; transition: box-shadow .3s, transform .3s, border-color .3s;
        }
        .hm-service-card:hover {
          box-shadow: 0 20px 56px rgba(44,40,37,.11);
          transform: translateY(-5px); border-color: var(--gold-lt);
        }
        .hm-service-img-wrap { height: 200px; overflow: hidden; }
        .hm-service-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s ease; }
        .hm-service-card:hover .hm-service-img { transform: scale(1.06); }
        .hm-service-body { padding: 26px 26px 28px; }
        .hm-service-title {
          font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 500;
          margin: 0 0 10px; color: var(--charcoal);
        }
        .hm-service-desc { font-size: 14px; font-weight: 300; color: var(--mid); line-height: 1.75; margin: 0 0 16px; }
        .hm-service-link {
          font-size: 11px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: var(--gold);
        }

        /* ── Values ── */
        .hm-values-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .hm-value-card { text-align: center; padding: 8px; }
        .hm-value-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: var(--cream-md); color: var(--gold);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
        }
        .hm-value-icon-svg { width: 26px; height: 26px; }
        .hm-value-title {
          font-family: 'Cormorant Garamond', serif; font-size: 21px; font-weight: 500;
          margin: 0 0 8px; color: var(--charcoal);
        }
        .hm-value-desc { font-size: 13px; font-weight: 300; color: var(--mid); line-height: 1.75; }

        /* ── Client reviews ── */
        .hm-reviews-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .hm-review-card {
          background: var(--card-bg); border: 1px solid var(--cream-md);
          border-radius: 6px; padding: 30px 28px; display: flex; flex-direction: column;
        }
        .hm-review-stars { color: var(--gold); font-size: 16px; letter-spacing: 2px; margin-bottom: 14px; }
        .hm-review-comment {
          font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 19px;
          font-weight: 400; color: var(--charcoal); line-height: 1.6; margin: 0 0 20px; flex: 1;
        }
        .hm-review-name { font-size: 13px; font-weight: 600; color: var(--charcoal); }
        .hm-review-meta { font-size: 12px; font-weight: 300; color: var(--soft); margin-top: 2px; }

        /* ── CTA banner ── */
        .hm-banner {
          background: var(--charcoal); padding: 96px 24px; text-align: center;
          position: relative; overflow: hidden;
        }
        .hm-banner-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .14; pointer-events: none; }
        .hm-banner-orb-a { width: 420px; height: 420px; background: var(--gold); top: -140px; right: -100px; }
        .hm-banner-orb-b { width: 300px; height: 300px; background: #c09060; bottom: -80px; left: -60px; }
        .hm-banner-title {
          font-family: 'Cormorant Garamond', serif; font-size: clamp(34px, 5vw, 58px); font-weight: 300;
          color: #F7F3EE; margin: 0 0 18px; line-height: 1.1; position: relative; z-index: 1;
        }
        .hm-banner-title em { font-style: italic; color: var(--gold-lt); }
        .hm-banner-sub {
          font-size: 15px; font-weight: 300; color: #A8A09A;
          max-width: 420px; margin: 0 auto 32px; line-height: 1.8; position: relative; z-index: 1;
        }

        @media (max-width: 900px) {
          .hm-services-grid, .hm-values-grid, .hm-reviews-grid { grid-template-columns: 1fr; }
          .hm-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 28px; }
          .hm-section { padding: 72px 0; }
        }
        @media (max-width: 480px) {
          .hm-hero { padding: 96px 20px 80px; min-height: 76vh; }
        }
      `}</style>

      <div className="hm">

        {/* ── Hero ── */}
        <section className="hm-hero">
          <div className="hm-hero-inner">
            <span className="hm-hero-rule" aria-hidden="true" />
            <h1 className="hm-h1">Where beauty<br />meets <em>ritual.</em></h1>
            <p className="hm-hero-p">
              Premium beauty treatments crafted with precision, care, and artistry —
              for every version of you.
            </p>
            <div className="hm-hero-actions">
              <Link href="/services" className="hm-hero-cta">
                Explore Services
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="hm-stats">
          <div className="hm-stats-grid">
            {STATS.map(s => (
              <div key={s.label}>
                <div className="hm-stat-val">{s.value}</div>
                <div className="hm-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Signature Services ── */}
        <section className="hm-section">
          <div className="hm-container">
            <div className="hm-section-header">
              <p className="hm-kicker">What We Offer</p>
              <h2 className="hm-section-title">Signature <em>Treatments</em></h2>
              <p className="hm-section-sub">
                From precision brow shaping to restorative facials, every service is
                tailored to bring out your natural radiance.
              </p>
            </div>
            <div className="hm-services-grid">
              {CATEGORIES.map(c => (
                <Link key={c.key} href="/services" className="hm-service-card">
                  <div className="hm-service-img-wrap">
                    <img src={c.img} alt={c.title} className="hm-service-img" loading="lazy" />
                  </div>
                  <div className="hm-service-body">
                    <h3 className="hm-service-title">{c.title}</h3>
                    <p className="hm-service-desc">{c.desc}</p>
                    <span className="hm-service-link">View Treatments →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Values ── */}
        <section className="hm-section" style={{ paddingTop: 0, background: 'var(--card-bg)' }}>
          <div className="hm-container">
            <div className="hm-section-header">
              <p className="hm-kicker">Why Crown &amp; Glow</p>
              <h2 className="hm-section-title">Beauty, <em>Done Right</em></h2>
            </div>
            <div className="hm-values-grid">
              {VALUES.map(v => (
                <div key={v.title} className="hm-value-card">
                  <div className="hm-value-icon">{v.icon}</div>
                  <h3 className="hm-value-title">{v.title}</h3>
                  <p className="hm-value-desc">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Client Reviews ── */}
        {/* Public, no login required — social proof drawn straight from real
            completed-appointment reviews. Entirely absent when nobody has
            left a comment yet, rather than showing an empty section. */}
        {reviews.length > 0 && (
          <section className="hm-section">
            <div className="hm-container">
              <div className="hm-section-header">
                <p className="hm-kicker">Client Love</p>
                <h2 className="hm-section-title">What Our <em>Clients Say</em></h2>
                <p className="hm-section-sub">
                  Real reviews from real appointments — no account needed to read them.
                </p>
              </div>
              <div className="hm-reviews-grid">
                {reviews.map(r => (
                  <div key={r.id} className="hm-review-card">
                    <div className="hm-review-stars" aria-label={`${r.rating} out of 5 stars`}>
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </div>
                    <p className="hm-review-comment">&ldquo;{r.comment}&rdquo;</p>
                    <p className="hm-review-name">{r.reviewer_name}</p>
                    <p className="hm-review-meta">
                      {r.service_name}
                      {' · '}
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CTA Banner ── */}
        <section className="hm-banner">
          <div className="hm-banner-orb hm-banner-orb-a" />
          <div className="hm-banner-orb hm-banner-orb-b" />
          <h2 className="hm-banner-title">Ready to <em>Glow?</em></h2>
          <p className="hm-banner-sub">
            Book your appointment today and experience the Crown &amp; Glow difference for yourself.
          </p>
          <Link href="/booking" className="hm-btn-primary" style={{ position: 'relative', zIndex: 1 }}>
            Book an Appointment
          </Link>
        </section>

      </div>
    </>
  );
}

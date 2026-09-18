// app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import HeroSlider from '../components/HeroSlider';
import type { HeroSlide } from '../components/HeroSlider';

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
  { value: '12+', label: 'Years of exceptional services' },
  { value: '15+', label: 'Premium Treatments' },
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

// Admin-managed homepage hero background(s) + copy — see
// backend/src/services/heroSlide.service.ts. `no-store` matches the same
// "always fresh" convention as fetchRatingStat/fetchPublicReviews above.
async function fetchHeroSlides(): Promise<HeroSlide[]> {
  try {
    const res = await fetch(`${API}/api/hero-slides`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success) return data.slides || [];
  } catch {
    // Backend unreachable — HeroSlider falls back to its built-in default
    // slide rather than rendering nothing.
  }
  return [];
}

// Shape of a Service row as returned by GET /api/services — the same
// admin-fed, active-only endpoint /services itself reads (see
// backend/src/services/service.service.ts).
interface FeaturedService {
  id: string;
  name: string;
  description?: string | null;
  duration: number;
  price: number;
  image?: string | null;
  is_popular?: boolean;
}

const MAX_FEATURED_SERVICES = 4;

// "Signature Treatments" section — 100% admin-driven. A service shows up
// here only when an admin checks its "Signature service" box (is_popular)
// in Admin → Services; unchecking it, or setting the service inactive,
// removes it from here on the very next request (no-store, like every
// other fetch on this page, so there's nothing to redeploy or revalidate).
async function fetchFeaturedServices(): Promise<FeaturedService[]> {
  try {
    const res = await fetch(`${API}/api/services`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success) {
      const services: FeaturedService[] = data.services || [];
      return services.filter(s => s.is_popular).slice(0, MAX_FEATURED_SERVICES);
    }
  } catch {
    // Backend unreachable — the section below simply hides itself.
  }
  return [];
}

export default async function HomePage() {
  const [ratingStat, reviews, heroSlides, featuredServices] = await Promise.all([
    fetchRatingStat(),
    fetchPublicReviews(),
    fetchHeroSlides(),
    fetchFeaturedServices(),
  ]);

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
        /* The one clickable stat — opens /reviews. Kept visually close to
           the plain stat tiles beside it, just with an obvious hover state
           and pointer cursor so it doesn't blend in as static text. */
        .hm-stat-link {
          display: block; text-decoration: none; color: inherit;
          border-radius: 4px; margin: -8px; padding: 8px;
          transition: background .2s ease;
        }
        .hm-stat-link:hover { background: rgba(212,184,150,.08); }
        .hm-stat-link:hover .hm-stat-val { color: #F7F3EE; }
        .hm-stat-link:hover .hm-stat-label { color: var(--gold-lt); }

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
        .hm-service-img-wrap { position: relative; height: 200px; overflow: hidden; }
        .hm-service-img { object-fit: cover; transition: transform .5s ease; }
        .hm-service-card:hover .hm-service-img { transform: scale(1.06); }
        .hm-service-body { padding: 26px 26px 28px; }
        .hm-service-title {
          font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 500;
          margin: 0 0 10px; color: var(--charcoal);
        }
        .hm-service-desc { font-size: 14px; font-weight: 300; color: var(--mid); line-height: 1.75; margin: 0 0 16px; }
        /* Shown only when a service has no admin-uploaded photo yet — a
           neutral placeholder, never a substitute stock photo. */
        .hm-service-img-empty { width: 100%; height: 100%; background: var(--cream-md); }
        .hm-service-foot {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding-top: 16px; border-top: 1px solid var(--cream-md);
        }
        .hm-service-meta { display: flex; flex-direction: column; gap: 4px; }
        .hm-service-duration { font-size: 11px; color: var(--soft); }
        .hm-service-price {
          font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 500;
          color: var(--charcoal);
        }
        .hm-service-book {
          font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          color: var(--charcoal); background: transparent; border: 1.5px solid var(--gold);
          border-radius: 2px; padding: 10px 18px; text-decoration: none;
          transition: background .2s ease, color .2s ease;
        }
        .hm-service-book:hover { background: var(--gold); color: #fff; }

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
      `}</style>

      <div className="hm">

        {/* ── Hero (admin-managed, see components/HeroSlider.tsx) ── */}
        <HeroSlider slides={heroSlides} />

        {/* ── Stats ── */}
        <section className="hm-stats">
          <div className="hm-stats-grid">
            {BASE_STATS.map(s => (
              <div key={s.label}>
                <div className="hm-stat-val">{s.value}</div>
                <div className="hm-stat-label">{s.label}</div>
              </div>
            ))}
            {/* Only stat that's interactive — opens the full, verified
                reviews list. Everything else in this bar is unchanged. */}
            <Link href="/reviews" className="hm-stat-link" aria-label="Read customer reviews">
              <div className="hm-stat-val">{ratingStat.value}</div>
              <div className="hm-stat-label">{ratingStat.label} →</div>
            </Link>
          </div>
        </section>

        {/* ── Signature Services ── admin-driven: shows the services an
             admin has checked "Signature service" for in Admin → Services
             (is_popular), same records /services lists. Hides entirely
             when there are none — no placeholder content. ── */}
        {featuredServices.length > 0 && (
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
                {featuredServices.map(s => (
                  <article key={s.id} className="hm-service-card">
                    <div className="hm-service-img-wrap">
                      {s.image ? (
                        <Image src={s.image} alt={s.name} fill sizes="(max-width: 900px) 100vw, 33vw" className="hm-service-img" />
                      ) : (
                        <div className="hm-service-img-empty" aria-hidden="true" />
                      )}
                    </div>
                    <div className="hm-service-body">
                      <h3 className="hm-service-title">{s.name}</h3>
                      {s.description && <p className="hm-service-desc">{s.description}</p>}
                      <div className="hm-service-foot">
                        <div className="hm-service-meta">
                          <span className="hm-service-duration">⏱ {s.duration} min</span>
                          <span className="hm-service-price">${Number(s.price).toLocaleString('en-US')}</span>
                        </div>
                        <Link href={`/booking?service=${s.id}`} className="hm-service-book">Book Now</Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

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

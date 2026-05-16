// app/about/page.tsx
'use client';

import { useRouter } from 'next/navigation';

const TEAM = [
  {
    name: 'Jana Silwal',
    role: 'Founder & Master Beautician',
    bio: 'With over 12 years of experience in luxury beauty, Jana founded Crown & Glow with a singular vision — to bring world-class beauty rituals to Indianapolis.',
    img: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80',
  },
  {
    name: 'Priya Mehta',
    role: 'Senior Lash & Brow Artist',
    bio: 'Priya is a certified lash architect with a meticulous eye for detail. Her brow transformations have earned a loyal clientele across the city.',
    img: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80',
  },
  {
    name: 'Sofia Reyes',
    role: 'Lead Skin Therapist',
    bio: 'Sofia specialises in advanced facials and skin science. She customises every treatment to your unique skin biology for lasting, visible results.',
    img: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80',
  },
];

const VALUES = [
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-7 h-7">
        <path d="M16 4 C16 4 6 10 6 18 a10 10 0 0 0 20 0 C26 10 16 4 16 4Z"/>
        <path d="M16 14 v6 M13 17 h6" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Clean Beauty',
    desc: 'We use only premium, ethically sourced products that are kind to your skin and the planet.',
  },
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-7 h-7">
        <circle cx="16" cy="16" r="11"/>
        <path d="M16 10 v6 l4 3" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Your Time, Respected',
    desc: 'Punctual appointments, zero waiting. We honour your schedule as much as you do.',
  },
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-7 h-7">
        <path d="M8 20 Q16 8 24 20" strokeLinecap="round"/>
        <path d="M10 20 Q16 28 22 20" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Artisan Craft',
    desc: 'Every service is performed with the precision and care of a true artisan — no shortcuts, ever.',
  },
  {
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-7 h-7">
        <path d="M6 16 Q10 8 16 12 Q22 16 26 8" strokeLinecap="round"/>
        <circle cx="16" cy="22" r="4"/>
      </svg>
    ),
    title: 'Tailored to You',
    desc: 'No two clients are alike. We listen deeply and personalise every treatment to your unique needs.',
  },
];

const STATS = [
  { value: '12+', label: 'Years of Excellence' },
  { value: '3,000+', label: 'Happy Clients' },
  { value: '15+', label: 'Expert Treatments' },
  { value: '4.9★', label: 'Average Rating' },
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap');

        .ab {
          --cream:    #F7F3EE;
          --cream-md: #EDE6DC;
          --gold:     #B89A6A;
          --gold-lt:  #D4B896;
          --charcoal: #2C2825;
          --mid:      #6B635A;
          --soft:     #9E968E;
          --card-bg:  #FDFAF6;
          --white:    #FFFFFF;
          background: var(--cream);
          color: var(--charcoal);
          font-family: 'Jost', sans-serif;
        }

        /* ── Hero ── */
        .ab-hero {
          background: var(--charcoal);
          position: relative; overflow: hidden;
          padding: 120px 24px 100px; text-align: center;
        }
        .ab-orb {
          position: absolute; border-radius: 50%;
          filter: blur(90px); opacity: 0.14; pointer-events: none;
        }
        .ab-orb-a { width:500px;height:500px;background:var(--gold);top:-160px;right:-100px; }
        .ab-orb-b { width:300px;height:300px;background:#c09060;bottom:-80px;left:-60px; }
        .ab-eyebrow {
          display:inline-block; font-size:11px; font-weight:500;
          letter-spacing:.22em; text-transform:uppercase;
          color:var(--gold-lt); margin-bottom:18px;
        }
        .ab-h1 {
          font-family:'Cormorant Garamond',serif;
          font-size:clamp(52px,8vw,90px); font-weight:300;
          color:#F7F3EE; line-height:1.0; margin:0 0 24px;
        }
        .ab-h1 em { font-style:italic; color:var(--gold-lt); }
        .ab-hero-p {
          font-size:17px; font-weight:300; color:#B0A89E;
          max-width:500px; margin:0 auto; line-height:1.85;
        }
        .ab-rule { width:36px;height:1px;background:var(--gold);margin:30px auto 0;opacity:.5; }

        /* ── Container ── */
        .ab-container { max-width:1100px; margin:0 auto; padding:0 24px; }

        /* ── Story section ── */
        .ab-story {
          padding: 100px 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }
        .ab-story-img-wrap {
          position: relative;
        }
        .ab-story-img {
          width: 100%; height: 520px; object-fit: cover;
          border-radius: 4px; display: block;
        }
        .ab-story-accent {
          position: absolute;
          bottom: -24px; right: -24px;
          width: 180px; height: 180px;
          border: 1px solid var(--gold-lt);
          border-radius: 4px;
          opacity: 0.5;
          pointer-events: none;
        }
        .ab-story-tag {
          position: absolute;
          top: 24px; left: -20px;
          background: var(--charcoal);
          color: var(--gold-lt);
          font-size: 10px; font-weight: 600;
          letter-spacing: .18em; text-transform: uppercase;
          padding: 10px 18px; border-radius: 2px;
        }
        .ab-section-kicker {
          font-size: 11px; font-weight: 500;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--gold); margin-bottom: 14px;
        }
        .ab-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(34px,4vw,50px); font-weight: 400;
          margin: 0 0 24px; line-height: 1.1;
        }
        .ab-story-text {
          font-size: 16px; font-weight: 300; color: var(--mid);
          line-height: 1.9; margin-bottom: 16px;
        }
        .ab-cta {
          display: inline-block; margin-top: 16px;
          background: var(--charcoal); color: var(--cream);
          font-family: 'Jost', sans-serif; font-size: 11px;
          font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
          padding: 15px 32px; border-radius: 2px; border: none;
          cursor: pointer;
          transition: background .22s, color .22s, transform .22s;
        }
        .ab-cta:hover {
          background: var(--gold); color: var(--charcoal);
          transform: translateY(-2px);
        }

        /* ── Stats ── */
        .ab-stats {
          background: var(--charcoal);
          padding: 72px 0;
        }
        .ab-stats-grid {
          max-width: 1100px; margin: 0 auto; padding: 0 24px;
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 40px; text-align: center;
        }
        .ab-stat-val {
          font-family: 'Cormorant Garamond', serif;
          font-size: 52px; font-weight: 300;
          color: var(--gold-lt); line-height: 1; margin-bottom: 10px;
        }
        .ab-stat-label {
          font-size: 11px; font-weight: 500; letter-spacing: .14em;
          text-transform: uppercase; color: var(--soft);
        }

        /* ── Values ── */
        .ab-values { padding: 100px 0; }
        .ab-values-header { text-align: center; margin-bottom: 64px; }
        .ab-values-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px;
        }
        .ab-value-card {
          background: var(--card-bg);
          border: 1px solid var(--cream-md);
          border-radius: 4px;
          padding: 36px 32px;
          transition: box-shadow .3s, transform .3s, border-color .3s;
        }
        .ab-value-card:hover {
          box-shadow: 0 16px 48px rgba(44,40,37,.09);
          transform: translateY(-3px);
          border-color: var(--gold-lt);
        }
        .ab-value-icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: var(--cream-md);
          display: flex; align-items: center; justify-content: center;
          color: var(--gold); margin-bottom: 20px;
          transition: background .3s;
        }
        .ab-value-card:hover .ab-value-icon { background: var(--gold-lt); }
        .ab-value-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; font-weight: 500;
          margin: 0 0 10px; color: var(--charcoal);
        }
        .ab-value-desc {
          font-size: 14px; font-weight: 300; color: var(--mid);
          line-height: 1.8;
        }

        /* ── Team ── */
        .ab-team { padding: 0 0 100px; }
        .ab-team-header { text-align: center; margin-bottom: 64px; }
        .ab-team-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }
        .ab-member {
          background: var(--card-bg);
          border: 1px solid var(--cream-md);
          border-radius: 4px; overflow: hidden;
          transition: box-shadow .3s, transform .3s, border-color .3s;
        }
        .ab-member:hover {
          box-shadow: 0 20px 56px rgba(44,40,37,.1);
          transform: translateY(-4px); border-color: var(--gold-lt);
        }
        .ab-member-img-wrap { height: 280px; overflow: hidden; }
        .ab-member-img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          transition: transform .5s ease;
        }
        .ab-member:hover .ab-member-img { transform: scale(1.05); }
        .ab-member-body { padding: 24px 26px 28px; }
        .ab-member-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; font-weight: 500;
          margin: 0 0 4px; color: var(--charcoal);
        }
        .ab-member-role {
          font-size: 11px; font-weight: 600; letter-spacing: .1em;
          text-transform: uppercase; color: var(--gold);
          margin-bottom: 14px;
        }
        .ab-member-bio {
          font-size: 13px; font-weight: 300; color: var(--mid);
          line-height: 1.8;
        }

        /* ── CTA Banner ── */
        .ab-banner {
          background: var(--charcoal);
          padding: 100px 24px; text-align: center;
          position: relative; overflow: hidden;
        }
        .ab-banner-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: .12; pointer-events: none;
        }
        .ab-banner-orb-a { width:400px;height:400px;background:var(--gold);top:-120px;left:-100px; }
        .ab-banner-orb-b { width:300px;height:300px;background:#c09060;bottom:-80px;right:-60px; }
        .ab-banner-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(36px, 5vw, 64px); font-weight: 300;
          color: #F7F3EE; margin: 0 0 20px; line-height: 1.1;
          position: relative; z-index: 1;
        }
        .ab-banner-title em { font-style: italic; color: var(--gold-lt); }
        .ab-banner-sub {
          font-size: 16px; font-weight: 300; color: #A8A09A;
          max-width: 440px; margin: 0 auto 36px;
          line-height: 1.8; position: relative; z-index: 1;
        }
        .ab-banner-btn {
          position: relative; z-index: 1;
          background: var(--gold); color: var(--charcoal);
          font-family: 'Jost', sans-serif; font-size: 11px;
          font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
          padding: 16px 40px; border-radius: 2px; border: none;
          cursor: pointer;
          transition: background .22s, transform .22s;
        }
        .ab-banner-btn:hover {
          background: var(--gold-lt); transform: translateY(-2px);
        }

        /* Responsive */
        @media (max-width: 900px) {
          .ab-story { grid-template-columns: 1fr; gap: 40px; padding: 72px 0; }
          .ab-story-img { height: 360px; }
          .ab-story-accent { display: none; }
          .ab-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 32px; }
          .ab-values-grid { grid-template-columns: 1fr; }
          .ab-team-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .ab-hero { padding: 80px 20px 72px; }
          .ab-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .ab-stat-val { font-size: 40px; }
        }
      `}</style>

      <div className="ab">

        {/* ── Hero ── */}
        <section className="ab-hero">
          <div className="ab-orb ab-orb-a" />
          <div className="ab-orb ab-orb-b" />
          <p className="ab-eyebrow">Crown &amp; Glow · Indianapolis</p>
          <h1 className="ab-h1">About <em>Us</em></h1>
          <p className="ab-hero-p">
            We are a team of passionate beauty artisans dedicated
            to making every client feel extraordinary.
          </p>
          <div className="ab-rule" />
        </section>

        {/* ── Our Story ── */}
        <section style={{ background: 'var(--cream)' }}>
          <div className="ab-container">
            <div className="ab-story">
              <div className="ab-story-img-wrap">
                <img
                  src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80"
                  alt="Crown & Glow Salon"
                  className="ab-story-img"
                />
                <div className="ab-story-accent" />
                <span className="ab-story-tag">Est. 2013 · Indianapolis</span>
              </div>
              <div>
                <p className="ab-section-kicker">Our Story</p>
                <h2 className="ab-section-title">
                  Beauty born from<br />passion & precision
                </h2>
                <p className="ab-story-text">
                  Crown &amp; Glow was born from a simple belief: every person deserves
                  to feel their most radiant self. Founded in 2013 in the heart of
                  Indianapolis, we set out to create a sanctuary where luxury beauty
                  meets genuine human connection.
                </p>
                <p className="ab-story-text">
                  Over a decade later, our team of expert therapists continues to
                  deliver precision treatments in a warm, welcoming environment —
                  using only the finest products and techniques the industry has to offer.
                </p>
                <button className="ab-cta" onClick={() => router.push('/booking')}>
                  Book Your Experience
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="ab-stats">
          <div className="ab-stats-grid">
            {STATS.map(s => (
              <div key={s.label}>
                <div className="ab-stat-val">{s.value}</div>
                <div className="ab-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Values ── */}
        <section className="ab-values" style={{ background: 'var(--cream)' }}>
          <div className="ab-container">
            <div className="ab-values-header">
              <p className="ab-section-kicker">What We Stand For</p>
              <h2 className="ab-section-title">Our Core Values</h2>
            </div>
            <div className="ab-values-grid">
              {VALUES.map(v => (
                <div key={v.title} className="ab-value-card">
                  <div className="ab-value-icon">{v.icon}</div>
                  <h3 className="ab-value-title">{v.title}</h3>
                  <p className="ab-value-desc">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Team ── */}
        <section className="ab-team" style={{ background: 'var(--cream)' }}>
          <div className="ab-container">
            <div className="ab-team-header">
              <p className="ab-section-kicker">The People Behind the Magic</p>
              <h2 className="ab-section-title">Meet Our Team</h2>
            </div>
            <div className="ab-team-grid">
              {TEAM.map(m => (
                <div key={m.name} className="ab-member">
                  <div className="ab-member-img-wrap">
                    <img
                      src={m.img}
                      alt={m.name}
                      className="ab-member-img"
                      loading="lazy"
                    />
                  </div>
                  <div className="ab-member-body">
                    <h3 className="ab-member-name">{m.name}</h3>
                    <p className="ab-member-role">{m.role}</p>
                    <p className="ab-member-bio">{m.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="ab-banner">
          <div className="ab-banner-orb ab-banner-orb-a" />
          <div className="ab-banner-orb ab-banner-orb-b" />
          <h2 className="ab-banner-title">
            Ready to <em>Glow?</em>
          </h2>
          <p className="ab-banner-sub">
            Book your appointment today and experience the Crown &amp; Glow difference for yourself.
          </p>
          <button className="ab-banner-btn" onClick={() => router.push('/booking')}>
            Book an Appointment
          </button>
        </section>

      </div>
    </>
  );
}

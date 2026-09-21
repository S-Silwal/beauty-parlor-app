// app/about/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { initSocket } from '@/lib/socket';

// Sourced live from the admin Staff Management panel (GET /api/staff) —
// the same isActive-gated roster the dashboard manages, not a separate
// hardcoded list. Only staff an admin has marked Active ("can provide
// services" / bookable) come back from that endpoint at all.
interface TeamMember {
  id: string;
  name: string;
  specialization?: string;
  bio?: string;
  avatar?: string;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');
}

// A quiet, optional line under the story — not a services grid or a new
// "why choose us" block, just what the salon does, named plainly.
const SERVICE_HIGHLIGHTS = ['Facials', 'Brows & Lashes', 'Waxing'];

export default function AboutPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await api.getTeam();
        if (res.success) setTeam(res.staff || []);
      } catch (e) {
        console.error('Failed to fetch team', e);
      } finally {
        setTeamLoaded(true);
      }
    };
    fetchTeam();

    // An admin saving a staff change (photo, bio, or active status) in the
    // dashboard should show up here immediately, for anyone already on
    // this page — same live data, not a manual refresh.
    const socket = initSocket();
    socket.on('staffUpdated', fetchTeam);
    return () => { socket.off('staffUpdated', fetchTeam); };
  }, []);

  return (
    <>
      <style>{`
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
          font-family: var(--font-ui), sans-serif;
          display:inline-block; font-size:11px; font-weight:600;
          letter-spacing:.22em; text-transform:uppercase;
          color:var(--gold-lt); margin-bottom:18px;
        }
        .ab-h1 {
          /* Plain roman — the gold-italic accent word lives on the
             homepage hero only, not repeated here. */
          font-family: var(--font-display), Georgia, serif;
          font-size:clamp(2.75rem,6vw,4.5rem); font-weight:400;
          letter-spacing:-0.01em;
          color:#F7F3EE; line-height:1.05; margin:0 0 24px;
        }
        .ab-hero-p {
          font-family: var(--font-body), sans-serif;
          font-size:17px; font-weight:400; color:#B0A89E;
          max-width:500px; margin:0 auto; line-height:1.85;
        }
        .ab-rule { width:36px;height:1px;background:var(--gold);margin:30px auto 0;opacity:.5; }

        /* ── Container ── */
        .ab-container { max-width:1100px; margin:0 auto; padding:0 24px; }

        /* ── Story section (single editorial column, no photo) ── */
        .ab-story-solo {
          padding: 110px 24px 70px;
          max-width: 680px;
          margin: 0 auto;
        }
        .ab-section-kicker {
          font-family: var(--font-ui), sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--gold); margin-bottom: 14px;
        }
        .ab-section-title {
          font-family: var(--font-display), Georgia, serif;
          font-size: clamp(1.75rem,3.5vw,2.75rem); font-weight: 500;
          letter-spacing: -0.005em;
          margin: 0 0 24px; line-height: 1.15;
        }
        .ab-story-text {
          font-family: var(--font-body), sans-serif;
          font-size: 17px; font-weight: 400; color: var(--mid);
          line-height: 1.9; margin-bottom: 20px;
        }
        .ab-cta {
          display: inline-block; margin-top: 36px;
          background: var(--charcoal); color: var(--cream);
          font-family: var(--font-ui), sans-serif; font-size: 12px;
          font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          padding: 15px 32px; border-radius: 2px; border: none;
          cursor: pointer;
          transition: background .22s, color .22s, transform .22s;
        }
        .ab-cta:hover {
          background: var(--gold); color: var(--charcoal);
          transform: translateY(-2px);
        }

        /* ── Services line (quiet row under the story) ── */
        .ab-services-line {
          font-family: var(--font-ui), sans-serif;
          max-width: 680px; margin: 0 auto;
          padding: 0 24px 90px;
          text-align: center;
          font-size: 12px; font-weight: 600;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--gold);
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
        .ab-member-img-wrap { position: relative; height: 280px; overflow: hidden; }
        .ab-member-img {
          object-fit: cover;
          transition: transform .5s ease;
        }
        /* Shown instead of a photo when a staff member has none uploaded yet. */
        .ab-member-img-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, var(--cream-md), var(--gold-lt));
          color: var(--charcoal);
          font-family: var(--font-display), Georgia, serif;
          font-size: 40px; font-weight: 500; letter-spacing: .04em;
        }
        .ab-member:hover .ab-member-img { transform: scale(1.05); }
        .ab-member-body { padding: 24px 26px 28px; }
        .ab-member-name {
          font-family: var(--font-display), Georgia, serif;
          font-size: 20px; font-weight: 400;
          line-height: 1.3;
          margin: 0 0 4px; color: var(--charcoal);
        }
        .ab-member-role {
          font-family: var(--font-ui), sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: .1em;
          text-transform: uppercase; color: var(--gold);
          margin-bottom: 14px;
        }
        .ab-member-bio {
          font-family: var(--font-body), sans-serif;
          font-size: 13px; font-weight: 400; color: var(--mid);
          line-height: 1.75;
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
          font-family: var(--font-display), Georgia, serif;
          font-size: clamp(1.75rem, 3.5vw, 2.75rem); font-weight: 500;
          letter-spacing: -0.005em;
          color: #F7F3EE; margin: 0 0 20px; line-height: 1.15;
          position: relative; z-index: 1;
        }
        .ab-banner-sub {
          font-family: var(--font-body), sans-serif;
          font-size: 16px; font-weight: 400; color: #A8A09A;
          max-width: 440px; margin: 0 auto 36px;
          line-height: 1.75; position: relative; z-index: 1;
        }
        .ab-banner-btn {
          position: relative; z-index: 1;
          background: var(--gold); color: var(--charcoal);
          font-family: var(--font-ui), sans-serif; font-size: 12px;
          font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          padding: 16px 40px; border-radius: 2px; border: none;
          cursor: pointer;
          transition: background .22s, transform .22s;
        }
        .ab-banner-btn:hover {
          background: var(--gold-lt); transform: translateY(-2px);
        }

        /* Responsive */
        @media (max-width: 900px) {
          .ab-story-solo { padding: 72px 24px 56px; }
          .ab-team-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .ab-hero { padding: 80px 20px 72px; }
          .ab-banner { padding: 64px 20px; }
          .ab-team-header { margin-bottom: 40px; }
          .ab-member-img-wrap { height: 240px; }
        }
      `}</style>

      <div className="ab">

        {/* ── Hero ── */}
        <section className="ab-hero">
          <div className="ab-orb ab-orb-a" />
          <div className="ab-orb ab-orb-b" />
          <p className="ab-eyebrow">Crown &amp; Glow · Indianapolis</p>
          <h1 className="ab-h1">About Us</h1>
          <p className="ab-hero-p">
            We are a team of passionate beauty artisans dedicated
            to making every client feel extraordinary.
          </p>
          <div className="ab-rule" />
        </section>

        {/* ── Our Story ── */}
        {/* A single centered editorial column — no photo, no stat bar, no
            two-column gap to fill. Just the label, headline, copy, and CTA. */}
        <section style={{ background: 'var(--cream)' }}>
          <div className="ab-container">
            <div className="ab-story-solo">
              <p className="ab-section-kicker">Our Story</p>
              <h2 className="ab-section-title">
                Beauty born from<br />passion & precision
              </h2>
              <p className="ab-story-text">
                Crown &amp; Glow is built on a simple belief: every person deserves
                to feel their most radiant self.
              </p>
              <p className="ab-story-text">
                In the heart of Indianapolis, we created a sanctuary where luxury
                beauty meets genuine human connection. Our expert therapists
                deliver precise treatments in a warm, welcoming space — using
                only the finest products and techniques.
              </p>
              <button className="ab-cta" onClick={() => router.push('/booking')}>
                Book Your Experience
              </button>
            </div>
          </div>
        </section>

        {/* ── Services line (quiet, optional) ── */}
        <section style={{ background: 'var(--cream)' }}>
          <p className="ab-services-line">
            {SERVICE_HIGHLIGHTS.join(' \u00B7 ')}
          </p>
        </section>

        {/* ── Team ── */}
        {/* Only rendered once we have a real answer, and only when there's
            at least one active (bookable) staff member to show — no
            hardcoded fallback names or photos. */}
        {teamLoaded && team.length > 0 && (
          <section className="ab-team" style={{ background: 'var(--cream)' }}>
            <div className="ab-container">
              <div className="ab-team-header">
                <p className="ab-section-kicker">The People Behind the Magic</p>
                <h2 className="ab-section-title">Meet Our Team</h2>
              </div>
              <div className="ab-team-grid">
                {team.map(m => (
                  <div key={m.id} className="ab-member">
                    <div className="ab-member-img-wrap">
                      {m.avatar ? (
                        <Image
                          src={m.avatar}
                          alt={m.name}
                          fill
                          sizes="(max-width: 700px) 50vw, 25vw"
                          className="ab-member-img"
                        />
                      ) : (
                        <div className="ab-member-img-placeholder" aria-hidden="true">
                          {initials(m.name)}
                        </div>
                      )}
                    </div>
                    <div className="ab-member-body">
                      <h3 className="ab-member-name">{m.name}</h3>
                      {m.specialization && <p className="ab-member-role">{m.specialization}</p>}
                      {m.bio && <p className="ab-member-bio">{m.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CTA Banner ── */}
        <section className="ab-banner">
          <div className="ab-banner-orb ab-banner-orb-a" />
          <div className="ab-banner-orb ab-banner-orb-b" />
          <h2 className="ab-banner-title">
            Ready to Glow?
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

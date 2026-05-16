// app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ── Slideshow images — beauty treatments ────────────────────────────────────
const SLIDES = [
  {
    url: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=1400&q=85',
    label: 'Eyebrow Threading',
  },
  {
    url: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1400&q=85',
    label: 'Eyebrow Waxing',
  },
  {
    url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1400&q=85',
    label: 'Leg Waxing',
  },
  {
    url: 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=1400&q=85',
    label: 'Arm Waxing',
  },
  {
    url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1400&q=85',
    label: 'Hand Care',
  },
];

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [slide,    setSlide]    = useState(0);
  const [prevSlide, setPrevSlide] = useState<number | null>(null);
  const [fading,   setFading]   = useState(false);

  const { login } = useAuth();
  const router    = useRouter();

  // Auto-advance slideshow every 2.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setPrevSlide(slide);
      setFading(true);
      setTimeout(() => {
        setSlide(s => (s + 1) % SLIDES.length);
        setFading(false);
        setPrevSlide(null);
      }, 700); // crossfade duration
    }, 2500);
    return () => clearInterval(timer);
  }, [slide]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Jost:wght@300;400;500;600;700&display=swap');

        .lg {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: 'Jost', sans-serif;
        }

        /* ── Left: Slideshow panel ── */
        .lg-visual {
          position: relative;
          overflow: hidden;
          background: #1a1510;
          min-height: 100vh;
        }

        /* Each slide image */
        .lg-slide {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 0.7s ease-in-out;
        }
        .lg-slide.visible  { opacity: 0.78; }
        .lg-slide.fading-out { opacity: 0; }

        /* Warm dark overlay */
        .lg-overlay {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(
            160deg,
            rgba(26,21,16,0.60) 0%,
            rgba(44,35,25,0.35) 55%,
            rgba(184,154,106,0.12) 100%
          );
        }

        /* Content over image */
        .lg-visual-body {
          position: absolute; inset: 0; z-index: 2;
          display: flex; flex-direction: column;
          justify-content: space-between;
          padding: 52px 56px;
        }

        .lg-visual-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 30px; font-weight: 500;
          color: #F7F3EE; letter-spacing: .01em;
        }
        .lg-visual-logo em { font-style: italic; color: #D4B896; }

        .lg-visual-bottom {}
        .lg-tagline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(34px, 3.8vw, 54px); font-weight: 300;
          color: #F7F3EE; line-height: 1.15; margin: 0 0 16px;
        }
        .lg-tagline em { font-style: italic; color: #D4B896; }
        .lg-visual-sub {
          font-size: 15px; font-weight: 300;
          color: #C8BFB4; line-height: 1.8;
          max-width: 340px; margin-bottom: 32px;
        }

        /* Slide label pill */
        .lg-slide-label {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(212,184,150,0.3);
          border-radius: 2px; padding: 8px 16px;
          font-size: 11px; font-weight: 600;
          letter-spacing: .14em; text-transform: uppercase;
          color: #D4B896; margin-bottom: 20px;
          transition: all .4s ease;
        }
        .lg-slide-label-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #D4B896; animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%,100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Dot indicators */
        .lg-dots {
          display: flex; gap: 7px; align-items: center;
        }
        .lg-dot {
          height: 5px; border-radius: 3px;
          background: rgba(212,184,150,0.35);
          transition: all .4s ease; cursor: pointer;
          border: none;
        }
        .lg-dot.on {
          width: 24px; background: #D4B896;
        }
        .lg-dot:not(.on) { width: 5px; }

        /* ── Right: Form panel ── */
        .lg-form-panel {
          background: #FDFAF6;
          display: flex; align-items: center; justify-content: center;
          padding: 64px 52px;
          position: relative;
        }
        .lg-form-panel::before {
          content: '';
          position: absolute; top: 0; left: 0;
          width: 1px; height: 100%;
          background: linear-gradient(to bottom,
            transparent, #EDE6DC 25%, #EDE6DC 75%, transparent);
        }

        .lg-form-box { width: 100%; max-width: 420px; }

        /* Form header */
        .lg-eyebrow {
          font-size: 11px; font-weight: 600; letter-spacing: .22em;
          text-transform: uppercase; color: #B89A6A; margin-bottom: 14px;
        }
        .lg-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 48px; font-weight: 400;
          color: #2C2825; margin: 0 0 8px; line-height: 1.0;
        }
        .lg-title em { font-style: italic; color: #B89A6A; }
        .lg-subtitle {
          font-size: 16px; font-weight: 300;
          color: #9E968E; margin-bottom: 44px; line-height: 1.65;
        }

        /* Error */
        .lg-error {
          background: #FEF2F2; border: 1px solid #FECACA;
          border-radius: 3px; padding: 13px 18px;
          font-size: 14px; color: #B91C1C;
          margin-bottom: 26px; line-height: 1.5;
        }

        /* Fields */
        .lg-field { margin-bottom: 22px; }
        .lg-label {
          display: block; font-size: 11px; font-weight: 600;
          letter-spacing: .14em; text-transform: uppercase;
          color: #6B635A; margin-bottom: 9px;
        }
        .lg-input-wrap { position: relative; }
        .lg-input {
          width: 100%; padding: 15px 18px;
          background: #FFFFFF; border: 1px solid #E8E0D6;
          border-radius: 3px;
          font-family: 'Jost', sans-serif;
          font-size: 15px; font-weight: 300; color: #2C2825;
          outline: none;
          transition: border-color .2s, box-shadow .2s;
          box-sizing: border-box;
        }
        .lg-input::placeholder { color: #C4BAB0; }
        .lg-input:focus {
          border-color: #B89A6A;
          box-shadow: 0 0 0 3px rgba(184,154,106,0.13);
        }
        .lg-input.padded { padding-right: 52px; }

        /* Toggle visibility */
        .lg-eye {
          position: absolute; right: 16px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #9E968E; padding: 4px;
          transition: color .2s; line-height: 0;
        }
        .lg-eye:hover { color: #B89A6A; }

        /* Forgot */
        .lg-forgot {
          display: block; text-align: right;
          font-size: 13px; color: #B89A6A;
          text-decoration: none;
          margin-top: -14px; margin-bottom: 30px;
          transition: color .2s;
        }
        .lg-forgot:hover { color: #2C2825; }

        /* Submit */
        .lg-submit {
          width: 100%; padding: 16px;
          background: #2C2825; color: #F7F3EE;
          border: none; border-radius: 3px; cursor: pointer;
          font-family: 'Jost', sans-serif;
          font-size: 12px; font-weight: 700;
          letter-spacing: .18em; text-transform: uppercase;
          transition: background .22s, transform .2s;
          margin-bottom: 28px;
        }
        .lg-submit:hover:not(:disabled) {
          background: #B89A6A; transform: translateY(-1px);
        }
        .lg-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Divider */
        .lg-divider {
          display: flex; align-items: center; gap: 16px;
          margin-bottom: 26px;
        }
        .lg-divider-line { flex: 1; height: 1px; background: #EDE6DC; }
        .lg-divider-text {
          font-size: 12px; color: #B8B0A8;
          letter-spacing: .06em; white-space: nowrap;
        }

        /* Register row */
        .lg-register-row {
          text-align: center;
          font-size: 15px; font-weight: 300; color: #9E968E;
        }
        .lg-register-link {
          color: #B89A6A; font-weight: 600;
          text-decoration: none; transition: color .2s;
        }
        .lg-register-link:hover { color: #2C2825; }

        /* Trust row */
        .lg-trust {
          display: flex; justify-content: center;
          gap: 24px; margin-top: 40px; padding-top: 30px;
          border-top: 1px solid #EDE6DC;
        }
        .lg-trust-item {
          display: flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 500; letter-spacing: .07em;
          text-transform: uppercase; color: #B8B0A8;
        }

        /* Mobile */
        @media (max-width: 800px) {
          .lg { grid-template-columns: 1fr; }
          .lg-visual { min-height: 260px; height: 260px; }
          .lg-visual-body { padding: 28px 28px; }
          .lg-visual-logo { font-size: 24px; }
          .lg-tagline { font-size: 26px; }
          .lg-form-panel { padding: 52px 28px; }
          .lg-form-panel::before { display: none; }
          .lg-title { font-size: 40px; }
        }
      `}</style>

      <div className="lg">

        {/* ── Left: Slideshow ── */}
        <div className="lg-visual" suppressHydrationWarning>

          {/* All slide images stacked, crossfade via opacity */}
          {SLIDES.map((s, i) => (
            <img
              key={s.url}
              src={s.url}
              alt={s.label}
              className={`lg-slide ${
                i === slide && !fading ? 'visible' :
                i === prevSlide && fading ? 'visible' :
                i === slide && fading ? '' :
                ''
              }`}
            />
          ))}

          <div className="lg-overlay" suppressHydrationWarning />

          /*<div className="lg-visual-body" suppressHydrationWarning>
            {/* Logo */}
            <div className="lg-visual-logo" suppressHydrationWarning>
               <em> </em>
            </div>*
            {/* Bottom content */}
            <div className="lg-visual-bottom">
              {/* Current treatment label */}
              <div className="lg-slide-label" suppressHydrationWarning>
                <span className="lg-slide-label-dot" />
                {SLIDES[slide].label}
              </div>

              <h2 className="lg-tagline">
                Where beauty<br />meets <em>ritual.</em>
              </h2>
              <p className="lg-visual-sub" suppressHydrationWarning>
                Premium beauty treatments crafted with precision,
                care, and artistry — for every version of you.
              </p>

              {/* Dot indicators */}
              <div className="lg-dots" suppressHydrationWarning>
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    className={`lg-dot${i === slide ? ' on' : ''}`}
                    onClick={() => setSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Form ── */}
        <div className="lg-form-panel"suppressHydrationWarning>
          <div className="lg-form-box"suppressHydrationWarning>

            <p className="lg-eyebrow">Crown &amp; Glow · Indianapolis</p>
            <h1 className="lg-title">Welcome <em>Back</em></h1>
            <p className="lg-subtitle">
              Sign in to manage your appointments and beauty journey.
            </p>

            {error && <div className="lg-error" suppressHydrationWarning>{error}</div>}

            <form onSubmit={handleSubmit}>

              {/* Email */}
              <div className="lg-field" suppressHydrationWarning>
                <label className="lg-label" htmlFor="lg-email">Email Address</label>
            <div className="lg-register-row" suppressHydrationWarning>
                <div className="lg-input-wrap" suppressHydrationWarning>
                  <input
                    id="lg-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    suppressHydrationWarning
                    className="lg-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              </div>

              {/* Password */}
              <div className="lg-field" suppressHydrationWarning>
                <label className="lg-label" htmlFor="lg-password">Password</label>
                <div className="lg-input-wrap" suppressHydrationWarning>
                  <input
                    id="lg-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    suppressHydrationWarning
                    className="lg-input padded"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="lg-eye"
                    onClick={() => setShowPass(p => !p)}
                    suppressHydrationWarning
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <a href="/forgot-password" className="lg-forgot">Forgot password?</a>

              <button
                type="submit"
                disabled={loading}
                className="lg-submit"
                suppressHydrationWarning
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="lg-divider" suppressHydrationWarning>
              <div className="lg-divider-line" suppressHydrationWarning />
              <span className="lg-divider-text">New to Crown &amp; Glow?</span>
              <div className="lg-divider-line" suppressHydrationWarning />
            </div>

            <div className="lg-register-row" suppressHydrationWarning>
              Don't have an account?&nbsp;
              <Link href="/register" className="lg-register-link">
                Create one →
              </Link>
            </div>

            <div className="lg-trust" suppressHydrationWarning>
              <div className="lg-trust-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Secure Login
              </div>
              <div className="lg-trust-item"suppressHydrationWarning>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Privacy Protected
              </div>
              <div className="lg-trust-item" suppressHydrationWarning>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Verified Salon
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

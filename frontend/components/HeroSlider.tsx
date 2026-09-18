// components/HeroSlider.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Shape returned by GET /api/hero-slides (see backend/src/services/heroSlide.service.ts).
export interface HeroSlide {
  id: string;
  imageUrl: string;
  title: string;
  titleAccent?: string | null;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

// Rendered only if the hero-slides API returns nothing (e.g. the backend is
// unreachable at request time, or an admin has deactivated every slide) —
// this is the exact copy the homepage always shipped with, so the hero
// never goes blank. Never hardcode an image URL anywhere else in this file.
const FALLBACK_SLIDE: HeroSlide = {
  id: 'fallback',
  imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1800&q=85',
  title: 'Where beauty',
  titleAccent: 'meets ritual.',
  description:
    'Premium beauty treatments crafted with precision, care, and artistry — for every version of you.',
  ctaLabel: 'Explore Services',
  ctaHref: '/services',
};

const AUTOPLAY_MS = 5000;

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const activeSlides = slides.length > 0 ? slides : [FALLBACK_SLIDE];
  const isStatic = activeSlides.length === 1;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (i: number) => setIndex(((i % activeSlides.length) + activeSlides.length) % activeSlides.length),
    [activeSlides.length]
  );
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Auto-advance — skipped for a single slide, while paused (hover/focus),
  // or when the visitor's OS asks for reduced motion.
  useEffect(() => {
    if (isStatic || paused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    timerRef.current = setInterval(() => setIndex(i => (i + 1) % activeSlides.length), AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStatic, paused, activeSlides.length]);

  // Left/right arrow keys move between slides — only wired up when there's
  // more than one slide to move between.
  useEffect(() => {
    if (isStatic) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isStatic, next, prev]);

  return (
    <section
      className="hm-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <style>{`
        .hm-hero {
          position: relative; overflow: hidden;
          /* Capped so the hero never balloons on tall/large monitors (was
             a bare 88vh, which on a 1440p+ display could render 1200px+
             tall) while still scaling down gracefully on short viewports. */
          min-height: 70vh;
          max-height: 760px;
        }
        .hm-hero-slide {
          position: absolute; inset: 0;
          display: flex; align-items: center;
          padding: 120px 24px 100px;
          background-size: cover; background-position: center;
          opacity: 0; z-index: 0; pointer-events: none;
          transition: opacity 1s ease;
        }
        .hm-hero-slide-active { opacity: 1; z-index: 1; pointer-events: auto; }
        .hm-hero-inner { max-width: 640px; position: relative; z-index: 1; }
        /* Small decorative mark signalling "start of content" without
           repeating the brand name (the Navbar already carries it). */
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

        /* ── Slider controls (only rendered for 2+ slides) ── */
        .hm-hero-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          z-index: 2; width: 44px; height: 44px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(20,16,12,.35); border: 1px solid rgba(247,243,238,.4);
          color: #F7F3EE; cursor: pointer; transition: background .2s ease;
        }
        .hm-hero-arrow:hover { background: rgba(20,16,12,.6); }
        .hm-hero-arrow svg { width: 18px; height: 18px; }
        .hm-hero-arrow-prev { left: 20px; }
        .hm-hero-arrow-next { right: 20px; }
        .hm-hero-dots {
          position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
          z-index: 2; display: flex; gap: 10px;
        }
        .hm-hero-dot {
          width: 8px; height: 8px; border-radius: 50%; padding: 0;
          background: rgba(247,243,238,.4); border: none; cursor: pointer;
          transition: background .2s ease, transform .2s ease;
        }
        .hm-hero-dot-active { background: var(--gold-lt); transform: scale(1.25); }

        @media (prefers-reduced-motion: reduce) {
          .hm-hero-slide { transition: none; }
        }
        @media (max-width: 480px) {
          /* Shorter on mobile too, so the hero doesn't push the rest of
             the page too far down the first scroll. */
          .hm-hero { min-height: 60vh; max-height: 600px; }
          .hm-hero-slide { padding: 96px 20px 80px; }
          .hm-hero-arrow { width: 36px; height: 36px; }
        }
      `}</style>

      {activeSlides.map((slide, i) => (
        <div
          key={slide.id}
          className={`hm-hero-slide${i === index ? ' hm-hero-slide-active' : ''}`}
          style={{
            backgroundImage: `linear-gradient(160deg, rgba(20,16,12,.72) 0%, rgba(44,35,25,.55) 55%, rgba(184,154,106,.28) 100%), url('${slide.imageUrl}')`,
          }}
          aria-hidden={i !== index}
        >
          <div className="hm-hero-inner">
            <span className="hm-hero-rule" aria-hidden="true" />
            <h1 className="hm-h1">
              {slide.title}
              {slide.titleAccent ? (
                <>
                  <br />
                  <em>{slide.titleAccent}</em>
                </>
              ) : null}
            </h1>
            <p className="hm-hero-p">{slide.description}</p>
            <div className="hm-hero-actions">
              <Link href={slide.ctaHref} className="hm-hero-cta">
                {slide.ctaLabel}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      ))}

      {!isStatic && (
        <>
          <button className="hm-hero-arrow hm-hero-arrow-prev" onClick={prev} aria-label="Previous slide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="hm-hero-arrow hm-hero-arrow-next" onClick={next} aria-label="Next slide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="hm-hero-dots" role="tablist" aria-label="Hero slides">
            {activeSlides.map((slide, i) => (
              <button
                key={slide.id}
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}`}
                className={`hm-hero-dot${i === index ? ' hm-hero-dot-active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

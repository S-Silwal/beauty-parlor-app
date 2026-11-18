'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Image from 'next/image';
import localFont from 'next/font/local';

// Gallery-only type pairing: high-contrast serif for headings, clean sans for
// labels and captions. Self-hosted like the sitewide fonts in layout.tsx
// (files + OFL licenses in app/fonts).
const galleryDisplay = localFont({
  src: [
    { path: '../fonts/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--gl-font-display',
  display: 'swap',
});
const gallerySans = localFont({
  src: [
    { path: '../fonts/dm-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/dm-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/dm-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--gl-font-sans',
  display: 'swap',
});

// Gallery palette
const GL_BG     = '#231718'; // deep espresso/plum
const GL_ACCENT = '#E8C6B0'; // warm champagne
const GL_LIGHT  = '#F5DFD0'; // peach-beige

interface GalleryImage {
  id: string;
  url: string;
  alt_text: string;
  category: string;
  created_at: string;
}

// ✅ Exactly 5 tabs — keys must match what your backend stores in category field
const TABS = [
  { key: 'All',          label: 'All' },
  { key: 'brows_lashes', label: 'Brows & Lashes' },
  { key: 'waxing',       label: 'Waxing' },
  { key: 'facials',      label: 'Facials' },
  { key: 'before_after', label: 'Before & After' },
];

export default function GalleryPage() {
  const [images, setImages]                   = useState<GalleryImage[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedImage, setSelectedImage]     = useState<GalleryImage | null>(null);
  const [activeCategory, setActiveCategory]   = useState('All');
  const [animating, setAnimating]             = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getGallery();
        if (res.success) setImages(res.images || []);
      } catch (e) {
        console.error('Failed to fetch gallery', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredImages = activeCategory === 'All'
    ? images
    : images.filter(i => i.category === activeCategory);

  // Close on Escape, navigate with arrow keys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedImage(null); return; }
      if (!selectedImage) return;
      const idx = filteredImages.findIndex(i => i.id === selectedImage.id);
      if (e.key === 'ArrowRight' && idx < filteredImages.length - 1) setSelectedImage(filteredImages[idx + 1]);
      if (e.key === 'ArrowLeft'  && idx > 0)                          setSelectedImage(filteredImages[idx - 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedImage, filteredImages]);

  const handleTab = (key: string) => {
    if (key === activeCategory) return;
    setAnimating(true);
    setTimeout(() => { setActiveCategory(key); setAnimating(false); }, 180);
  };

  const currentLabel = TABS.find(t => t.key === activeCategory)?.label ?? 'All';

  return (
    <div className={`${galleryDisplay.variable} ${gallerySans.variable}`} style={{ minHeight: '100vh', background: GL_BG, fontFamily: 'var(--gl-font-sans), sans-serif' }}>
      <style>{`
        /* ── Pill tab bar ── */
        .gl-tabbar {
          position: sticky; top: 72px; z-index: 30;
          background: #231718;
          border-bottom: 1px solid rgba(232,198,176,.14);
          box-shadow: 0 2px 12px rgba(0,0,0,.25);
        }
        @media (max-width: 480px) {
          .gl-tabbar { top: 64px; }
        }
        .gl-tabbar-inner {
          max-width: 1200px; margin: 0 auto;
          padding: 16px 24px;
          display: flex; gap: 10px;
          overflow-x: auto; scrollbar-width: none;
          flex-wrap: wrap;
        }
        .gl-tabbar-inner::-webkit-scrollbar { display: none; }

        .gl-tab {
          flex-shrink: 0; cursor: pointer;
          padding: 9px 20px; border-radius: 999px;
          border: 1.5px solid #F5DFD0;
          background: #F5DFD0;
          display: flex; align-items: center; gap: 8px;
          transition: all .2s ease;
          font-family: var(--gl-font-sans), sans-serif;
        }
        .gl-tab:hover { border-color: #E8C6B0; background: #E8C6B0; }
        .gl-tab.active {
          background: #E8C6B0; border-color: #E8C6B0;
          box-shadow: 0 0 0 2px #231718, 0 0 0 3.5px #E8C6B0;
        }
        .gl-tab.active:hover { background: #F5DFD0; border-color: #F5DFD0; }

        .gl-tab-label {
          font-size: 13px; font-weight: 500;
          color: #231718; white-space: nowrap; transition: color .2s;
        }
        .gl-tab.active .gl-tab-label { color: #231718; font-weight: 600; }

        .gl-tab-count {
          font-size: 11px; font-weight: 700;
          background: rgba(35,23,24,.10); color: #5A4142;
          padding: 2px 8px; border-radius: 999px;
          transition: all .2s; min-width: 22px; text-align: center;
        }
        .gl-tab.active .gl-tab-count {
          background: #231718; color: #F5DFD0;
        }

        /* ── Masonry ── */
        .gl-masonry {
          columns: 3; column-gap: 20px;
          transition: opacity .18s ease;
        }
        .gl-masonry.fade { opacity: 0; }
        .gl-masonry-item { break-inside: avoid; margin-bottom: 20px; }
        @media (max-width: 900px) { .gl-masonry { columns: 2; } }
        @media (max-width: 520px) { .gl-masonry { columns: 1; } }

        /* ── Card ── */
        .gl-card {
          position: relative; overflow: hidden;
          border-radius: 16px; cursor: pointer;
          border: 1px solid rgba(232,198,176,.18); background: #2E2021;
        }
        .gl-card-img {
          width: 100%; height: auto; display: block;
          transition: transform .5s ease;
        }
        .gl-card:hover .gl-card-img { transform: scale(1.05); }
        .gl-card-overlay {
          position: absolute; inset: 0;
          background: rgba(35,23,24,0);
          transition: background .25s;
          display: flex; flex-direction: column;
          justify-content: flex-end; padding: 18px;
        }
        .gl-card:hover .gl-card-overlay { background: rgba(35,23,24,0.58); }
        .gl-card-text {
          opacity: 0; transform: translateY(6px);
          transition: opacity .22s, transform .22s;
          font-size: 13px; font-weight: 400;
          color: #F5DFD0; letter-spacing: .04em;
        }
        .gl-card:hover .gl-card-text { opacity: 1; transform: translateY(0); }
        .gl-badge {
          position: absolute; top: 12px; left: 12px;
          background: rgba(35,23,24,.85); color: #E8C6B0;
          font-size: 9px; font-weight: 700; letter-spacing: .16em;
          text-transform: uppercase; padding: 4px 10px; border-radius: 999px;
          backdrop-filter: blur(4px);
        }

        /* ── Lightbox ── */
        .gl-lightbox {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(26,16,17,.95);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; animation: gl-fadein .2s ease;
        }
        @keyframes gl-fadein { from{opacity:0} to{opacity:1} }
        .gl-lightbox-inner { position: relative; max-width: 900px; width: 100%; }
        .gl-lb-close {
          position: absolute; top: -44px; right: 0;
          background: none; border: 1px solid rgba(232,198,176,.35);
          color: #F5DFD0; border-radius: 50%;
          width: 34px; height: 34px; font-size: 16px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: border-color .2s, color .2s;
          z-index: 2;
        }
        .gl-lb-close:hover { border-color: #E8C6B0; color: #E8C6B0; }
        .gl-lb-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(35,23,24,.6); border: 1px solid rgba(232,198,176,.25);
          color: #F5DFD0; border-radius: 50%;
          width: 40px; height: 40px; font-size: 22px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background .2s, border-color .2s; backdrop-filter: blur(4px);
        }
        .gl-lb-arrow:hover { background: rgba(232,198,176,.35); border-color: #E8C6B0; }
        .gl-lb-arrow.prev { left: -56px; }
        .gl-lb-arrow.next { right: -56px; }

        /* Skeleton shimmer */
        .gl-skel {
          border-radius: 16px;
          background: linear-gradient(90deg, #2E2021 25%, #3B2A2B 50%, #2E2021 75%);
          background-size: 200% 100%;
          animation: gl-shimmer 1.4s infinite;
        }
        @keyframes gl-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        @media (max-width: 640px) {
          .gl-lb-arrow { display: none; }
          /* Filters wrap onto multiple rows on mobile instead of forcing a
             horizontal-scroll chip row — every category stays visible at
             once. (.gl-tabbar-inner already sets flex-wrap: wrap by default;
             this breakpoint used to override it back to nowrap.) */
          .gl-tabbar-inner { justify-content: center; }
          .gl-lightbox { padding: 16px; }
          /* Above the image on mobile, above the -44px offset would push
             partway off-screen with only 16px of padding, so it sits
             inside the top-right corner of the image instead. */
          .gl-lb-close {
            top: 8px; right: 8px;
            background: rgba(26,16,17,.55); backdrop-filter: blur(4px);
          }
        }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        background: '#1C1213', padding: '80px 24px 72px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', width:480, height:480, borderRadius:'50%', background:GL_ACCENT, filter:'blur(90px)', opacity:.12, top:-160, right:-100, pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:280, height:280, borderRadius:'50%', background:GL_LIGHT, filter:'blur(80px)', opacity:.08, bottom:-80, left:-60, pointerEvents:'none' }} />
        <p style={{ fontFamily:'var(--gl-font-sans), sans-serif', fontSize:11, fontWeight:600, letterSpacing:'.22em', textTransform:'uppercase', color:GL_ACCENT, marginBottom:16, position:'relative' }}>
          Crown &amp; Glow · Indianapolis
        </p>
        <h1 style={{ fontFamily:'var(--gl-font-display), Georgia, serif', fontSize:'clamp(3rem,6.5vw,5rem)', fontWeight:500, letterSpacing:'-0.01em', color:GL_LIGHT, lineHeight:1.05, margin:'0 0 20px', position:'relative' }}>
          Our Gallery
        </h1>
        <p style={{ fontFamily:'var(--gl-font-sans), sans-serif', fontSize:16, fontWeight:400, color:'rgba(245,223,208,.72)', maxWidth:440, margin:'0 auto', lineHeight:1.85, position:'relative' }}>
          Real transformations. Real results. Real beauty.
        </p>
        <div style={{ width:36, height:1, background:GL_ACCENT, margin:'28px auto 0', opacity:.6 }} />
      </div>

      {/* ── 5 Pill tabs ── */}
      <nav className="gl-tabbar">
        <div className="gl-tabbar-inner">
          {TABS.map(tab => {
            const count = tab.key === 'All'
              ? images.length
              : images.filter(i => i.category === tab.key).length;
            return (
              <button
                key={tab.key}
                className={`gl-tab${activeCategory === tab.key ? ' active' : ''}`}
                onClick={() => handleTab(tab.key)}
              >
                <span className="gl-tab-label">{tab.label}</span>
                <span className="gl-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '52px 24px 100px' }}>

        {/* Section header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontFamily:'var(--gl-font-sans), sans-serif', fontSize:11, fontWeight:600, letterSpacing:'.2em', textTransform:'uppercase', color:GL_ACCENT, marginBottom:10 }}>
            Crown &amp; Glow
          </p>
          <h2 style={{ fontFamily:'var(--gl-font-display), Georgia, serif', fontSize:'clamp(1.75rem,3.4vw,2.6rem)', fontWeight:600, letterSpacing:'-0.005em', color:GL_LIGHT, margin:'0 0 8px', lineHeight:1.15 }}>
            {currentLabel}
          </h2>
          {!loading && (
            <p style={{ fontFamily:'var(--gl-font-sans), sans-serif', fontSize:12, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(245,223,208,.6)' }}>
              {filteredImages.length} {filteredImages.length === 1 ? 'photo' : 'photos'}
            </p>
          )}
        </div>

        {/* Skeletons */}
        {loading && (
          <div className="gl-masonry">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="gl-masonry-item">
                <div className="gl-skel" style={{ height: i % 3 === 0 ? 320 : i % 2 === 0 ? 240 : 280 }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filteredImages.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 24px' }}>
            <p style={{ fontFamily:'var(--gl-font-display), Georgia, serif', fontSize:28, fontWeight:500, color:GL_LIGHT, marginBottom:10 }}>
              No photos yet
            </p>
            <p style={{ fontSize:14, color:'rgba(245,223,208,.6)' }}>
              Check back soon — we&apos;re adding new images regularly.
            </p>
          </div>
        )}

        {/* Masonry grid */}
        {!loading && filteredImages.length > 0 && (
          <div className={`gl-masonry${animating ? ' fade' : ''}`}>
            {filteredImages.map((image, i) => (
              <div key={image.id} className="gl-masonry-item" onClick={() => setSelectedImage(image)}>
                <div className="gl-card">
                  {image.category === 'before_after' && (
                    <span className="gl-badge">Before &amp; After</span>
                  )}
                  <Image
                    src={image.url}
                    alt={image.alt_text || 'Crown & Glow'}
                    width={600}
                    height={i % 3 === 0 ? 800 : i % 2 === 0 ? 600 : 700}
                    className="gl-card-img"
                    style={{ objectFit: 'cover' }}
                  />
                  <div className="gl-card-overlay">
                    <p className="gl-card-text">{image.alt_text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {selectedImage && (
        <div className="gl-lightbox" onClick={() => setSelectedImage(null)}>
          <div className="gl-lightbox-inner" onClick={e => e.stopPropagation()}>
            <button className="gl-lb-close" onClick={() => setSelectedImage(null)}>✕</button>

            {filteredImages.findIndex(i => i.id === selectedImage.id) > 0 && (
              <button className="gl-lb-arrow prev" onClick={() => {
                const idx = filteredImages.findIndex(i => i.id === selectedImage.id);
                setSelectedImage(filteredImages[idx - 1]);
              }}>‹</button>
            )}
            {filteredImages.findIndex(i => i.id === selectedImage.id) < filteredImages.length - 1 && (
              <button className="gl-lb-arrow next" onClick={() => {
                const idx = filteredImages.findIndex(i => i.id === selectedImage.id);
                setSelectedImage(filteredImages[idx + 1]);
              }}>›</button>
            )}

            <div style={{ borderRadius: 16, overflow: 'hidden', lineHeight: 0 }}>
              <Image
                src={selectedImage.url}
                alt={selectedImage.alt_text || 'Gallery'}
                width={1200}
                height={800}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            {selectedImage.alt_text && (
              <div style={{ marginTop:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <p style={{ color:GL_LIGHT, fontSize:14, fontWeight:400, letterSpacing:'.04em', margin:0 }}>
                  {selectedImage.alt_text}
                </p>
                <span style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:GL_ACCENT, fontWeight:600, flexShrink:0 }}>
                  {TABS.find(t => t.key === selectedImage.category)?.label ?? selectedImage.category}
                </span>
              </div>
            )}

            <p style={{ marginTop:10, textAlign:'center', fontSize:11, color:'rgba(245,223,208,.55)', letterSpacing:'.1em' }}>
              {filteredImages.findIndex(i => i.id === selectedImage.id) + 1} / {filteredImages.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Image from 'next/image';

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
  }, [selectedImage, images, activeCategory]);

  const filteredImages = activeCategory === 'All'
    ? images
    : images.filter(i => i.category === activeCategory);

  const handleTab = (key: string) => {
    if (key === activeCategory) return;
    setAnimating(true);
    setTimeout(() => { setActiveCategory(key); setAnimating(false); }, 180);
  };

  const currentLabel = TABS.find(t => t.key === activeCategory)?.label ?? 'All';

  return (
    <div style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: "'Jost', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');

        /* ── Pill tab bar ── */
        .gl-tabbar {
          position: sticky; top: 72px; z-index: 30;
          background: #fff;
          border-bottom: 1px solid #EDE6DC;
          box-shadow: 0 2px 12px rgba(44,40,37,.05);
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
          border: 1.5px solid #EDE6DC;
          background: #fff;
          display: flex; align-items: center; gap: 8px;
          transition: all .2s ease;
          font-family: 'Jost', sans-serif;
        }
        .gl-tab:hover { border-color: #B89A6A; background: #FDFAF6; }
        .gl-tab.active { background: #2C2825; border-color: #2C2825; }
        .gl-tab.active:hover { background: #B89A6A; border-color: #B89A6A; }

        .gl-tab-label {
          font-size: 13px; font-weight: 500;
          color: #6B635A; white-space: nowrap; transition: color .2s;
        }
        .gl-tab.active .gl-tab-label { color: #F7F3EE; }

        .gl-tab-count {
          font-size: 11px; font-weight: 700;
          background: #EDE6DC; color: #9E968E;
          padding: 2px 8px; border-radius: 999px;
          transition: all .2s; min-width: 22px; text-align: center;
        }
        .gl-tab.active .gl-tab-count {
          background: rgba(255,255,255,0.18); color: #F7F3EE;
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
          border-radius: 4px; cursor: pointer;
          border: 1px solid #EDE6DC; background: #EDE6DC;
        }
        .gl-card-img {
          width: 100%; height: auto; display: block;
          transition: transform .5s ease;
        }
        .gl-card:hover .gl-card-img { transform: scale(1.05); }
        .gl-card-overlay {
          position: absolute; inset: 0;
          background: rgba(44,40,37,0);
          transition: background .25s;
          display: flex; flex-direction: column;
          justify-content: flex-end; padding: 18px;
        }
        .gl-card:hover .gl-card-overlay { background: rgba(44,40,37,0.52); }
        .gl-card-text {
          opacity: 0; transform: translateY(6px);
          transition: opacity .22s, transform .22s;
          font-size: 13px; font-weight: 300;
          color: #F7F3EE; letter-spacing: .04em;
        }
        .gl-card:hover .gl-card-text { opacity: 1; transform: translateY(0); }
        .gl-badge {
          position: absolute; top: 12px; left: 12px;
          background: rgba(44,40,37,.82); color: #D4B896;
          font-size: 9px; font-weight: 700; letter-spacing: .16em;
          text-transform: uppercase; padding: 4px 10px; border-radius: 2px;
          backdrop-filter: blur(4px);
        }

        /* ── Lightbox ── */
        .gl-lightbox {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(20,16,12,.94);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; animation: gl-fadein .2s ease;
        }
        @keyframes gl-fadein { from{opacity:0} to{opacity:1} }
        .gl-lightbox-inner { position: relative; max-width: 900px; width: 100%; }
        .gl-lb-close {
          position: absolute; top: -44px; right: 0;
          background: none; border: 1px solid rgba(212,184,150,.3);
          color: #F7F3EE; border-radius: 50%;
          width: 34px; height: 34px; font-size: 16px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: border-color .2s, color .2s;
        }
        .gl-lb-close:hover { border-color: #B89A6A; color: #D4B896; }
        .gl-lb-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(44,40,37,.6); border: 1px solid rgba(212,184,150,.2);
          color: #F7F3EE; border-radius: 50%;
          width: 40px; height: 40px; font-size: 22px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background .2s, border-color .2s; backdrop-filter: blur(4px);
        }
        .gl-lb-arrow:hover { background: rgba(184,154,106,.5); border-color: #B89A6A; }
        .gl-lb-arrow.prev { left: -56px; }
        .gl-lb-arrow.next { right: -56px; }

        /* Skeleton shimmer */
        .gl-skel {
          border-radius: 4px;
          background: linear-gradient(90deg, #EDE6DC 25%, #F7F3EE 50%, #EDE6DC 75%);
          background-size: 200% 100%;
          animation: gl-shimmer 1.4s infinite;
        }
        @keyframes gl-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        @media (max-width: 640px) {
          .gl-lb-arrow { display: none; }
          .gl-tabbar-inner { flex-wrap: nowrap; }
        }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        background: '#2C2825', padding: '80px 24px 72px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', width:480, height:480, borderRadius:'50%', background:'#B89A6A', filter:'blur(90px)', opacity:.12, top:-160, right:-100, pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:280, height:280, borderRadius:'50%', background:'#c09060', filter:'blur(80px)', opacity:.10, bottom:-80, left:-60, pointerEvents:'none' }} />
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:'.22em', textTransform:'uppercase', color:'#D4B896', marginBottom:16, position:'relative' }}>
          Crown &amp; Glow · Indianapolis
        </p>
        <h1 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'clamp(48px,8vw,88px)', fontWeight:300, color:'#F7F3EE', lineHeight:1.0, margin:'0 0 20px', position:'relative' }}>
          Our <em style={{ fontStyle:'italic', color:'#D4B896' }}>Gallery</em>
        </h1>
        <p style={{ fontSize:16, fontWeight:300, color:'#A8A09A', maxWidth:440, margin:'0 auto', lineHeight:1.85, position:'relative' }}>
          Real transformations. Real results. Real beauty.
        </p>
        <div style={{ width:36, height:1, background:'#B89A6A', margin:'28px auto 0', opacity:.5 }} />
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
          <p style={{ fontSize:11, fontWeight:600, letterSpacing:'.2em', textTransform:'uppercase', color:'#B89A6A', marginBottom:10 }}>
            Crown &amp; Glow
          </p>
          <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'clamp(28px,4vw,42px)', fontWeight:400, color:'#2C2825', margin:'0 0 8px', lineHeight:1.1 }}>
            {currentLabel}
          </h2>
          {!loading && (
            <p style={{ fontSize:12, letterSpacing:'.1em', textTransform:'uppercase', color:'#9E968E' }}>
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
            <p style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:32, fontWeight:300, color:'#6B635A', marginBottom:10 }}>
              No photos yet
            </p>
            <p style={{ fontSize:14, color:'#9E968E' }}>
              Check back soon — we're adding new images regularly.
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

            <div style={{ borderRadius: 4, overflow: 'hidden', lineHeight: 0 }}>
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
                <p style={{ color:'#F7F3EE', fontSize:14, fontWeight:300, letterSpacing:'.04em', margin:0 }}>
                  {selectedImage.alt_text}
                </p>
                <span style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'#D4B896', fontWeight:600, flexShrink:0 }}>
                  {TABS.find(t => t.key === selectedImage.category)?.label ?? selectedImage.category}
                </span>
              </div>
            )}

            <p style={{ marginTop:10, textAlign:'center', fontSize:11, color:'#6B635A', letterSpacing:'.1em' }}>
              {filteredImages.findIndex(i => i.id === selectedImage.id) + 1} / {filteredImages.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

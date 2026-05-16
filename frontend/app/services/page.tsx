// app/services/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  isActive: boolean;
  is_popular?: boolean;
}

// ✅ Keys match Prisma ServiceCategory enum EXACTLY
const TABS = [
  { key: 'All',              label: 'All Services' },
  { key: 'EYEBROW_LASH',    label: 'Eyebrow & Lash' },
  { key: 'WAXING',          label: 'Waxing' },
  { key: 'FACIAL_SKINCARE', label: 'Facial' },
];

const IMAGE_MAP: { keywords: string[]; url: string }[] = [
  { keywords: ['eyebrow lamin'],                        url: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80' },
  { keywords: ['eyebrow shap', 'thread'],               url: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=600&q=80' },
  { keywords: ['eyelash ext', 'lash ext'],              url: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=600&q=80' },
  { keywords: ['eyelash lift', 'lash lift', 'lift & tint'], url: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=600&q=80' },
  { keywords: ['full body wax'],                        url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80' },
  { keywords: ['brazilian'],                            url: 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=600&q=80' },
  { keywords: ['full face wax', 'face wax'],            url: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600&q=80' },
  { keywords: ['wax'],                                  url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80' },
  { keywords: ['classic facial'],                       url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=80' },
  { keywords: ['anti-age', 'anti age', 'ageing'],       url: 'https://images.unsplash.com/photo-1552693673-1bf958298935?w=600&q=80' },
  { keywords: ['glow', 'hydrat'],                       url: 'https://images.unsplash.com/photo-1599407383981-35a45f27e1e9?w=600&q=80' },
  { keywords: ['facial', 'skin'],                       url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=80' },
];

const CATEGORY_FALLBACK: Record<string, string> = {
  EYEBROW_LASH:    'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=600&q=80',
  WAXING:          'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80',
  FACIAL_SKINCARE: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=80',
};
const FALLBACK = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80';

function getImage(name: string, category: string): string {
  const n = name.toLowerCase();
  for (const e of IMAGE_MAP) {
    if (e.keywords.some(k => n.includes(k))) return e.url;
  }
  return CATEGORY_FALLBACK[category] ?? FALLBACK;
}

function isSignature(s: Service) {
  return s.is_popular ||
    ['classic', 'signature', 'full body', 'anti-age', 'eyelash extension']
      .some(k => s.name.toLowerCase().includes(k));
}

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices]   = useState<Service[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getServices();
        if (res.success) setServices(res.services || []);
      } catch (e) {
        console.error('Failed to fetch services', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Filter by exact category key
  const filtered = activeTab === 'All'
    ? services
    : services.filter(s => s.category === activeTab);

  const handleTab = (key: string) => {
    if (key === activeTab) return;
    setAnimating(true);
    setTimeout(() => { setActiveTab(key); setAnimating(false); }, 180);
  };

  const currentTab = TABS.find(t => t.key === activeTab) ?? TABS[0];

  return (
    <div style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: "'Jost', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');

        /* ── Pill tab bar ── */
        .sv-tabbar {
          background: #fff;
          border-bottom: 1px solid #EDE6DC;
          box-shadow: 0 2px 12px rgba(44,40,37,.06);
          position: sticky; top: 72px; z-index: 30;
        }
        .sv-tabbar-inner {
          max-width: 1200px; margin: 0 auto;
          padding: 16px 24px;
          display: flex; gap: 10px;
          overflow-x: auto; scrollbar-width: none;
          flex-wrap: wrap;
        }
        .sv-tabbar-inner::-webkit-scrollbar { display: none; }

        /* ✅ Pill shape — like the screenshot */
        .sv-tab {
          flex-shrink: 0; cursor: pointer;
          padding: 10px 22px; border-radius: 999px;
          border: 1.5px solid #EDE6DC;
          background: #fff;
          display: flex; align-items: center; gap: 8px;
          transition: all .2s ease;
        }
        .sv-tab:hover {
          border-color: #B89A6A;
          background: #FDFAF6;
        }
        .sv-tab.active {
          background: #2C2825;
          border-color: #2C2825;
        }
        .sv-tab.active:hover { background: #B89A6A; border-color: #B89A6A; }

        .sv-tab-label {
          font-family: 'Jost', sans-serif;
          font-size: 13px; font-weight: 500;
          color: #6B635A; white-space: nowrap;
          transition: color .2s;
        }
        .sv-tab.active .sv-tab-label { color: #F7F3EE; }

        .sv-tab-count {
          font-size: 11px; font-weight: 700;
          background: #EDE6DC; color: #9E968E;
          padding: 2px 8px; border-radius: 999px;
          transition: all .2s;
          min-width: 22px; text-align: center;
        }
        .sv-tab.active .sv-tab-count {
          background: rgba(255,255,255,0.2);
          color: #F7F3EE;
        }

        /* ── Body ── */
        .sv-body { max-width: 1200px; margin: 0 auto; padding: 52px 24px 100px; }

        .sv-header { margin-bottom: 44px; }
        .sv-kicker {
          font-size: 11px; font-weight: 600; letter-spacing: .2em;
          text-transform: uppercase; color: #B89A6A; margin-bottom: 10px;
        }
        .sv-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(30px, 4vw, 46px); font-weight: 400;
          color: #2C2825; margin: 0 0 12px; line-height: 1.1;
        }
        .sv-count {
          font-size: 12px; letter-spacing: .1em;
          text-transform: uppercase; color: #9E968E;
        }

        /* ── Grid ── */
        .sv-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
          gap: 28px;
          transition: opacity .18s ease, transform .18s ease;
        }
        .sv-grid.fade { opacity: 0; transform: translateY(8px); }

        /* ── Card ── */
        .sv-card {
          background: #FDFAF6; border: 1px solid #EDE6DC;
          border-radius: 6px; overflow: hidden; position: relative;
          transition: box-shadow .3s, transform .3s, border-color .3s;
        }
        .sv-card:hover {
          box-shadow: 0 20px 56px rgba(44,40,37,.11);
          transform: translateY(-5px); border-color: #D4B896;
        }

        .sv-badge {
          position: absolute; top: 14px; right: 14px; z-index: 2;
          background: rgba(44,40,37,.85); color: #D4B896;
          font-size: 9px; font-weight: 700; letter-spacing: .16em;
          text-transform: uppercase; padding: 5px 11px; border-radius: 2px;
          backdrop-filter: blur(4px);
        }

        .sv-img-wrap { height: 210px; overflow: hidden; position: relative; }
        .sv-img-overlay {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(to bottom, transparent 50%, rgba(44,40,37,.25) 100%);
        }
        .sv-img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          transition: transform .5s ease;
        }
        .sv-card:hover .sv-img { transform: scale(1.06); }

        .sv-card-body { padding: 24px 24px 22px; }
        .sv-card-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 21px; font-weight: 500;
          color: #2C2825; margin: 0 0 9px; line-height: 1.2;
        }
        .sv-card-desc {
          font-size: 14px; font-weight: 300; color: #6B635A;
          line-height: 1.75; margin: 0 0 20px;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .sv-card-foot {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 16px; border-top: 1px solid #EDE6DC;
        }
        .sv-card-meta { display: flex; flex-direction: column; gap: 4px; }
        .sv-duration {
          font-size: 11px; letter-spacing: .08em;
          text-transform: uppercase; color: #9E968E;
        }
        .sv-price {
          font-family: 'Cormorant Garamond', serif;
          font-size: 27px; font-weight: 500; color: #2C2825; line-height: 1;
        }
        .sv-price-sym {
          font-size: 13px; font-weight: 400; color: #B89A6A;
          vertical-align: super; margin-right: 1px;
        }
        .sv-book {
          border: none; cursor: pointer;
          background: #2C2825; color: #F7F3EE;
          font-family: 'Jost', sans-serif; font-size: 11px;
          font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
          padding: 12px 20px; border-radius: 2px;
          transition: background .22s, transform .2s; white-space: nowrap;
        }
        .sv-book:hover { background: #B89A6A; transform: translateY(-1px); }

        /* Empty */
        .sv-empty { grid-column: 1/-1; text-align: center; padding: 80px 24px; }
        .sv-empty-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 30px; font-weight: 300; color: #6B635A; margin-bottom: 10px;
        }
        .sv-empty-sub { font-size: 14px; color: #9E968E; }

        /* Skeleton */
        .sv-skel { background: #FDFAF6; border: 1px solid #EDE6DC; border-radius: 6px; overflow: hidden; }
        .sv-skel-img { height: 210px; }
        .sv-skel-body { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
        .sv-skel-line { height: 13px; border-radius: 3px; }
        .shimmer {
          background: linear-gradient(90deg, #EDE6DC 25%, #F7F3EE 50%, #EDE6DC 75%);
          background-size: 200% 100%; animation: sv-shimmer 1.4s infinite;
        }
        @keyframes sv-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        @media (max-width: 640px) {
          .sv-tabbar-inner { flex-wrap: nowrap; }
          .sv-body { padding: 32px 16px 72px; }
          .sv-grid { grid-template-columns: 1fr; gap: 20px; }
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
          Our <em style={{ fontStyle:'italic', color:'#D4B896' }}>Services</em>
        </h1>
        <p style={{ fontSize:16, fontWeight:300, color:'#A8A09A', maxWidth:440, margin:'0 auto', lineHeight:1.85, position:'relative' }}>
          Premium beauty rituals crafted with precision, care, and artistry — for every version of you.
        </p>
        <div style={{ width:36, height:1, background:'#B89A6A', margin:'28px auto 0', opacity:.5 }} />
      </div>

      {/* ── Pill Tab bar ── */}
      <nav className="sv-tabbar">
        <div className="sv-tabbar-inner">
          {TABS.map(tab => {
            const count = tab.key === 'All'
              ? services.length
              : services.filter(s => s.category === tab.key).length;
            return (
              <button
                key={tab.key}
                className={`sv-tab${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => handleTab(tab.key)}
              >
                <span className="sv-tab-label">{tab.label}</span>
                <span className="sv-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="sv-body">

        {/* Section header */}
        <div className="sv-header">
          <p className="sv-kicker">Crown &amp; Glow</p>
          <h2 className="sv-title">{currentTab.label}</h2>
          {!loading && (
            <p className="sv-count">
              {filtered.length} {filtered.length === 1 ? 'treatment' : 'treatments'} available
            </p>
          )}
        </div>

        {/* Grid */}
        <div className={`sv-grid${animating ? ' fade' : ''}`}>

          {/* Skeletons */}
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="sv-skel">
              <div className="sv-skel-img shimmer" />
              <div className="sv-skel-body">
                <div className="sv-skel-line shimmer" style={{ width: '55%' }} />
                <div className="sv-skel-line shimmer" style={{ width: '88%' }} />
                <div className="sv-skel-line shimmer" style={{ width: '65%' }} />
              </div>
            </div>
          ))}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <div className="sv-empty">
              <h3 className="sv-empty-title">No treatments in this category yet</h3>
              <p className="sv-empty-sub">Check back soon — more services are on the way.</p>
            </div>
          )}

          {/* Cards */}
          {!loading && filtered.map(service => (
            <article key={service.id} className="sv-card">
              {isSignature(service) && <span className="sv-badge">Signature</span>}
              <div className="sv-img-wrap">
                <div className="sv-img-overlay" />
                <img
                  src={getImage(service.name, service.category)}
                  alt={service.name}
                  className="sv-img"
                  loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }}
                />
              </div>
              <div className="sv-card-body">
                <h3 className="sv-card-name">{service.name}</h3>
                <p className="sv-card-desc">{service.description}</p>
                <div className="sv-card-foot">
                  <div className="sv-card-meta">
                    <span className="sv-duration">⏱ {service.duration} min</span>
                    <div className="sv-price">
                      <span className="sv-price-sym">$</span>
                      {Number(service.price).toLocaleString('en-US')}
                    </div>
                  </div>
                  <button className="sv-book" onClick={() => router.push('/booking')}>
                    Book Now
                  </button>
                </div>
              </div>
            </article>
          ))}

        </div>
      </div>
    </div>
  );
}

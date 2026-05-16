// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { initSocket } from '@/lib/socket';
import Link from 'next/link';

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

interface Booking {
  id: string;
  service: { name: string; duration?: number };
  staff?: { name: string };
  appointment_date: string;
  status: AppointmentStatus;
  total_price: number;
  notes?: string;
}

// ── Time-based greeting ───────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours(); // uses browser local time
  if (hour >= 5  && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Night';
}

const STATUS_STYLE: Record<AppointmentStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:     { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: 'Pending' },
  CONFIRMED:   { bg: '#D1FAE5', text: '#065F46', dot: '#10B981', label: 'Confirmed' },
  COMPLETED:   { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6', label: 'Completed' },
  CANCELLED:   { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'Cancelled' },
  RESCHEDULED: { bg: '#EDE9FE', text: '#5B21B6', dot: '#8B5CF6', label: 'Rescheduled' },
};

export default function CustomerDashboard() {
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();

  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [greeting] = useState(getGreeting()); // computed once on mount

  // ── Route protection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    // Admins should not see customer dashboard
    if (isAdmin) {
      router.push('/admin');
    }
  }, [user, isAdmin, router]);

  // ── Fetch bookings ────────────────────────────────────────────────────────
  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/appointments/my-bookings`,
        { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }
      );
      const data = await res.json();
      if (data.success) setBookings(data.appointments || []);
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || isAdmin) return;
    fetchBookings();

    const socket = initSocket();
    socket.on('bookingCreated', fetchBookings);
    socket.on('bookingUpdated', fetchBookings);
    return () => {
      socket.off('bookingCreated');
      socket.off('bookingUpdated');
    };
  }, [user, isAdmin]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const now      = new Date();
  const upcoming = bookings.filter(b =>
    ['PENDING', 'CONFIRMED'].includes(b.status) &&
    new Date(b.appointment_date) >= now
  );
  const history  = bookings.filter(b =>
    ['COMPLETED', 'CANCELLED', 'RESCHEDULED'].includes(b.status) ||
    new Date(b.appointment_date) < now
  );

  const nextAppt = upcoming.sort(
    (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
  )[0];

  const totalSpent = bookings
    .filter(b => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + Number(b.total_price), 0);

  const displayed = activeTab === 'upcoming' ? upcoming : history;

  if (!user || isAdmin) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: "'Jost', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');
        .db-wrap { max-width: 1100px; margin: 0 auto; padding: 48px 24px 80px; }
        .db-header { margin-bottom: 40px; }
        .db-greeting { font-family:'Cormorant Garamond',serif; font-size:clamp(32px,5vw,52px); font-weight:300; color:#2C2825; margin:0 0 6px; line-height:1.1; }
        .db-greeting em { font-style:italic; color:#B89A6A; }
        .db-sub { font-size:15px; font-weight:300; color:#9E968E; }
        .db-actions { display:flex; gap:12px; margin-top:20px; flex-wrap:wrap; }
        .db-btn-primary { background:#2C2825; color:#F7F3EE; text-decoration:none; padding:12px 24px; border-radius:3px; font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; transition:background .2s; }
        .db-btn-primary:hover { background:#B89A6A; }
        .db-btn-ghost { background:transparent; color:#2C2825; text-decoration:none; padding:12px 24px; border-radius:3px; font-size:12px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; border:1px solid #EDE6DC; transition:border-color .2s,color .2s; cursor:pointer; }
        .db-btn-ghost:hover { border-color:#B89A6A; color:#B89A6A; }

        /* Stats */
        .db-stats { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:20px; margin-bottom:40px; }
        .db-stat { background:#fff; border:1px solid #EDE6DC; border-radius:6px; padding:22px 24px; }
        .db-stat-label { font-size:10px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:#9E968E; margin-bottom:10px; }
        .db-stat-value { font-family:'Cormorant Garamond',serif; font-size:36px; font-weight:400; color:#2C2825; line-height:1; }
        .db-stat-sub { font-size:12px; color:#B89A6A; margin-top:6px; }

        /* Next appointment card */
        .db-next { background:#2C2825; border-radius:6px; padding:28px 32px; margin-bottom:40px; display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap; }
        .db-next-label { font-size:10px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:#B89A6A; margin-bottom:10px; }
        .db-next-service { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:400; color:#F7F3EE; margin:0 0 6px; }
        .db-next-date { font-size:14px; font-weight:300; color:#A8A09A; }
        .db-next-badge { background:rgba(184,154,106,.15); border:1px solid rgba(184,154,106,.3); border-radius:3px; padding:10px 20px; text-align:center; flex-shrink:0; }
        .db-next-days { font-family:'Cormorant Garamond',serif; font-size:36px; font-weight:300; color:#D4B896; line-height:1; }
        .db-next-days-label { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:#9E968E; margin-top:4px; }

        /* Tabs */
        .db-tabs { display:flex; gap:0; background:#fff; border:1px solid #EDE6DC; border-radius:6px; padding:4px; margin-bottom:24px; width:fit-content; }
        .db-tab { padding:10px 24px; border-radius:4px; border:none; cursor:pointer; font-family:'Jost',sans-serif; font-size:12px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; transition:all .2s; background:transparent; color:#9E968E; }
        .db-tab.on { background:#2C2825; color:#F7F3EE; }

        /* Booking cards */
        .db-cards { display:flex; flex-direction:column; gap:16px; }
        .db-card { background:#fff; border:1px solid #EDE6DC; border-radius:6px; padding:24px 28px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; transition:box-shadow .2s; }
        .db-card:hover { box-shadow:0 4px 20px rgba(44,40,37,.07); }
        .db-card-service { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:500; color:#2C2825; margin:0 0 5px; }
        .db-card-meta { font-size:13px; font-weight:300; color:#9E968E; }
        .db-card-right { text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
        .db-status { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.06em; }
        .db-price { font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:500; color:#2C2825; }

        /* Empty */
        .db-empty { text-align:center; padding:60px 24px; background:#fff; border:1px solid #EDE6DC; border-radius:6px; }
        .db-empty-title { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:300; color:#6B635A; margin-bottom:10px; }
        .db-empty-sub { font-size:14px; color:#9E968E; margin-bottom:24px; }

        /* Loading */
        .db-loading { display:flex; align-items:center; justify-content:center; min-height:300px; }
        .db-spinner { width:36px; height:36px; border:3px solid #EDE6DC; border-top-color:#B89A6A; border-radius:50%; animation:db-spin .8s linear infinite; }
        @keyframes db-spin { to { transform:rotate(360deg); } }

        @media(max-width:640px) {
          .db-wrap { padding:32px 16px 60px; }
          .db-card { flex-direction:column; align-items:flex-start; }
          .db-card-right { align-items:flex-start; text-align:left; }
        }
      `}</style>

      <div className="db-wrap">

        {/* ── Header ── */}
        <div className="db-header">
          <h1 className="db-greeting">
            {greeting},{' '}
            <em>{user.name.split(' ')[0]}.</em>
          </h1>
          <p className="db-sub">Welcome back to your Crown &amp; Glow dashboard.</p>
          <div className="db-actions">
            <Link href="/booking" className="db-btn-primary">+ Book Appointment</Link>
            <Link href="/services" className="db-btn-ghost">Browse Services</Link>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="db-stats">
          <div className="db-stat">
            <p className="db-stat-label">Total Bookings</p>
            <p className="db-stat-value">{bookings.length}</p>
            <p className="db-stat-sub">all time</p>
          </div>
          <div className="db-stat">
            <p className="db-stat-label">Upcoming</p>
            <p className="db-stat-value" style={{ color: '#B89A6A' }}>{upcoming.length}</p>
            <p className="db-stat-sub">scheduled</p>
          </div>
          <div className="db-stat">
            <p className="db-stat-label">Completed</p>
            <p className="db-stat-value" style={{ color: '#10B981' }}>
              {bookings.filter(b => b.status === 'COMPLETED').length}
            </p>
            <p className="db-stat-sub">treatments done</p>
          </div>
          <div className="db-stat">
            <p className="db-stat-label">Total Spent</p>
            <p className="db-stat-value">${totalSpent.toLocaleString('en-US')}</p>
            <p className="db-stat-sub">completed only</p>
          </div>
        </div>

        {/* ── Next appointment banner ── */}
        {nextAppt && (() => {
          const apptDate  = new Date(nextAppt.appointment_date);
          const daysAway  = Math.ceil((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const style     = STATUS_STYLE[nextAppt.status];
          return (
            <div className="db-next">
              <div>
                <p className="db-next-label">Next Appointment</p>
                <h2 className="db-next-service">{nextAppt.service.name}</h2>
                <p className="db-next-date">
                  {apptDate.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
                  {' · '}
                  {apptDate.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
                  {nextAppt.staff && ` · with ${nextAppt.staff.name}`}
                </p>
              </div>
              <div className="db-next-badge">
                <div className="db-next-days">{daysAway}</div>
                <div className="db-next-days-label">{daysAway === 1 ? 'day' : 'days'} away</div>
              </div>
            </div>
          );
        })()}

        {/* ── Tabs ── */}
        <div className="db-tabs">
          <button className={`db-tab${activeTab === 'upcoming' ? ' on' : ''}`} onClick={() => setActiveTab('upcoming')}>
            Upcoming ({upcoming.length})
          </button>
          <button className={`db-tab${activeTab === 'history' ? ' on' : ''}`} onClick={() => setActiveTab('history')}>
            History ({history.length})
          </button>
        </div>

        {/* ── Booking list ── */}
        {loading ? (
          <div className="db-loading"><div className="db-spinner"/></div>
        ) : displayed.length === 0 ? (
          <div className="db-empty">
            <p className="db-empty-title">
              {activeTab === 'upcoming' ? 'No upcoming appointments' : 'No booking history yet'}
            </p>
            <p className="db-empty-sub">
              {activeTab === 'upcoming'
                ? 'Book your next beauty treatment and it will appear here.'
                : 'Your completed and cancelled appointments will appear here.'
              }
            </p>
            {activeTab === 'upcoming' && (
              <Link href="/booking" className="db-btn-primary">Book Now</Link>
            )}
          </div>
        ) : (
          <div className="db-cards">
            {displayed.map(booking => {
              const style   = STATUS_STYLE[booking.status];
              const apptDate = new Date(booking.appointment_date);
              return (
                <div key={booking.id} className="db-card">
                  <div>
                    <h3 className="db-card-service">{booking.service.name}</h3>
                    <p className="db-card-meta">
                      {apptDate.toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric', year:'numeric' })}
                      {' · '}
                      {apptDate.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
                      {booking.staff && ` · ${booking.staff.name}`}
                    </p>
                    {booking.notes && (
                      <p className="db-card-meta" style={{ marginTop: 4, fontStyle: 'italic' }}>
                        "{booking.notes}"
                      </p>
                    )}
                  </div>
                  <div className="db-card-right">
                    <span
                      className="db-status"
                      style={{ background: style.bg, color: style.text }}
                    >
                      <span style={{ width:6, height:6, borderRadius:'50%', background:style.dot, display:'inline-block' }}/>
                      {style.label}
                    </span>
                    <p className="db-price">${Number(booking.total_price).toLocaleString('en-US')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

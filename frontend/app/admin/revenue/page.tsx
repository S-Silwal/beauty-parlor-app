// app/admin/revenue/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { initSocket } from '@/lib/socket';

// ====================== Types ======================

type ServiceCategory = 'EYEBROW_LASH' | 'WAXING' | 'FACIAL_SKINCARE';

interface Appointment {
  id: string;
  appointment_date: string;
  total_price: number | string; // Prisma Decimal comes back as a string over JSON
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  payment_status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  service: { id: string; name: string; category: ServiceCategory };
}

type Tab = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Summary {
  revenue: number;
  bookings: number;
  breakdown: { key: ServiceCategory; label: string; color: string; amount: number }[];
}

// ====================== Constants ======================

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Mirrors the admin panel's SERVICE_CATEGORIES — kept in sync with the
// backend's ServiceCategory enum (prisma/schema.prisma).
const CATEGORY_META: Record<ServiceCategory, { label: string; color: string }> = {
  EYEBROW_LASH:    { label: 'Brows & Lashes',     color: '#B89A6A' },
  WAXING:          { label: 'Waxing',             color: '#C17B5D' },
  FACIAL_SKINCARE: { label: 'Facials & Skincare', color: '#6B4F3F' },
};
const CATEGORY_KEYS = Object.keys(CATEGORY_META) as ServiceCategory[];

// ====================== Pure helpers (no React state) ======================

function startOfDay(d: Date) { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function dayKey(d: Date) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function monthName(m: number, short = false) { return new Date(2000, m, 1).toLocaleDateString('en-US', { month: short ? 'short' : 'long' }); }
function fmtMoney(n: number) { return Math.round(n).toLocaleString('en-US'); }
function fmtNum(n: number) { return Math.round(n).toLocaleString('en-US'); }

function summarize(list: Appointment[]): Summary {
  const revenue = list.reduce((a, x) => a + Number(x.total_price), 0);
  const breakdown = CATEGORY_KEYS.map(key => ({
    key, label: CATEGORY_META[key].label, color: CATEGORY_META[key].color,
    amount: list.filter(x => x.service?.category === key).reduce((a, x) => a + Number(x.total_price), 0),
  }));
  return { revenue, bookings: list.length, breakdown };
}

function deltaMeta(current: number, previous: number | null) {
  if (previous === null || previous === 0) return { show: false, text: '—', className: 'rv-delta neutral' };
  const delta = ((current - previous) / previous) * 100;
  const dir = delta >= 0 ? 'up' : 'down';
  return { show: true, dir, text: (dir === 'up' ? '▲ +' : '▼ -') + Math.abs(delta).toFixed(1) + '%', className: 'rv-delta ' + dir };
}

function buildBars(items: { revenue: number; hasData: boolean; isToday?: boolean; label: string; bookings?: number }[], everyNth = 1) {
  const max = Math.max(...items.map(i => i.revenue), 1);
  return items.map((it, i) => {
    const ghost = it.hasData === false;
    const heightPct = ghost ? 8 : Math.max((it.revenue / max) * 100, it.revenue > 0 ? 3 : 1.5);
    const tooltip = ghost ? (it.label + ': no data yet') : (it.label + ': $' + fmtMoney(it.revenue) + (it.bookings !== undefined ? ' · ' + it.bookings + ' bookings' : ''));
    return { key: 'b' + i, heightPct, ghost, isToday: !!it.isToday, tooltip, showLabel: i % everyNth === 0 || i === items.length - 1, axisLabel: it.label };
  });
}

// ====================== Page ======================

export default function RevenuePage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  // Lazy-initialized from the socket singleton's current state, rather than
  // synchronously set from the effect below, so mounting when already
  // connected doesn't trigger an extra cascading render.
  const [live, setLive] = useState(() => initSocket().connected);
  const [tab, setTab] = useState<Tab>('daily');
  const [dailyOffset, setDailyOffset] = useState(0);
  const [weeklyYear, setWeeklyYear] = useState(new Date().getFullYear());
  const [weeklyMonth, setWeeklyMonth] = useState(new Date().getMonth());
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isAdmin) { router.push('/dashboard'); }
  }, [user, isAdmin, authLoading, router]);

  // Upsert a single appointment coming off the socket rather than
  // refetching the whole list — a Confirmed → Completed transition (or any
  // other status/payment change) needs to land in every chart, table and
  // hero total on this page the instant it happens, with no page refresh.
  const upsertAppointment = useCallback((incoming: Appointment) => {
    setAppointments(prev => {
      const idx = prev.findIndex(a => a.id === incoming.id);
      if (idx === -1) return [incoming, ...prev];
      const next = prev.slice();
      next[idx] = incoming;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) return;

    // Guards the fetch's continuation against setting state after this
    // effect has already been cleaned up (e.g. a fast unmount, or React's
    // dev-mode double-invoke) — the documented-safe shape for fetching
    // inside an effect (https://react.dev/learn/you-might-not-need-an-effect).
    let ignore = false;
    (async () => {
      try {
        const token = api.getToken();
        const res = await fetch(`${API}/api/appointments/all`, {
          headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
        });
        const data = await res.json();
        if (!ignore && data.success) setAppointments(data.appointments || []);
      } catch (err) {
        console.error('Failed to fetch appointments', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    const socket = initSocket();
    const handleConnect = () => setLive(true);
    const handleDisconnect = () => setLive(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Both events carry the full updated appointment (service, staff, user,
    // status, payment_status, total_price included) straight from the
    // backend's Prisma `include`, so the upsert needs no extra fetch.
    socket.on('bookingCreated', upsertAppointment);
    socket.on('bookingUpdated', upsertAppointment);

    return () => {
      ignore = true;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('bookingCreated', upsertAppointment);
      socket.off('bookingUpdated', upsertAppointment);
    };
  }, [user, isAdmin, upsertAppointment]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Revenue only counts appointments that were actually delivered and paid —
  // matches the definition already used on the admin Overview tab.
  const paidAppointments = useMemo(
    () => appointments.filter(a => a.status === 'COMPLETED' && a.payment_status === 'PAID'),
    [appointments]
  );

  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of paidAppointments) {
      const k = dayKey(new Date(a.appointment_date));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [paidAppointments]);

  const byYearMonth = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of paidAppointments) {
      const d = new Date(a.appointment_date);
      const k = d.getFullYear() + '-' + d.getMonth();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [paidAppointments]);

  const earliestDate = useMemo(() => {
    if (!paidAppointments.length) return today;
    return startOfDay(new Date(Math.min(...paidAppointments.map(a => new Date(a.appointment_date).getTime()))));
  }, [paidAppointments, today]);

  // Same-period-last-year / same-days-last-month comparisons, filtered directly
  // off real dates rather than estimated — accurate no matter how sparse the data is.
  const sumUpToYearDay = useCallback((year: number, monthLimit: number, dayLimit: number) => summarize(
    paidAppointments.filter(a => {
      const d = new Date(a.appointment_date);
      if (d.getFullYear() !== year) return false;
      if (d.getMonth() < monthLimit) return true;
      return d.getMonth() === monthLimit && d.getDate() <= dayLimit;
    })
  ), [paidAppointments]);
  const sumMonthUpToDay = useCallback((year: number, month: number, dayLimit: number) => summarize(
    paidAppointments.filter(a => {
      const d = new Date(a.appointment_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() <= dayLimit;
    })
  ), [paidAppointments]);

  // ---------------- Daily ----------------

  const maxDailyOffset = useMemo(() => {
    const daysSince = Math.floor((today.getTime() - earliestDate.getTime()) / 86400000);
    return Math.max(0, Math.floor(daysSince / 30));
  }, [today, earliestDate]);

  const daily = useMemo(() => {
    const windowEnd = addDays(today, -dailyOffset * 30);
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(windowEnd, -i);
      const list = byDay.get(dayKey(d)) ?? [];
      const s = summarize(list);
      days.push({
        date: d, isToday: dayKey(d) === dayKey(today),
        revenue: s.revenue, bookings: s.bookings, breakdown: s.breakdown,
        avgTicket: s.bookings ? s.revenue / s.bookings : 0,
      });
    }
    const current = summarize(days.flatMap(d => byDay.get(dayKey(d.date)) ?? []));
    const hasPrev = dailyOffset < maxDailyOffset;
    let prevTotal: number | null = null;
    if (hasPrev) {
      const prevEnd = addDays(windowEnd, -30);
      const prevDays = Array.from({ length: 30 }, (_, i) => addDays(prevEnd, -(29 - i)));
      prevTotal = summarize(prevDays.flatMap(d => byDay.get(dayKey(d)) ?? [])).revenue;
    }
    return { days, current, prevTotal, rangeLabel: days[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' – ' + days[29].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) };
  }, [byDay, today, dailyOffset, maxDailyOffset]);

  // ---------------- Weekly ----------------

  const weeklyMonthIsFuture = weeklyYear > currentYear || (weeklyYear === currentYear && weeklyMonth > currentMonth);
  const weeklyMonthIsCurrent = weeklyYear === currentYear && weeklyMonth === currentMonth;

  const weekly = useMemo(() => {
    if (weeklyMonthIsFuture) return null;
    const list = byYearMonth.get(weeklyYear + '-' + weeklyMonth) ?? [];
    const daysInMonth = new Date(weeklyYear, weeklyMonth + 1, 0).getDate();
    const ranges: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, daysInMonth]];
    const weeks = ranges.map(([start, end], i) => {
      const weekStart = new Date(weeklyYear, weeklyMonth, start);
      const hasData = !weeklyMonthIsCurrent || weekStart <= today;
      const weekList = list.filter(a => { const d = new Date(a.appointment_date).getDate(); return d >= start && d <= end; });
      const s = summarize(weekList);
      return { index: i, label: 'Week of ' + weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue: s.revenue, bookings: s.bookings, breakdown: s.breakdown, hasData };
    });
    const monthLabel = monthName(weeklyMonth) + ' ' + weeklyYear;
    const total = summarize(list);
    let prevTotal: number | null;
    if (weeklyMonthIsCurrent) {
      const prevM = weeklyMonth === 0 ? 11 : weeklyMonth - 1;
      const prevY = weeklyMonth === 0 ? weeklyYear - 1 : weeklyYear;
      prevTotal = sumMonthUpToDay(prevY, prevM, today.getDate()).revenue;
    } else {
      const prevM = weeklyMonth === 0 ? 11 : weeklyMonth - 1;
      const prevY = weeklyMonth === 0 ? weeklyYear - 1 : weeklyYear;
      const prevList = byYearMonth.get(prevY + '-' + prevM) ?? [];
      prevTotal = prevList.length ? summarize(prevList).revenue : null;
    }
    return { weeks, total, prevTotal, monthLabel, isPartial: weeklyMonthIsCurrent };
  }, [byYearMonth, weeklyYear, weeklyMonth, weeklyMonthIsFuture, weeklyMonthIsCurrent, today, sumMonthUpToDay]);

  // ---------------- Monthly ----------------

  const monthly = useMemo(() => {
    const isPartialYear = monthlyYear === currentYear;
    const months = Array.from({ length: 12 }, (_, m) => {
      const isFuture = monthlyYear > currentYear || (monthlyYear === currentYear && m > currentMonth);
      const isCurrent = monthlyYear === currentYear && m === currentMonth;
      const list = byYearMonth.get(monthlyYear + '-' + m) ?? [];
      const s = summarize(list);
      return { year: monthlyYear, monthIndex: m, label: monthName(m), shortLabel: monthName(m, true), revenue: s.revenue, bookings: s.bookings, breakdown: s.breakdown, hasData: !isFuture, isCurrent };
    });
    const dataMonths = months.filter(m => m.hasData);
    const total = summarize(dataMonths.flatMap(m => byYearMonth.get(m.year + '-' + m.monthIndex) ?? []));

    const current = isPartialYear ? sumUpToYearDay(monthlyYear, currentMonth, today.getDate()) : summarize(dataMonths.flatMap(m => byYearMonth.get(m.year + '-' + m.monthIndex) ?? []));
    const prior = isPartialYear ? sumUpToYearDay(monthlyYear - 1, currentMonth, today.getDate()) : summarize(byYearMonth.get((monthlyYear - 1) + '-0') ? Array.from(byYearMonth.entries()).filter(([k]) => k.startsWith((monthlyYear - 1) + '-')).flatMap(([, v]) => v) : []);

    const rows = months.map((mo, i) => {
      if (!mo.hasData) return { ...mo, prevVal: null as number | null };
      let prevVal: number | null;
      if (mo.isCurrent) {
        const prevM = i === 0 ? 11 : i - 1;
        const prevY = i === 0 ? monthlyYear - 1 : monthlyYear;
        prevVal = sumMonthUpToDay(prevY, prevM, today.getDate()).revenue;
      } else {
        const prevM = i === 0 ? 11 : i - 1;
        const prevY = i === 0 ? monthlyYear - 1 : monthlyYear;
        const prevList = byYearMonth.get(prevY + '-' + prevM) ?? [];
        prevVal = prevList.length ? summarize(prevList).revenue : null;
      }
      return { ...mo, prevVal };
    });

    return { rows, total, current, prior, isPartialYear, rangeLabel: isPartialYear ? ('Jan – ' + monthName(currentMonth, true) + ' ' + monthlyYear + ' (Year to Date)') : ('Jan – Dec ' + monthlyYear) };
  }, [byYearMonth, monthlyYear, currentYear, currentMonth, today, sumUpToYearDay, sumMonthUpToDay]);

  // ---------------- Yearly ----------------

  const yearly = useMemo(() => {
    const years = new Set<number>();
    paidAppointments.forEach(a => years.add(new Date(a.appointment_date).getFullYear()));
    years.add(currentYear);
    const list = Array.from(years).sort((a, b) => a - b);

    const rows = list.map(year => {
      const isPartial = year === currentYear;
      const s = isPartial
        ? sumUpToYearDay(year, currentMonth, today.getDate())
        : summarize(paidAppointments.filter(a => new Date(a.appointment_date).getFullYear() === year));
      return { year, revenue: s.revenue, bookings: s.bookings, breakdown: s.breakdown, isPartial };
    });

    const allTotal = summarize(paidAppointments);
    let cmp: number | null = null;
    if (rows.length > 1) {
      const last = rows[rows.length - 1], prior = rows[rows.length - 2];
      cmp = last.isPartial ? sumUpToYearDay(prior.year, currentMonth, today.getDate()).revenue : prior.revenue;
    }
    return { rows, allTotal, cmp, rangeLabel: 'All-time · ' + list[0] + '–' + list[list.length - 1] };
  }, [paidAppointments, currentYear, currentMonth, today, sumUpToYearDay]);

  if (authLoading || !user || !isAdmin) return null;

  return (
    <div className="rv-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');
        .rv-root { min-height: 100vh; background: #F5F0EB; font-family: 'Jost', sans-serif; }
        .rv-header { background: #2B221C; padding: 0 32px; border-bottom: 1px solid rgba(212,184,150,.16); }
        .rv-header-inner { max-width: 1280px; margin: 0 auto; height: 80px; display: flex; align-items: center; justify-content: space-between; }
        .rv-logo { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 500; color: #F7F3EE; }
        .rv-logo em { font-style: italic; color: #D4B896; }
        .rv-crumb { background: #fff; border-bottom: 1px solid #EDE6DC; }
        .rv-crumb-inner { max-width: 1280px; margin: 0 auto; padding: 15px 32px; display: flex; align-items: center; gap: 10px; }
        .rv-crumb-link { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #9E968E; }
        .rv-crumb-link:hover { color: #B89A6A; }
        .rv-crumb-sep { color: #D8CFC3; font-size: 12px; }
        .rv-crumb-current { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #2C2825; }
        .rv-live { display: inline-flex; align-items: center; gap: 6px; margin-left: 6px; padding: 3px 10px 3px 8px; border-radius: 999px; background: #F0EBE3; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #9E968E; }
        .rv-live.on { background: #D1FAE5; color: #065F46; }
        .rv-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #B8AFA4; flex-shrink: 0; }
        .rv-live.on .rv-live-dot { background: #10B981; animation: rv-pulse 1.8s ease-in-out infinite; }
        @keyframes rv-pulse { 0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16,185,129,.45); } 50% { opacity: .85; box-shadow: 0 0 0 4px rgba(16,185,129,0); } }
        .rv-body { max-width: 1280px; margin: 0 auto; padding: 40px 32px 88px; }
        .rv-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; margin-bottom: 32px; flex-wrap: wrap; }
        .rv-hero h1 { font-family: 'Cormorant Garamond', serif; font-size: clamp(30px,4vw,44px); font-weight: 300; color: #2C2825; margin: 0 0 8px; }
        .rv-hero-sub { font-size: 15px; font-weight: 400; color: #8A7B6E; line-height: 1.5; margin: 0; }
        .rv-hero-right { text-align: right; }
        .rv-hero-label { font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #6B5D50; margin: 0 0 6px; }
        .rv-hero-value { font-family: 'Cormorant Garamond', serif; font-size: 52px; font-weight: 500; color: #2C2825; line-height: 1; }
        .rv-hero-value sup { font-size: 22px; font-weight: 400; color: #B89A6A; }
        .rv-hero-meta { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
        .rv-cmp { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        .rv-cmp.up { background: #D1FAE5; color: #065F46; }
        .rv-cmp.down { background: #FEE2E2; color: #991B1B; }
        .rv-hero-bookings { font-size: 12px; color: #9E968E; font-weight: 500; }
        .rv-controls { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
        .rv-seg { display: inline-flex; background: #fff; border: 1px solid #EDE6DC; border-radius: 999px; padding: 4px; gap: 2px; }
        .rv-seg-btn { border: none; background: none; cursor: pointer; padding: 11px 22px; min-height: 44px; border-radius: 999px; font-family: 'Jost', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #8A7B6E; transition: all .2s; }
        .rv-seg-btn:hover { color: #2C2825; }
        .rv-seg-btn.on { background: #2C2825; color: #F7F3EE; }
        .rv-scope { display: flex; align-items: center; gap: 6px; }
        .rv-scope-chip { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #EDE6DC; border-radius: 999px; padding: 10px 18px; font-size: 13px; font-weight: 600; color: #2C2825; }
        .rv-chev { width: 40px; height: 40px; border-radius: 999px; border: 1px solid #EDE6DC; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #6B635A; transition: all .2s; }
        .rv-chev:hover:not(:disabled) { border-color: #B89A6A; color: #B89A6A; }
        .rv-chev:disabled { opacity: .35; cursor: not-allowed; }
        .rv-scope-static { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #9E968E; }
        .rv-grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 24px; margin-bottom: 28px; align-items: stretch; }
        .rv-card { background: #fff; border: 1px solid #EDE6DC; border-radius: 6px; padding: 26px 28px; }
        .rv-card-title { font-family: 'Cormorant Garamond', serif; font-size: 21px; font-weight: 500; color: #2C2825; margin: 0 0 4px; }
        .rv-card-sub { font-size: 12px; color: #9E968E; margin: 0 0 20px; }
        .rv-chart-area { height: 220px; display: flex; align-items: flex-end; gap: 6px; position: relative; border-bottom: 1px solid #EDE6DC; }
        .rv-chart-grid { position: absolute; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; }
        .rv-chart-gridline { position: absolute; left: 0; right: 0; border-top: 1px dashed #EDE6DC; }
        .rv-bar-col { flex: 1; min-width: 4px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; cursor: default; }
        .rv-bar { width: 100%; max-width: 26px; border-radius: 4px 4px 0 0; background: #B89A6A; transition: opacity .15s; }
        .rv-bar-col:hover .rv-bar { opacity: .82; }
        .rv-bar.today { background: #2C2825; }
        .rv-bar.ghost { background: transparent; border: 1.5px dashed #D8CFC3; border-bottom: none; }
        .rv-bar-labels { display: flex; gap: 6px; margin-top: 10px; }
        .rv-bar-label-slot { flex: 1; min-width: 4px; text-align: center; font-size: 10px; color: #9E968E; }
        .rv-tooltip { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: #2C2825; color: #F7F3EE; font-size: 11px; font-weight: 600; padding: 6px 10px; border-radius: 4px; white-space: nowrap; pointer-events: none; z-index: 5; }
        .rv-chart-note { font-size: 11px; color: #B0A695; margin-top: 12px; font-style: italic; }
        .rv-bd-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
        .rv-bd-item:last-child { margin-bottom: 0; }
        .rv-bd-top { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
        .rv-bd-label { display: flex; align-items: center; gap: 8px; color: #2C2825; font-weight: 500; }
        .rv-bd-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
        .rv-bd-amount { font-weight: 600; color: #2C2825; font-variant-numeric: tabular-nums; }
        .rv-bd-track { height: 7px; border-radius: 999px; background: #F0EAE1; overflow: hidden; }
        .rv-bd-fill { height: 100%; border-radius: 999px; }
        .rv-bd-pct { font-size: 11px; color: #9E968E; }
        .rv-table-wrap { overflow-x: auto; }
        .rv-table { background: #fff; border: 1px solid #EDE6DC; border-radius: 6px; overflow: hidden; min-width: 640px; }
        .rv-thead { display: grid; gap: 12px; padding: 14px 24px; background: #FDFAF6; border-bottom: 1px solid #EDE6DC; }
        .rv-th { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #9E968E; }
        .rv-row { display: grid; gap: 12px; padding: 15px 24px; border-bottom: 1px solid #F5F0EB; align-items: center; }
        .rv-row:last-child { border-bottom: none; }
        .rv-row:hover { background: #FDFAF6; }
        .rv-cols-5 { grid-template-columns: 1.3fr 0.9fr 1fr 0.9fr 1fr; }
        .rv-cols-4 { grid-template-columns: 1.6fr 0.9fr 1.1fr 1.1fr; }
        .rv-cell-primary { font-size: 14px; font-weight: 600; color: #2C2825; }
        .rv-cell-sub { font-size: 11px; color: #9E968E; margin-top: 2px; }
        .rv-cell { font-size: 13px; color: #2C2825; font-variant-numeric: tabular-nums; }
        .rv-cell-muted { font-size: 13px; color: #C4BAB0; }
        .rv-pill { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; width: fit-content; }
        .rv-pill.today { background: #FBF0DC; color: #8A6D3B; }
        .rv-pill.empty { background: #F0EBE3; color: #9E968E; }
        .rv-pill.completed { background: #DBEAFE; color: #1E40AF; }
        .rv-delta { font-size: 13px; font-weight: 700; }
        .rv-delta.up { color: #065F46; }
        .rv-delta.down { color: #991B1B; }
        .rv-delta.neutral { color: #B8AFA4; font-weight: 500; }
        .rv-delta.upcoming { color: #B8AFA4; font-weight: 600; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
        .rv-empty { background: #fff; border: 1px solid #EDE6DC; border-radius: 6px; padding: 72px 24px; text-align: center; }
        .rv-empty-title { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 400; color: #6B635A; margin: 0 0 8px; }
        .rv-empty-sub { font-size: 14px; color: #9E968E; margin: 0; }
        @media (max-width: 900px) {
          .rv-grid { grid-template-columns: 1fr; }
          .rv-hero-right { text-align: left; width: 100%; }
          .rv-hero-meta { justify-content: flex-start; }
        }
        @media (max-width: 640px) {
          .rv-header { padding: 0 20px; }
          .rv-crumb-inner { padding: 14px 20px; }
          .rv-body { padding: 28px 20px 64px; }
          .rv-controls { flex-direction: column; align-items: stretch; }
          .rv-seg-btn { flex: 1; padding: 11px 10px; }
          .rv-card { padding: 20px 18px; }
        }
      `}</style>

      <div className="rv-header">
        <div className="rv-header-inner">
          <div className="rv-logo">Crown &amp; <em>Glow</em></div>
        </div>
      </div>

      <div className="rv-crumb">
        <div className="rv-crumb-inner">
          <Link href="/admin" className="rv-crumb-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Dashboard
          </Link>
          <span className="rv-crumb-sep">/</span>
          <span className="rv-crumb-current">Revenue</span>
          <span className={'rv-live' + (live ? ' on' : '')} title={live ? 'Live — updates automatically' : 'Reconnecting…'}>
            <span className="rv-live-dot" />{live ? 'Live' : 'Reconnecting…'}
          </span>
        </div>
      </div>

      <div className="rv-body">
        {loading ? (
          <p style={{ color: '#9E968E' }}>Loading revenue…</p>
        ) : (
          <>
            {tab === 'daily' && (
              <>
                <div className="rv-hero">
                  <div><h1>Revenue</h1><p className="rv-hero-sub">{daily.rangeLabel}</p></div>
                  <div className="rv-hero-right">
                    <p className="rv-hero-label">Total Revenue</p>
                    <div className="rv-hero-value"><sup>$</sup>{fmtMoney(daily.current.revenue)}</div>
                    <div className="rv-hero-meta">
                      <ComparisonChip current={daily.current.revenue} previous={daily.prevTotal} suffix="vs prior 30 days" />
                      <span className="rv-hero-bookings">{fmtNum(daily.current.bookings)} bookings</span>
                    </div>
                  </div>
                </div>
                <Controls tab={tab} setTab={setTab}
                  scopeLabel={daily.days[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + daily.days[29].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  onPrev={() => setDailyOffset(o => Math.min(maxDailyOffset, o + 1))}
                  onNext={() => setDailyOffset(o => Math.max(0, o - 1))}
                  prevDisabled={dailyOffset >= maxDailyOffset} nextDisabled={dailyOffset <= 0} />
                <div className="rv-grid">
                  <Chart bars={buildBars(daily.days.map(d => ({ revenue: d.revenue, hasData: true, isToday: d.isToday, bookings: d.bookings, label: d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })), 5)} />
                  <BreakdownPanel breakdown={daily.current.breakdown} />
                </div>
                <div className="rv-table-wrap">
                  <div className="rv-table">
                    <div className="rv-thead rv-cols-5"><span className="rv-th">Date</span><span className="rv-th">Bookings</span><span className="rv-th">Revenue</span><span className="rv-th">Avg Ticket</span><span className="rv-th">Status</span></div>
                    {daily.days.slice().reverse().map(d => (
                      <div key={dayKey(d.date)} className="rv-row rv-cols-5">
                        <div>
                          <div className="rv-cell-primary">{d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="rv-cell-sub">{d.date.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                        </div>
                        <span className="rv-cell">{d.bookings || '—'}</span>
                        <span className="rv-cell">${fmtMoney(d.revenue)}</span>
                        <span className="rv-cell">{d.bookings > 0 ? '$' + fmtMoney(d.avgTicket) : '—'}</span>
                        <span className={'rv-pill ' + (d.isToday ? 'today' : d.bookings > 0 ? 'completed' : 'empty')}>{d.isToday ? 'Today' : d.bookings > 0 ? 'Completed' : 'No Bookings'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'weekly' && (
              <>
                <div className="rv-hero">
                  <div><h1>Revenue</h1><p className="rv-hero-sub">{weekly ? (weekly.isPartial ? weekly.monthLabel + ' (Month to Date)' : weekly.monthLabel) : monthName(weeklyMonth) + ' ' + weeklyYear}</p></div>
                  <div className="rv-hero-right">
                    <p className="rv-hero-label">Total Revenue</p>
                    <div className="rv-hero-value"><sup>$</sup>{fmtMoney(weekly?.total.revenue ?? 0)}</div>
                    <div className="rv-hero-meta">
                      {weekly && <ComparisonChip current={weekly.total.revenue} previous={weekly.prevTotal} suffix={weekly.isPartial ? 'vs same days last month' : 'vs last month'} />}
                      <span className="rv-hero-bookings">{fmtNum(weekly?.total.bookings ?? 0)} bookings</span>
                    </div>
                  </div>
                </div>
                <Controls tab={tab} setTab={setTab} scopeLabel={monthName(weeklyMonth) + ' ' + weeklyYear}
                  onPrev={() => { if (weeklyMonth === 0) { setWeeklyMonth(11); setWeeklyYear(y => y - 1); } else setWeeklyMonth(m => m - 1); }}
                  onNext={() => { if (weeklyMonth === 11) { setWeeklyMonth(0); setWeeklyYear(y => y + 1); } else setWeeklyMonth(m => m + 1); }}
                  prevDisabled={weeklyYear <= earliestDate.getFullYear() && weeklyMonth <= earliestDate.getMonth()}
                  nextDisabled={weeklyYear >= currentYear && weeklyMonth >= currentMonth} />
                {!weekly ? (
                  <div className="rv-empty">
                    <p className="rv-empty-title">No bookings yet for this period</p>
                    <p className="rv-empty-sub">{monthName(weeklyMonth) + ' ' + weeklyYear} hasn’t happened yet — revenue will appear here once the month begins.</p>
                  </div>
                ) : (
                  <>
                    <div className="rv-grid">
                      <Chart bars={buildBars(weekly.weeks.map((w, i) => ({ revenue: w.revenue, hasData: w.hasData, bookings: w.bookings, label: 'Wk ' + (i + 1) })))} note={weekly.isPartial ? 'Later weeks of ' + weekly.monthLabel + ' will populate as they happen.' : undefined} />
                      <BreakdownPanel breakdown={weekly.total.breakdown} />
                    </div>
                    <div className="rv-table-wrap">
                      <div className="rv-table">
                        <div className="rv-thead rv-cols-4"><span className="rv-th">Week</span><span className="rv-th">Bookings</span><span className="rv-th">Revenue</span><span className="rv-th">vs Last Week</span></div>
                        {weekly.weeks.map((w, i) => {
                          if (!w.hasData) return <div key={w.index} className="rv-row rv-cols-4"><span className="rv-cell-primary">{w.label}</span><span className="rv-cell-muted">—</span><span className="rv-cell-muted">—</span><span className="rv-delta upcoming">Upcoming</span></div>;
                          const prevW = i > 0 && weekly.weeks[i - 1].hasData ? weekly.weeks[i - 1].revenue : null;
                          const d = deltaMeta(w.revenue, prevW);
                          return <div key={w.index} className="rv-row rv-cols-4"><span className="rv-cell-primary">{w.label}</span><span className="rv-cell">{fmtNum(w.bookings)}</span><span className="rv-cell">${fmtMoney(w.revenue)}</span><span className={d.className}>{d.text}</span></div>;
                        })}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {tab === 'monthly' && (
              <>
                <div className="rv-hero">
                  <div><h1>Revenue</h1><p className="rv-hero-sub">{monthly.rangeLabel}</p></div>
                  <div className="rv-hero-right">
                    <p className="rv-hero-label">Total Revenue</p>
                    <div className="rv-hero-value"><sup>$</sup>{fmtMoney(monthly.current.revenue)}</div>
                    <div className="rv-hero-meta">
                      <ComparisonChip current={monthly.current.revenue} previous={monthly.prior.revenue || null} suffix="vs same period last year" />
                      <span className="rv-hero-bookings">{fmtNum(monthly.current.bookings)} bookings</span>
                    </div>
                  </div>
                </div>
                <Controls tab={tab} setTab={setTab} scopeLabel={String(monthlyYear)}
                  onPrev={() => setMonthlyYear(y => Math.max(earliestDate.getFullYear(), y - 1))}
                  onNext={() => setMonthlyYear(y => Math.min(currentYear, y + 1))}
                  prevDisabled={monthlyYear <= earliestDate.getFullYear()} nextDisabled={monthlyYear >= currentYear} />
                <div className="rv-grid">
                  <Chart bars={buildBars(monthly.rows.map(m => ({ revenue: m.revenue, hasData: m.hasData, bookings: m.bookings, label: m.shortLabel })))} note={monthly.isPartialYear ? 'Upcoming months of ' + monthlyYear + ' will populate as bookings come in.' : undefined} />
                  <BreakdownPanel breakdown={monthly.total.breakdown} />
                </div>
                <div className="rv-table-wrap">
                  <div className="rv-table">
                    <div className="rv-thead rv-cols-4"><span className="rv-th">Month</span><span className="rv-th">Bookings</span><span className="rv-th">Revenue</span><span className="rv-th">vs Last Month</span></div>
                    {monthly.rows.map(mo => {
                      if (!mo.hasData) return <div key={mo.monthIndex} className="rv-row rv-cols-4"><span className="rv-cell-primary">{mo.label}</span><span className="rv-cell-muted">—</span><span className="rv-cell-muted">—</span><span className="rv-delta upcoming">Upcoming</span></div>;
                      const d = deltaMeta(mo.revenue, mo.prevVal);
                      return <div key={mo.monthIndex} className="rv-row rv-cols-4"><span className="rv-cell-primary">{mo.isCurrent ? mo.label + ' (MTD)' : mo.label}</span><span className="rv-cell">{fmtNum(mo.bookings)}</span><span className="rv-cell">${fmtMoney(mo.revenue)}</span><span className={d.className}>{d.text}</span></div>;
                    })}
                  </div>
                </div>
              </>
            )}

            {tab === 'yearly' && (
              <>
                <div className="rv-hero">
                  <div><h1>Revenue</h1><p className="rv-hero-sub">{yearly.rangeLabel}</p></div>
                  <div className="rv-hero-right">
                    <p className="rv-hero-label">Total Revenue</p>
                    <div className="rv-hero-value"><sup>$</sup>{fmtMoney(yearly.allTotal.revenue)}</div>
                    <div className="rv-hero-meta">
                      <ComparisonChip current={yearly.rows[yearly.rows.length - 1].revenue} previous={yearly.cmp} suffix="latest year vs same period prior year" />
                      <span className="rv-hero-bookings">{fmtNum(yearly.allTotal.bookings)} bookings</span>
                    </div>
                  </div>
                </div>
                <Controls tab={tab} setTab={setTab} scopeLabel="All years on record" isStatic />
                <div className="rv-grid">
                  <Chart bars={buildBars(yearly.rows.map(y => ({ revenue: y.revenue, hasData: true, bookings: y.bookings, label: y.isPartial ? y.year + '*' : String(y.year) })))} note={yearly.rows.some(y => y.isPartial) ? '* current year figures are year-to-date.' : undefined} />
                  <BreakdownPanel breakdown={yearly.allTotal.breakdown} />
                </div>
                <div className="rv-table-wrap">
                  <div className="rv-table">
                    <div className="rv-thead rv-cols-4"><span className="rv-th">Year</span><span className="rv-th">Bookings</span><span className="rv-th">Revenue</span><span className="rv-th">vs Last Year</span></div>
                    {yearly.rows.slice().reverse().map((y, idx) => {
                      const priorRow = yearly.rows[yearly.rows.length - 1 - idx - 1];
                      const priorVal = priorRow ? (y.isPartial ? null : priorRow.revenue) : null; // yearly.cmp already covers the partial-year case for the hero; row-level keeps it simple
                      const effectivePrior = y.isPartial ? yearly.cmp : priorVal;
                      const d = deltaMeta(y.revenue, effectivePrior);
                      return <div key={y.year} className="rv-row rv-cols-4"><span className="rv-cell-primary">{y.isPartial ? y.year + ' (YTD)' : y.year}</span><span className="rv-cell">{fmtNum(y.bookings)}</span><span className="rv-cell">${fmtMoney(y.revenue)}</span><span className={d.className}>{d.text}</span></div>;
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ====================== Small shared bits ======================

function BreakdownPanel({ breakdown }: { breakdown: Summary['breakdown'] }) {
  const total = breakdown.reduce((a, b) => a + b.amount, 0) || 1;
  return (
    <div className="rv-card">
      <h3 className="rv-card-title">By Service</h3>
      <p className="rv-card-sub">Current selection</p>
      {breakdown.map(b => (
        <div key={b.key} className="rv-bd-item">
          <div className="rv-bd-top">
            <span className="rv-bd-label"><span className="rv-bd-dot" style={{ background: b.color }} />{b.label}</span>
            <span className="rv-bd-amount">${fmtMoney(b.amount)}</span>
          </div>
          <div className="rv-bd-track"><div className="rv-bd-fill" style={{ width: `${(b.amount / total) * 100}%`, background: b.color }} /></div>
          <span className="rv-bd-pct">{((b.amount / total) * 100).toFixed(1)}% of revenue</span>
        </div>
      ))}
    </div>
  );
}

function Chart({ bars, note }: { bars: ReturnType<typeof buildBars>; note?: string }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  return (
    <div className="rv-card">
      <h3 className="rv-card-title">Revenue Trend</h3>
      <p className="rv-card-sub">Current selection</p>
      <div className="rv-chart-area">
        <div className="rv-chart-grid">
          <div className="rv-chart-gridline" style={{ top: '0%' }} />
          <div className="rv-chart-gridline" style={{ top: '33%' }} />
          <div className="rv-chart-gridline" style={{ top: '66%' }} />
        </div>
        {bars.map(bar => (
          <div key={bar.key} className="rv-bar-col" title={bar.tooltip} onMouseEnter={() => setHoveredKey(bar.key)} onMouseLeave={() => setHoveredKey(null)}>
            {hoveredKey === bar.key && <div className="rv-tooltip">{bar.tooltip}</div>}
            <div className={'rv-bar' + (bar.ghost ? ' ghost' : bar.isToday ? ' today' : '')} style={{ height: `${bar.heightPct}%` }} />
          </div>
        ))}
      </div>
      <div className="rv-bar-labels">
        {bars.map(bar => <div key={bar.key} className="rv-bar-label-slot">{bar.showLabel ? bar.axisLabel : ''}</div>)}
      </div>
      {note && <p className="rv-chart-note">{note}</p>}
    </div>
  );
}

function ComparisonChip({ current, previous, suffix }: { current: number; previous: number | null; suffix: string }) {
  const d = deltaMeta(current, previous);
  if (!d.show) return null;
  return <span className={'rv-cmp ' + d.dir}>{d.text.slice(0, 2)}{d.text.slice(2)}<span className="rv-hero-bookings" style={{ marginLeft: 4 }}>{suffix}</span></span>;
}

function Controls({ tab, setTab, scopeLabel, onPrev, onNext, prevDisabled, nextDisabled, isStatic }: {
  tab: Tab; setTab: (t: Tab) => void; scopeLabel: string;
  onPrev?: () => void; onNext?: () => void; prevDisabled?: boolean; nextDisabled?: boolean; isStatic?: boolean;
}) {
  return (
    <div className="rv-controls">
      <div className="rv-seg">
        {(['daily', 'weekly', 'monthly', 'yearly'] as Tab[]).map(t => (
          <button key={t} className={'rv-seg-btn' + (tab === t ? ' on' : '')} onClick={() => setTab(t)} aria-pressed={tab === t}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {isStatic ? (
        <span className="rv-scope-static">{scopeLabel}</span>
      ) : (
        <div className="rv-scope">
          <button className="rv-chev" onClick={onPrev} disabled={prevDisabled} aria-label="Previous period">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div className="rv-scope-chip">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            {scopeLabel}
          </div>
          <button className="rv-chev" onClick={onNext} disabled={nextDisabled} aria-label="Next period">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      )}
    </div>
  );
}

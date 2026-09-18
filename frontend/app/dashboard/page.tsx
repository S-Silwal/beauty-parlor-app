// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { initSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import Link from 'next/link';

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

interface Booking {
  id: string;
  service: { id: string; name: string; duration?: number };
  staff?: { id: string; name: string } | null;
  staff_id?: string | null;
  service_id: string;
  appointment_date: string;
  status: AppointmentStatus;
  total_price: number;
  notes?: string;
}

interface MyReview {
  rating: number;
  comment?: string | null;
}

interface ChangeRequest {
  id: string;
  appointment_id: string;
  type: 'EDIT' | 'CANCEL';
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN';
  requested_date?: string | null;
  requestedStaff?: { id: string; name: string } | null;
  requestedService?: { id: string; name: string } | null;
}

interface ServiceOption {
  id: string;
  name: string;
  duration?: number;
}

interface StaffOption {
  id: string;
  name: string;
}

// Local calendar date/time parts of an ISO string — never derive these via
// toISOString() or a UTC-based parse, which silently shift the displayed
// day/time in negative-UTC-offset zones (the exact bug already fixed
// elsewhere in this app's date handling).
function localDateAndSlot(iso: string): { date: string; slot: string } {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const slot = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, slot };
}

function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSlotTime(slot: string): string {
  if (!slot) return '';
  const [hour, minute] = slot.split(':').map(Number);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;
}

// A five-star picker — used both to collect a new rating (clickable) and to
// render an already-submitted one (readOnly just disables the handlers).
function StarPicker({
  value, onChange, readOnly = false,
}: { value: number; onChange?: (n: number) => void; readOnly?: boolean }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div style={{ display: 'flex', gap: 4 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => !readOnly && onChange?.(n)}
          style={{
            fontSize: 20, lineHeight: 1, background: 'none', border: 'none', padding: 0,
            color: n <= shown ? '#B89A6A' : '#DCD3C4',
            cursor: readOnly ? 'default' : 'pointer',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
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
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [greeting] = useState(getGreeting()); // computed once on mount

  // ── Post-service ratings (History tab) ────────────────────────────────────
  const [reviews, setReviews]         = useState<Record<string, MyReview>>({});
  const [openRatingId, setOpenRatingId] = useState<string | null>(null);
  const [draftRating, setDraftRating]   = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [ratingError, setRatingError]   = useState('');

  // ── Edit/cancel requests (Upcoming tab) ────────────────────────────────────
  // Keyed by appointment_id — only ever holds a booking's currently PENDING
  // request, if it has one, so the UI knows to show "awaiting approval"
  // instead of the Edit/Cancel buttons (one live request per booking).
  const [changeRequests, setChangeRequests] = useState<Record<string, ChangeRequest>>({});
  const [servicesList, setServicesList]     = useState<ServiceOption[]>([]);
  const [staffList, setStaffList]           = useState<StaffOption[]>([]);

  const [openEditId, setOpenEditId]         = useState<string | null>(null);
  const [editDate, setEditDate]             = useState('');
  const [editSlot, setEditSlot]             = useState('');
  const [editStaffId, setEditStaffId]       = useState('');
  const [editServiceId, setEditServiceId]   = useState('');
  const [editSlots, setEditSlots]           = useState<string[]>([]);
  const [editSlotsLoading, setEditSlotsLoading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError]           = useState('');

  const [openCancelId, setOpenCancelId]         = useState<string | null>(null);
  const [cancelReason, setCancelReason]         = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError]           = useState('');
  const [withdrawingId, setWithdrawingId]       = useState<string | null>(null);

  // ── Route protection ──────────────────────────────────────────────────────
  // Wait for AuthContext to finish its async /api/auth/me check before
  // deciding to redirect — otherwise a genuinely logged-in user gets
  // bounced to /login on every refresh because `user` starts as null.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    // Admins should not see customer dashboard
    if (isAdmin) {
      router.push('/admin');
    }
  }, [user, isAdmin, authLoading, router]);

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

  // ── Fetch this customer's own submitted reviews ──────────────────────────
  // Keyed by appointment_id so a completed booking's card can tell whether
  // it's already been rated (and show that rating) or still needs the
  // rating form.
  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const data = await api.getMyReviews(token);
      if (data.success) {
        const map: Record<string, MyReview> = {};
        for (const r of data.reviews || []) {
          map[r.appointment_id] = { rating: r.rating, comment: r.comment };
        }
        setReviews(map);
      }
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    }
  };

  // ── Fetch this customer's own pending change requests ────────────────────
  const fetchChangeRequests = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const data = await api.getMyChangeRequests(token);
      if (data.success) {
        const map: Record<string, ChangeRequest> = {};
        for (const r of data.requests || []) {
          if (r.status === 'PENDING') map[r.appointment_id] = r;
        }
        setChangeRequests(map);
      }
    } catch (err) {
      console.error('Failed to fetch change requests', err);
    }
  };

  // Services/staff options for the Edit-booking form's dropdowns.
  const fetchEditOptions = async () => {
    try {
      const [servicesRes, staffRes] = await Promise.all([api.getServices(), api.getStaff()]);
      if (servicesRes.success) setServicesList(servicesRes.services || []);
      if (staffRes?.success) setStaffList(staffRes.staff || []);
    } catch (err) {
      console.error('Failed to load services/staff', err);
    }
  };

  useEffect(() => {
    if (!user || isAdmin) return;

    (async () => {
      await Promise.all([fetchBookings(), fetchReviews(), fetchChangeRequests(), fetchEditOptions()]);
    })();

    const socket = initSocket();
    socket.on('bookingCreated', fetchBookings);
    socket.on('bookingUpdated', () => {
      fetchBookings();
      fetchReviews();
    });
    // An admin approved/declined one of this customer's requests — refresh
    // both the booking (its date/staff/status may have just changed) and
    // the request map (so the "awaiting approval" banner clears).
    socket.on('changeRequestResolved', () => {
      fetchBookings();
      fetchChangeRequests();
    });
    return () => {
      socket.off('bookingCreated');
      socket.off('bookingUpdated');
      socket.off('changeRequestResolved');
    };
  }, [user, isAdmin]);

  // Re-fetch available times whenever the edit form's date/staff/service
  // selection changes, so the picker only ever offers slots that are
  // actually free for that combination.
  useEffect(() => {
    if (!openEditId || !editDate) return;
    let cancelled = false;
    (async () => {
      setEditSlotsLoading(true);
      try {
        const res = await api.getAvailableSlots(editDate, editStaffId || undefined, editServiceId || undefined);
        let slots: string[] = res.success ? (res.data?.availableSlots || []) : [];

        // The booking being edited is itself an existing appointment for
        // this staff+time, so the slots endpoint (which has no notion of
        // "self") excludes it like any other conflict. If the date/staff
        // in the form still match the original booking, put its own slot
        // back in so it doesn't look unavailable to the person who holds it.
        const original = bookings.find(b => b.id === openEditId);
        if (original) {
          const { date: origDate, slot: origSlot } = localDateAndSlot(original.appointment_date);
          const origStaff = original.staff_id || '';
          if (editDate === origDate && (editStaffId || '') === origStaff && !slots.includes(origSlot)) {
            slots = [...slots, origSlot].sort();
          }
        }

        if (!cancelled) setEditSlots(slots);
      } catch {
        if (!cancelled) setEditSlots([]);
      } finally {
        if (!cancelled) setEditSlotsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [openEditId, editDate, editStaffId, editServiceId, bookings]);

  // ── Rating form handlers ──────────────────────────────────────────────────
  const openRatingForm = (bookingId: string) => {
    setOpenRatingId(bookingId);
    setDraftRating(0);
    setDraftComment('');
    setRatingError('');
  };

  const closeRatingForm = () => {
    setOpenRatingId(null);
    setRatingError('');
  };

  const submitRating = async (bookingId: string) => {
    if (draftRating < 1) {
      setRatingError('Please select a star rating.');
      return;
    }
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }

    setSubmittingId(bookingId);
    setRatingError('');
    try {
      const res = await api.submitReview(
        { appointment_id: bookingId, rating: draftRating, comment: draftComment.trim() || undefined },
        token
      );
      if (res.success) {
        setReviews(prev => ({
          ...prev,
          [bookingId]: { rating: draftRating, comment: draftComment.trim() || undefined },
        }));
        setOpenRatingId(null);
      } else {
        setRatingError(res.message || 'Failed to submit rating');
      }
    } catch {
      setRatingError('Failed to submit rating. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  // ── Edit-request form handlers ────────────────────────────────────────────
  const openEditForm = (booking: Booking) => {
    const { date, slot } = localDateAndSlot(booking.appointment_date);
    setOpenCancelId(null);
    setOpenEditId(booking.id);
    setEditDate(date);
    setEditSlot(slot);
    setEditStaffId(booking.staff_id || '');
    setEditServiceId(booking.service_id);
    setEditSlots([]);
    setEditError('');
  };

  const closeEditForm = () => {
    setOpenEditId(null);
    setEditError('');
  };

  const submitEditRequest = async (booking: Booking) => {
    const { date: origDate, slot: origSlot } = localDateAndSlot(booking.appointment_date);
    const origStaffId = booking.staff_id || '';

    const dateChanged    = editDate !== origDate || editSlot !== origSlot;
    const staffChanged   = !!editStaffId && editStaffId !== origStaffId;
    const serviceChanged = !!editServiceId && editServiceId !== booking.service_id;

    if (!dateChanged && !staffChanged && !serviceChanged) {
      setEditError('Change the date, time, staff, or service before submitting.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }

    setEditSubmitting(true);
    setEditError('');
    try {
      // Every edit goes through admin approval, however far away the
      // appointment is — the live booking must not change until it's
      // accepted. Only send what actually changed — an empty payload has
      // nothing for an admin to approve, and the backend requires at
      // least one field.
      const payload: { requested_date?: string; requested_staff_id?: string; requested_service_id?: string } = {};
      if (dateChanged) payload.requested_date = `${editDate}T${editSlot}:00`;
      if (staffChanged) payload.requested_staff_id = editStaffId;
      if (serviceChanged) payload.requested_service_id = editServiceId;

      const res = await api.requestEditBooking(booking.id, payload, token);
      if (res.success) {
        setChangeRequests(prev => ({ ...prev, [booking.id]: res.request }));
        setOpenEditId(null);
      } else {
        setEditError(res.message || 'Failed to submit request');
      }
    } catch {
      setEditError('Failed to submit request. Please try again.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Cancel-request form handlers ──────────────────────────────────────────
  const openCancelForm = (bookingId: string) => {
    setOpenEditId(null);
    setOpenCancelId(bookingId);
    setCancelReason('');
    setCancelError('');
  };

  const closeCancelForm = () => {
    setOpenCancelId(null);
    setCancelError('');
  };

  const submitCancelRequest = async (bookingId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }

    setCancelSubmitting(true);
    setCancelError('');
    try {
      // Cancelling, like editing, always goes through admin approval — the
      // live booking stays on its original slot/status until an admin
      // accepts this request.
      const res = await api.requestCancelBooking(bookingId, cancelReason.trim() || undefined, token);
      if (res.success) {
        setChangeRequests(prev => ({ ...prev, [bookingId]: res.request }));
        setOpenCancelId(null);
      } else {
        setCancelError(res.message || 'Failed to submit cancellation request');
      }
    } catch {
      setCancelError('Failed to submit cancellation request. Please try again.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Pulls a still-PENDING request back before an admin has acted on it —
  // the booking itself was never touched while it was pending, so there's
  // nothing to undo there; this just removes the request.
  const withdrawRequest = async (bookingId: string, requestId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }

    setWithdrawingId(requestId);
    try {
      const res = await api.withdrawChangeRequest(requestId, token);
      if (res.success) {
        setChangeRequests(prev => {
          const next = { ...prev };
          delete next[bookingId];
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to withdraw request', err);
    } finally {
      setWithdrawingId(null);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const now      = new Date();
  // RESCHEDULED counts as an active, still-upcoming status here — it means
  // an admin (directly, from Bookings) moved this booking to a new time,
  // not that it's done. Approving a customer's own edit request now keeps
  // the appointment CONFIRMED rather than writing RESCHEDULED (see
  // ChangeRequestService.resolve), so a customer-initiated edit never hits
  // this branch at all — this only matters for a possible future
  // admin-direct-reschedule action. Bucketing by status alone here (the
  // previous bug) buried a same-day-or-later RESCHEDULED booking in
  // History even though it hadn't happened yet; date is what actually
  // decides "upcoming" vs "history", not this one status.
  const upcoming = bookings.filter(b =>
    ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(b.status) &&
    new Date(b.appointment_date) >= now
  );
  const history  = bookings.filter(b =>
    ['COMPLETED', 'CANCELLED'].includes(b.status) ||
    new Date(b.appointment_date) < now
  );

  const nextAppt = upcoming.sort(
    (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
  )[0];

  const totalSpent = bookings
    .filter(b => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + Number(b.total_price), 0);

  const displayed = activeTab === 'upcoming' ? upcoming : history;

  if (authLoading || !user || isAdmin) return null;

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
        .db-card { background:#fff; border:1px solid #EDE6DC; border-radius:6px; padding:24px 28px; display:flex; flex-direction:column; gap:16px; transition:box-shadow .2s; }
        .db-card:hover { box-shadow:0 4px 20px rgba(44,40,37,.07); }
        .db-card-top { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .db-card-service { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:500; color:#2C2825; margin:0 0 5px; }
        .db-card-meta { font-size:13px; font-weight:300; color:#9E968E; }
        .db-card-right { text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
        .db-status { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.06em; }
        .db-price { font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:500; color:#2C2825; }

        /* Post-service rating */
        .db-rate { border-top:1px solid #EDE6DC; padding-top:16px; }
        .db-rate-label { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#9E968E; margin-bottom:10px; }
        .db-rate-comment { font-size:13px; font-weight:300; color:#6B635A; font-style:italic; margin-top:10px; }
        .db-rate-textarea { width:100%; margin-top:12px; padding:12px 14px; border:1px solid #EDE6DC; border-radius:6px; font-family:'Jost',sans-serif; font-size:13px; color:#2C2825; resize:vertical; min-height:72px; }
        .db-rate-textarea:focus { outline:none; border-color:#B89A6A; }
        .db-rate-actions { display:flex; gap:10px; margin-top:14px; }
        .db-rate-error { font-size:12px; color:#B91C1C; margin-top:8px; }
        .db-rate-trigger { background:none; border:none; padding:0; font-family:'Jost',sans-serif; font-size:13px; font-weight:600; color:#B89A6A; cursor:pointer; transition:color .2s; }
        .db-rate-trigger:hover { color:#8F7850; }

        /* Edit / cancel requests */
        .db-change { border-top:1px solid #EDE6DC; padding-top:16px; }
        .db-change-pending { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#FEF3C7; border-radius:6px; }
        .db-change-pending-dot { width:7px; height:7px; border-radius:50%; background:#F59E0B; flex-shrink:0; }
        .db-change-pending-text { font-size:13px; color:#92400E; font-weight:500; }
        .db-change-actions { display:flex; gap:20px; }
        .db-change-link { background:none; border:none; padding:0; font-family:'Jost',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:color .2s; }
        .db-change-link.edit { color:#2C2825; }
        .db-change-link.edit:hover { color:#B89A6A; }
        .db-change-link.cancel { color:#B91C1C; }
        .db-change-link.cancel:hover { color:#7F1D1D; }
        .db-edit-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-top:12px; }
        .db-edit-field label { display:block; font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#9E968E; margin-bottom:6px; }
        .db-edit-field select, .db-edit-field input[type="date"] { width:100%; padding:10px 12px; border:1px solid #EDE6DC; border-radius:6px; font-family:'Jost',sans-serif; font-size:13px; color:#2C2825; background:#fff; }
        .db-edit-field select:focus, .db-edit-field input:focus { outline:none; border-color:#B89A6A; }
        .db-slot-grid { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
        .db-slot-btn { padding:8px 14px; border-radius:6px; border:1px solid #EDE6DC; background:#fff; font-family:'Jost',sans-serif; font-size:12px; color:#2C2825; cursor:pointer; transition:all .15s; }
        .db-slot-btn.on { background:#2C2825; color:#F7F3EE; border-color:#2C2825; }
        .db-slot-btn:hover:not(.on) { border-color:#B89A6A; color:#B89A6A; }
        .db-action-danger { background:#B91C1C; color:#fff; border:none; padding:10px 22px; border-radius:3px; font-family:'Jost',sans-serif; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; transition:background .2s; }
        .db-action-danger:hover { background:#7F1D1D; }
        .db-action-danger:disabled { opacity:.6; cursor:not-allowed; }

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
          .db-card-top { flex-direction:column; align-items:flex-start; }
          .db-card-right { align-items:flex-start; text-align:left; }
          .db-edit-grid { grid-template-columns:1fr; }
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
              const style     = STATUS_STYLE[booking.status];
              const apptDate  = new Date(booking.appointment_date);
              const canRate   = booking.status === 'COMPLETED';
              const myReview  = reviews[booking.id];
              // Upcoming (PENDING/CONFIRMED) bookings can have an edit or
              // cancellation requested — completed/cancelled ones cannot.
              const canRequestChange = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
              const pendingRequest   = changeRequests[booking.id];
              return (
                <div key={booking.id} className="db-card">
                  <div className="db-card-top">
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
                          &quot;{booking.notes}&quot;
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

                  {/* Rating: only offered once the service has actually been
                      delivered (status COMPLETED). One rating per booking —
                      once submitted, the card just shows what was left. */}
                  {canRate && (
                    <div className="db-rate">
                      {myReview ? (
                        <div>
                          <p className="db-rate-label">Your Rating</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <StarPicker value={myReview.rating} readOnly />
                            <span style={{ fontSize: 13, color: '#9E968E' }}>{myReview.rating}/5</span>
                          </div>
                          {myReview.comment && (
                            <p className="db-rate-comment">&quot;{myReview.comment}&quot;</p>
                          )}
                        </div>
                      ) : openRatingId === booking.id ? (
                        <div>
                          <p className="db-rate-label">Rate This Service</p>
                          <StarPicker value={draftRating} onChange={setDraftRating} />
                          <textarea
                            className="db-rate-textarea"
                            value={draftComment}
                            onChange={e => setDraftComment(e.target.value)}
                            placeholder="Share your experience (optional)"
                            maxLength={500}
                          />
                          {ratingError && <p className="db-rate-error">{ratingError}</p>}
                          <div className="db-rate-actions">
                            <button
                              type="button"
                              className="db-btn-primary"
                              style={{ border: 'none', fontSize: 11, padding: '10px 22px' }}
                              onClick={() => submitRating(booking.id)}
                              disabled={submittingId === booking.id}
                            >
                              {submittingId === booking.id ? 'Submitting…' : 'Submit Rating'}
                            </button>
                            <button
                              type="button"
                              className="db-btn-ghost"
                              style={{ fontSize: 11, padding: '10px 22px' }}
                              onClick={closeRatingForm}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" className="db-rate-trigger" onClick={() => openRatingForm(booking.id)}>
                          ★ Rate this service
                        </button>
                      )}
                    </div>
                  )}

                  {/* Edit / cancel request: only offered on upcoming bookings,
                      and only one live request per booking — once submitted,
                      the card shows "awaiting approval" instead of the form. */}
                  {canRequestChange && (
                    <div className="db-change">
                      {pendingRequest ? (
                        <div className="db-change-pending" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="db-change-pending-dot" />
                            <span className="db-change-pending-text">
                              {pendingRequest.type === 'CANCEL' ? 'Cancellation requested' : 'Change requested'} — awaiting salon approval
                            </span>
                          </div>
                          {/* Original booking is unchanged and still shown in the
                              card above — this is just the proposed new slot, so
                              the customer can see exactly what they asked for. */}
                          {pendingRequest.type === 'EDIT' && (
                            <p style={{ fontSize: 12, color: '#92400E', marginLeft: 17 }}>
                              Requested:{' '}
                              {pendingRequest.requested_date
                                ? new Date(pendingRequest.requested_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
                                  ' · ' +
                                  new Date(pendingRequest.requested_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                : 'same time'}
                              {pendingRequest.requestedStaff && ` · ${pendingRequest.requestedStaff.name}`}
                              {pendingRequest.requestedService && ` · ${pendingRequest.requestedService.name}`}
                            </p>
                          )}
                          <button
                            type="button"
                            className="db-change-link cancel"
                            style={{ alignSelf: 'flex-start', marginLeft: 17 }}
                            disabled={withdrawingId === pendingRequest.id}
                            onClick={() => withdrawRequest(booking.id, pendingRequest.id)}
                          >
                            {withdrawingId === pendingRequest.id ? 'Withdrawing…' : 'Withdraw request'}
                          </button>
                        </div>
                      ) : openEditId === booking.id ? (
                        <div>
                          <p className="db-rate-label">Request a Change</p>
                          <div className="db-edit-grid">
                            <div className="db-edit-field">
                              <label>Service</label>
                              <select value={editServiceId} onChange={e => setEditServiceId(e.target.value)}>
                                {servicesList.length === 0 && <option value={editServiceId}>{booking.service.name}</option>}
                                {servicesList.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="db-edit-field">
                              <label>Staff</label>
                              <select value={editStaffId} onChange={e => setEditStaffId(e.target.value)}>
                                {!booking.staff_id && <option value="">No preference</option>}
                                {staffList.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="db-edit-field">
                              <label>Date</label>
                              <input
                                type="date"
                                value={editDate}
                                min={localTodayStr()}
                                onChange={e => setEditDate(e.target.value)}
                              />
                            </div>
                          </div>

                          <div style={{ marginTop: 14 }}>
                            <label style={{ display:'block', fontSize:11, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'#9E968E', marginBottom:6 }}>
                              Time
                            </label>
                            <div className="db-slot-grid">
                              {editSlotsLoading ? (
                                <span style={{ fontSize:12, color:'#9E968E' }}>Loading available times…</span>
                              ) : editSlots.length === 0 ? (
                                <span style={{ fontSize:12, color:'#9E968E' }}>No available times for this date</span>
                              ) : (
                                editSlots.map(slot => (
                                  <button
                                    key={slot}
                                    type="button"
                                    className={`db-slot-btn${editSlot === slot ? ' on' : ''}`}
                                    onClick={() => setEditSlot(slot)}
                                  >
                                    {formatSlotTime(slot)}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>

                          {editError && <p className="db-rate-error">{editError}</p>}
                          <div className="db-rate-actions">
                            <button
                              type="button"
                              className="db-btn-primary"
                              style={{ border: 'none', fontSize: 11, padding: '10px 22px' }}
                              disabled={editSubmitting}
                              onClick={() => submitEditRequest(booking)}
                            >
                              {editSubmitting ? 'Submitting…' : 'Submit Change Request'}
                            </button>
                            <button
                              type="button"
                              className="db-btn-ghost"
                              style={{ fontSize: 11, padding: '10px 22px' }}
                              onClick={closeEditForm}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : openCancelId === booking.id ? (
                        <div>
                          <p className="db-rate-label">Request Cancellation</p>
                          <textarea
                            className="db-rate-textarea"
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            placeholder="Let us know why (optional)"
                            maxLength={300}
                          />
                          {cancelError && <p className="db-rate-error">{cancelError}</p>}
                          <div className="db-rate-actions">
                            <button
                              type="button"
                              className="db-action-danger"
                              disabled={cancelSubmitting}
                              onClick={() => submitCancelRequest(booking.id)}
                            >
                              {cancelSubmitting ? 'Submitting…' : 'Submit Cancellation Request'}
                            </button>
                            <button
                              type="button"
                              className="db-btn-ghost"
                              style={{ fontSize: 11, padding: '10px 22px' }}
                              onClick={closeCancelForm}
                            >
                              Never mind
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="db-change-actions">
                          <button type="button" className="db-change-link edit" onClick={() => openEditForm(booking)}>
                            Edit Booking
                          </button>
                          <button type="button" className="db-change-link cancel" onClick={() => openCancelForm(booking.id)}>
                            Cancel Booking
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

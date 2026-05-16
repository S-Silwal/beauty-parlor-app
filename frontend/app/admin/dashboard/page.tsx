'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { initSocket } from "@/lib/socket";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";

interface Booking {
  id: string;
  service: { name: string };
  staff?: { name: string };
  user: { name: string; email: string };
  appointment_date: string;
  status: AppointmentStatus;
  total_price: number;
  duration: number;
  notes?: string;
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; classes: string; dot: string }> = {
  PENDING:     { label: "Pending",     classes: "bg-amber-50 text-amber-700 border border-amber-200",       dot: "bg-amber-400" },
  CONFIRMED:   { label: "Confirmed",   classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-400" },
  COMPLETED:   { label: "Completed",   classes: "bg-sky-50 text-sky-700 border border-sky-200",             dot: "bg-sky-400" },
  CANCELLED:   { label: "Cancelled",   classes: "bg-red-50 text-red-600 border border-red-200",             dot: "bg-red-400" },
  RESCHEDULED: { label: "Rescheduled", classes: "bg-purple-50 text-purple-700 border border-purple-200",    dot: "bg-purple-400" },
};

const NEXT_ACTIONS: Partial<Record<AppointmentStatus, { label: string; next: AppointmentStatus; color: string }[]>> = {
  PENDING:   [
    { label: "Confirm",  next: "CONFIRMED", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { label: "Cancel",   next: "CANCELLED", color: "bg-red-100 hover:bg-red-200 text-red-700" },
  ],
  CONFIRMED: [
    { label: "Complete", next: "COMPLETED", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    { label: "Cancel",   next: "CANCELLED", color: "bg-red-100 hover:bg-red-200 text-red-700" },
  ],
};

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AppointmentStatus | "ALL">("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newBookingIds, setNewBookingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/dashboard');
  }, [user, isAdmin, router]);

  const fetchBookings = async (highlightNew?: string) => {
    try {
      const token = api.getToken();
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/appointments/all`,
        { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }
      );
      const data = await res.json();
      if (data.success) {
        setBookings(data.appointments || []);
        if (highlightNew) {
          setNewBookingIds(prev => new Set(prev).add(highlightNew));
          setTimeout(() => {
            setNewBookingIds(prev => {
              const next = new Set(prev);
              next.delete(highlightNew);
              return next;
            });
          }, 5000);
        }
      }
    } catch (err) {
      console.error("Failed to fetch bookings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !isAdmin) return;
    fetchBookings();

    const socket = initSocket();

    socket.on('bookingCreated', (booking: Booking) => {
      fetchBookings(booking?.id);
    });
    socket.on('bookingUpdated', () => fetchBookings());

    return () => {
      socket.off('bookingCreated');
      socket.off('bookingUpdated');
    };
  }, [user, isAdmin]);

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setUpdatingId(id);
    try {
      const token = api.getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/appointments/${id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({ status }),
        }
      );
      const data = await res.json();
      if (data.success) {
        // Optimistic update — socket will also trigger a full refetch
        setBookings(prev =>
          prev.map(b => (b.id === id ? { ...b, status } : b))
        );
      }
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = filter === "ALL" ? bookings : bookings.filter(b => b.status === filter);

  const stats = {
    total:    bookings.length,
    pending:  bookings.filter(b => b.status === "PENDING").length,
    confirmed: bookings.filter(b => b.status === "CONFIRMED").length,
    revenue:  bookings.filter(b => b.status === "CONFIRMED" || b.status === "COMPLETED")
                      .reduce((s, b) => s + Number(b.total_price), 0),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F0EB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#2C1A0E] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#8B6244] font-medium">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      {/* Header */}
      <div className="bg-[#2C1A0E] text-white px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#C9956B] font-semibold mb-1">Admin Panel</p>
            <h1 className="text-2xl font-semibold">Crown & Glow Dashboard</h1>
          </div>
          <div className="text-right">
            <p className="text-[#C9956B] text-sm">{user?.name}</p>
            <p className="text-white/40 text-xs">Administrator</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Bookings", value: stats.total,     color: "text-[#2C1A0E]",   sub: "all time" },
            { label: "Pending",        value: stats.pending,   color: "text-amber-600",   sub: "need action" },
            { label: "Confirmed",      value: stats.confirmed, color: "text-emerald-600", sub: "upcoming" },
            { label: "Revenue",        value: `$${stats.revenue}`, color: "text-[#2C1A0E]", sub: "confirmed + completed" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-[#E5DDD4] shadow-sm">
              <p className="text-xs text-[#8B6244] uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-3xl font-light ${color}`}>{value}</p>
              <p className="text-xs text-[#B8A898] mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* New booking alert */}
        {newBookingIds.size > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 flex items-center gap-3 animate-pulse">
            <span className="text-emerald-500 text-lg">🔔</span>
            <p className="font-semibold text-emerald-800 text-sm">
              New booking just received! Scroll down to review and confirm.
            </p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === s
                  ? "bg-[#2C1A0E] text-white border-[#2C1A0E]"
                  : "bg-white text-[#8B6244] border-[#E5DDD4] hover:border-[#C9956B]"
              }`}
            >
              {s === "ALL" ? "All Bookings" : STATUS_CONFIG[s].label}
              <span className="ml-1.5 opacity-60">
                {s === "ALL" ? bookings.length : bookings.filter(b => b.status === s).length}
              </span>
            </button>
          ))}
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-3xl border border-[#E5DDD4] overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[#8B6244]">No bookings in this category.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0EAE3]">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr_1.2fr] gap-4 px-6 py-3 bg-[#FAF7F4]">
                {["Customer", "Service", "Date & Time", "Staff", "Status", "Actions"].map(h => (
                  <p key={h} className="text-xs font-semibold text-[#8B6244] uppercase tracking-wide">{h}</p>
                ))}
              </div>

              {filtered.map((booking) => {
                const config = STATUS_CONFIG[booking.status];
                const date = new Date(booking.appointment_date);
                const actions = NEXT_ACTIONS[booking.status];
                const isNew = newBookingIds.has(booking.id);

                return (
                  <div
                    key={booking.id}
                    className={`px-6 py-5 flex flex-col md:grid md:grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr_1.2fr] gap-4 md:items-center transition-colors ${
                      isNew ? "bg-emerald-50" : "hover:bg-[#FAF7F4]"
                    }`}
                  >
                    {/* Customer */}
                    <div>
                      <p className="font-semibold text-[#2C1A0E] text-sm">{booking.user.name}</p>
                      <p className="text-xs text-[#8B6244] mt-0.5 truncate">{booking.user.email}</p>
                    </div>

                    {/* Service */}
                    <div>
                      <p className="text-sm text-[#2C1A0E] font-medium">{booking.service.name}</p>
                      <p className="text-xs text-[#8B6244]">₹{booking.total_price} · {booking.duration}min</p>
                    </div>

                    {/* Date */}
                    <div>
                      <p className="text-sm text-[#2C1A0E]">
                        {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-[#8B6244]">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Staff */}
                    <p className="text-sm text-[#8B6244]">{booking.staff?.name || "Any"}</p>

                    {/* Status */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-fit ${config.classes}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                      {config.label}
                    </span>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {actions ? (
                        actions.map(({ label, next, color }) => (
                          <button
                            key={next}
                            disabled={updatingId === booking.id}
                            onClick={() => updateStatus(booking.id, next)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${color}`}
                          >
                            {updatingId === booking.id ? "…" : label}
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-[#B8A898]">No actions</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

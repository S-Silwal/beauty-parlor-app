// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { initSocket } from "@/lib/socket";
import Link from "next/link";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";

interface Booking {
  id: string;
  service: { name: string; category: string };
  staff?: { name: string };
  appointment_date: string;
  status: AppointmentStatus;
  total_price: number;
  duration: number;
  notes?: string;
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; classes: string; dot: string }> = {
  PENDING:     { label: "Awaiting Confirmation", classes: "bg-amber-50 text-amber-700 border border-amber-200",  dot: "bg-amber-400" },
  CONFIRMED:   { label: "Confirmed",             classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-400" },
  COMPLETED:   { label: "Completed",             classes: "bg-sky-50 text-sky-700 border border-sky-200",        dot: "bg-sky-400" },
  CANCELLED:   { label: "Cancelled",             classes: "bg-red-50 text-red-600 border border-red-200",        dot: "bg-red-400" },
  RESCHEDULED: { label: "Rescheduled",           classes: "bg-purple-50 text-purple-700 border border-purple-200", dot: "bg-purple-400" },
};

export default function CustomerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AppointmentStatus | "ALL">("ALL");

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  const fetchBookings = async () => {
    try {
      const token = api.getToken();
      if (!token) return;
      const data = await api.getMyBookings(token);
      if (data.success) setBookings(data.appointments || []);
    } catch (err) {
      console.error("Failed to fetch bookings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchBookings();

    const socket = initSocket();
    socket.on('bookingCreated', fetchBookings);
    socket.on('bookingUpdated', fetchBookings);
    return () => {
      socket.off('bookingCreated', fetchBookings);
      socket.off('bookingUpdated', fetchBookings);
    };
  }, [user]);

  const filtered = filter === "ALL" ? bookings : bookings.filter(b => b.status === filter);
  const upcoming = bookings.filter(b => b.status === "CONFIRMED" && new Date(b.appointment_date) > new Date());
  const pending  = bookings.filter(b => b.status === "PENDING");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F4] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#C9956B] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#8B6244] font-medium">Loading your appointments…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4]">
      {/* Header */}
      <div className="bg-white border-b border-[#EDE8E1] px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#C9956B] font-semibold mb-1">My Account</p>
            <h1 className="text-2xl font-semibold text-[#2C1A0E]">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
          </div>
          <Link
            href="/booking"
            className="bg-[#C9956B] hover:bg-[#b8845c] text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-colors shadow-sm"
          >
            + New Booking
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Bookings", value: bookings.length, color: "text-[#2C1A0E]" },
            { label: "Upcoming",       value: upcoming.length, color: "text-emerald-600" },
            { label: "Pending",        value: pending.length,  color: "text-amber-600" },
            { label: "Completed",      value: bookings.filter(b => b.status === "COMPLETED").length, color: "text-sky-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-[#EDE8E1] shadow-sm">
              <p className="text-xs text-[#8B6244] uppercase tracking-wide mb-2">{label}</p>
              <p className={`text-3xl font-light ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Pending notice banner */}
        {pending.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-start gap-3">
            <span className="text-amber-500 text-lg mt-0.5">⏳</span>
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                {pending.length} booking{pending.length > 1 ? 's' : ''} awaiting confirmation
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                Our team will confirm your appointment soon. You'll see the status update here in real time.
              </p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        {bookings.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {(["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filter === s
                    ? "bg-[#2C1A0E] text-white border-[#2C1A0E]"
                    : "bg-white text-[#8B6244] border-[#EDE8E1] hover:border-[#C9956B]"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_CONFIG[s].label}
                {s !== "ALL" && (
                  <span className="ml-1.5 opacity-60">
                    {bookings.filter(b => b.status === s).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Bookings List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#EDE8E1] p-16 text-center">
            <p className="text-4xl mb-4">✨</p>
            <p className="text-[#2C1A0E] font-semibold text-lg mb-2">No appointments yet</p>
            <p className="text-[#8B6244] text-sm mb-6">Book your first appointment and treat yourself.</p>
            <Link href="/booking" className="text-[#C9956B] text-sm font-semibold underline underline-offset-4">
              Browse services →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((booking) => {
              const config = STATUS_CONFIG[booking.status];
              const date = new Date(booking.appointment_date);
              const isPast = date < new Date();
              return (
                <div
                  key={booking.id}
                  className={`bg-white rounded-2xl border border-[#EDE8E1] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-opacity ${
                    booking.status === "CANCELLED" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#FAF7F4] flex items-center justify-center text-xl shrink-0">
                      💆
                    </div>
                    <div>
                      <p className="font-semibold text-[#2C1A0E]">{booking.service.name}</p>
                      <p className="text-[#8B6244] text-sm mt-0.5">
                        {date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {booking.staff && (
                        <p className="text-xs text-[#8B6244] mt-0.5">with {booking.staff.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 md:flex-col md:items-end">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config.classes}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                      {config.label}
                    </span>
                    <p className="font-semibold text-[#2C1A0E]">${booking.total_price}</p>   {/* ← Only this changed to $ */}
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
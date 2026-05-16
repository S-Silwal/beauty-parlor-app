"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MyBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/appointments/my-bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBookings(data.appointments || []);
    } catch (err) {
      console.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-20">Loading your appointments...</div>;

  return (
    <div className="min-h-screen bg-[#f8f1e9] py-12">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-5xl font-serif text-center mb-12">My Appointments</h1>

        {bookings.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl shadow">
            <p className="text-2xl text-[#6b5c4d]">You have no appointments yet.</p>
            <a href="/appointments/book" className="inline-block mt-8 bg-[#3f2a1e] text-white px-10 py-4 rounded-2xl text-lg font-medium hover:bg-black transition">
              Book Your First Appointment
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-white p-8 rounded-3xl shadow flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-semibold">{booking.service?.name || "Service"}</h3>
                  <p className="text-gray-600 mt-2">
                    {new Date(booking.appointment_date).toLocaleDateString()} at {new Date(booking.appointment_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>

                <div>
                  <span className={`px-6 py-2 rounded-full text-sm font-medium ${
                    booking.status === "CONFIRMED" ? "bg-green-100 text-green-700" : 
                    booking.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {booking.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
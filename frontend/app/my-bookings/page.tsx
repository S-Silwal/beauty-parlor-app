"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Booking {
  id: string;
  service?: { name: string };
  appointment_date: string;
  status: string;
}

interface MyReview {
  appointment_id: string;
  rating: number;
  comment?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED:   "bg-green-100 text-green-700",
  PENDING:     "bg-amber-100 text-amber-700",
  COMPLETED:   "bg-blue-100 text-blue-700",
  CANCELLED:   "bg-red-100 text-red-700",
  RESCHEDULED: "bg-purple-100 text-purple-700",
};

// A five-star picker used both to collect a new rating and to render an
// already-submitted one (readOnly just disables the click handlers).
function StarPicker({
  value, onChange, readOnly = false,
}: { value: number; onChange?: (n: number) => void; readOnly?: boolean }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => !readOnly && onChange?.(n)}
          className={readOnly ? "cursor-default" : "cursor-pointer"}
          style={{ fontSize: 22, lineHeight: 1, color: n <= shown ? "#D4A017" : "#D9D2C7", background: "none", border: "none", padding: 0 }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews]   = useState<Record<string, MyReview>>({});
  const [loading, setLoading]   = useState(true);
  const router = useRouter();

  // Which booking's "rate this service" form is currently open, and its draft.
  const [openId, setOpenId]         = useState<string | null>(null);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [formError, setFormError]   = useState("");

  const fetchAll = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const [bookingsData, reviewsData] = await Promise.all([
        api.getMyBookings(token),
        api.getMyReviews(token),
      ]);

      if (bookingsData.success) {
        setBookings(bookingsData.appointments || []);
      } else {
        // Token present but rejected (expired/invalid) — don't show a
        // misleading "no appointments" empty state, send them to log in.
        api.removeToken();
        router.push("/login");
        return;
      }

      if (reviewsData.success) {
        const map: Record<string, MyReview> = {};
        for (const r of reviewsData.reviews || []) map[r.appointment_id] = r;
        setReviews(map);
      }
    } catch {
      console.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      await fetchAll();
    })();
  }, [fetchAll]);

  const openRatingForm = (bookingId: string) => {
    setOpenId(bookingId);
    setDraftRating(0);
    setDraftComment("");
    setFormError("");
  };

  const closeRatingForm = () => {
    setOpenId(null);
    setFormError("");
  };

  const submitRating = async (bookingId: string) => {
    if (draftRating < 1) {
      setFormError("Please select a star rating.");
      return;
    }
    const token = api.getToken();
    if (!token) { router.push("/login"); return; }

    setSubmittingId(bookingId);
    setFormError("");
    try {
      const res = await api.submitReview(
        { appointment_id: bookingId, rating: draftRating, comment: draftComment.trim() || undefined },
        token
      );
      if (res.success) {
        setReviews(prev => ({ ...prev, [bookingId]: { appointment_id: bookingId, rating: draftRating, comment: draftComment.trim() || undefined } }));
        setOpenId(null);
      } else {
        setFormError(res.message || "Failed to submit rating");
      }
    } catch {
      setFormError("Failed to submit rating. Please try again.");
    } finally {
      setSubmittingId(null);
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
            <a href="/booking" className="inline-block mt-8 bg-[#3f2a1e] text-white px-10 py-4 rounded-2xl text-lg font-medium hover:bg-black transition">
              Book Your First Appointment
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => {
              const myReview = reviews[booking.id];
              const canRate  = booking.status === "COMPLETED";
              return (
                <div key={booking.id} className="bg-white p-8 rounded-3xl shadow">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-semibold">{booking.service?.name || "Service"}</h3>
                      <p className="text-gray-600 mt-2">
                        {new Date(booking.appointment_date).toLocaleDateString()} at {new Date(booking.appointment_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>

                    <div>
                      <span className={`px-6 py-2 rounded-full text-sm font-medium ${STATUS_STYLES[booking.status] || "bg-gray-100 text-gray-600"}`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>

                  {/* Rating: only offered once the service has actually been
                      delivered (status COMPLETED) — a Confirmed-but-not-yet-
                      -delivered booking gets no rating affordance at all. */}
                  {canRate && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      {myReview ? (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Your rating</p>
                          <div className="flex items-center gap-3">
                            <StarPicker value={myReview.rating} readOnly />
                            <span className="text-sm text-gray-500">{myReview.rating}/5</span>
                          </div>
                          {myReview.comment && (
                            <p className="text-sm text-gray-500 italic mt-2">&quot;{myReview.comment}&quot;</p>
                          )}
                        </div>
                      ) : openId === booking.id ? (
                        <div>
                          <p className="text-sm font-medium mb-2">Rate this service</p>
                          <StarPicker value={draftRating} onChange={setDraftRating} />
                          <textarea
                            value={draftComment}
                            onChange={e => setDraftComment(e.target.value)}
                            placeholder="Add a comment (optional)"
                            maxLength={500}
                            className="w-full mt-3 p-3 border border-gray-300 rounded-xl text-sm resize-y h-20 focus:outline-none focus:ring-2 focus:ring-pink-400"
                          />
                          {formError && <p className="text-sm text-red-600 mt-2">{formError}</p>}
                          <div className="flex gap-3 mt-3">
                            <button
                              onClick={() => submitRating(booking.id)}
                              disabled={submittingId === booking.id}
                              className="bg-[#3f2a1e] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-black transition disabled:opacity-50"
                            >
                              {submittingId === booking.id ? "Submitting…" : "Submit Rating"}
                            </button>
                            <button
                              onClick={closeRatingForm}
                              className="px-6 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openRatingForm(booking.id)}
                          className="text-sm font-medium text-pink-600 hover:text-pink-700 transition"
                        >
                          ★ Rate this service
                        </button>
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

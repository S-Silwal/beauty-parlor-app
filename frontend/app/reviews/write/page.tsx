// app/reviews/write/page.tsx
//
// Dedicated "write a review" destination — this is the page the
// "Write a Review" button in the booking-completed email links to
// (see backend/src/notifications/notification.service.ts,
// notifyBookingCompleted -> reviewUrl). Kept separate from the public
// /reviews list (read-only, no login) and from /my-bookings (the full
// appointment list) so the email has one focused landing spot.
//
// Auth/ownership/one-review-per-booking are enforced again server-side
// in ReviewService.createReview regardless of what this page shows —
// this page's job is just to get a logged-in customer to the right
// form (or the right explanation) as directly as possible.
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatSalonDate } from "@/lib/timezone";

interface Booking {
  id: string;
  service?: { name: string };
  staff?: { name: string };
  appointment_date: string;
  status: string;
}

interface MyReview {
  appointment_id: string;
  rating: number;
  comment?: string | null;
}

function StarPicker({
  value, onChange, readOnly = false,
}: { value: number; onChange?: (n: number) => void; readOnly?: boolean }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="wr-stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => !readOnly && onChange?.(n)}
          className="wr-star-btn"
          style={{ color: n <= shown ? "#B89A6A" : "#D9D2C7", cursor: readOnly ? "default" : "pointer" }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function buildNext(bookingId: string) {
  return `/login?next=${encodeURIComponent(`/reviews/write?bookingId=${bookingId}`)}`;
}

function WriteReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const [loading, setLoading]   = useState(true);
  const [booking, setBooking]   = useState<Booking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [existingReview, setExistingReview] = useState<MyReview | null>(null);

  const [rating, setRating]     = useState(0);
  const [comment, setComment]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");
  const [justSubmitted, setJustSubmitted] = useState<MyReview | null>(null);

  const loadBooking = useCallback(async () => {
    if (!bookingId) { setLoading(false); return; }

    const token = api.getToken();
    if (!token) {
      router.push(buildNext(bookingId));
      return;
    }

    try {
      const [bookingsRes, reviewsRes] = await Promise.all([
        api.getMyBookings(token),
        api.getMyReviews(token),
      ]);

      if (!bookingsRes.success) {
        // Token present but rejected (expired/invalid).
        api.removeToken();
        router.push(buildNext(bookingId));
        return;
      }

      // Only ever searches THIS customer's own bookings — if the id
      // belongs to someone else, or doesn't exist, it simply won't be
      // found here, same as the real 403/404 the API would give.
      const found: Booking | undefined = (bookingsRes.appointments || []).find(
        (b: Booking) => b.id === bookingId
      );
      setBooking(found ?? null);
      setNotFound(!found);

      if (reviewsRes.success) {
        const mine: MyReview | undefined = (reviewsRes.reviews || []).find(
          (r: MyReview) => r.appointment_id === bookingId
        );
        setExistingReview(mine ?? null);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    (async () => {
      await loadBooking();
    })();
  }, [loadBooking]);

  const handleSubmit = async () => {
    if (!bookingId) return;
    if (rating < 1) { setError("Please select a star rating."); return; }

    const token = api.getToken();
    if (!token) { router.push(buildNext(bookingId)); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await api.submitReview(
        { appointment_id: bookingId, rating, comment: comment.trim() || undefined },
        token
      );
      if (res.success) {
        setJustSubmitted({ appointment_id: bookingId, rating, comment: comment.trim() || undefined });
      } else {
        setError(res.message || "Failed to submit your review.");
      }
    } catch {
      setError("Failed to submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wr">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');

        .wr {
          --cream: #F7F3EE; --card-bg: #FDFAF6; --cream-md: #EDE6DC;
          --gold: #B89A6A; --gold-lt: #D4B896; --charcoal: #2C2825;
          --mid: #6B635A; --soft: #9E968E;
          background: var(--cream); min-height: calc(100vh - 72px);
          font-family: 'Jost', sans-serif; color: var(--charcoal);
          display: flex; align-items: flex-start; justify-content: center;
          padding: 72px 20px;
        }
        .wr-card {
          width: 100%; max-width: 560px; background: var(--card-bg);
          border: 1px solid var(--cream-md); border-radius: 10px;
          padding: 48px 44px; box-shadow: 0 4px 24px rgba(44,40,37,.06);
        }
        .wr-kicker {
          font-size: 11px; font-weight: 600; letter-spacing: .18em;
          text-transform: uppercase; color: var(--gold); margin: 0 0 14px;
        }
        .wr-h1 {
          font-family: 'Cormorant Garamond', serif; font-size: 34px;
          font-weight: 400; margin: 0 0 8px; line-height: 1.15;
        }
        .wr-h1 em { font-style: italic; color: var(--gold); }
        .wr-sub { font-size: 14px; color: var(--mid); line-height: 1.7; margin: 0 0 32px; }

        .wr-detail { background: var(--cream); border-left: 3px solid var(--gold);
          border-radius: 6px; padding: 18px 22px; margin-bottom: 32px; font-size: 14px; }
        .wr-detail-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .wr-detail-label { color: var(--soft); }
        .wr-detail-value { color: var(--charcoal); font-weight: 500; text-align: right; }

        .wr-field-label {
          display: block; font-size: 12px; font-weight: 600; letter-spacing: .1em;
          text-transform: uppercase; color: var(--mid); margin-bottom: 10px;
        }
        .wr-stars { display: flex; gap: 6px; margin-bottom: 28px; }
        .wr-star-btn { font-size: 30px; line-height: 1; background: none; border: none; padding: 0; }

        .wr-textarea {
          width: 100%; min-height: 110px; padding: 14px 16px; resize: vertical;
          background: #fff; border: 1px solid var(--cream-md); border-radius: 6px;
          font-family: 'Jost', sans-serif; font-size: 14px; color: var(--charcoal);
          outline: none; box-sizing: border-box; margin-bottom: 22px;
        }
        .wr-textarea:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(184,154,106,.13); }

        .wr-error { background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C;
          border-radius: 4px; padding: 11px 16px; font-size: 13px; margin-bottom: 20px; }

        .wr-submit {
          width: 100%; height: 50px; background: var(--charcoal); color: #fff;
          border: none; border-radius: 6px; cursor: pointer; font-family: 'Jost', sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
          transition: background .2s;
        }
        .wr-submit:hover:not(:disabled) { background: var(--gold); }
        .wr-submit:disabled { opacity: .55; cursor: not-allowed; }

        .wr-readonly-stars { color: var(--gold); font-size: 20px; letter-spacing: 3px; margin-bottom: 14px; }
        .wr-quote { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 18px;
          color: var(--charcoal); line-height: 1.6; margin: 0 0 24px; }

        .wr-links { display: flex; gap: 24px; margin-top: 8px; }
        .wr-links a { color: var(--gold); font-size: 13px; font-weight: 600; text-decoration: none; }
        .wr-links a:hover { color: var(--charcoal); }

        .wr-note { font-size: 14px; color: var(--mid); line-height: 1.8; }
      `}</style>

      <div className="wr-card">
        {!bookingId ? (
          <>
            <p className="wr-kicker">Write a Review</p>
            <h1 className="wr-h1">Missing booking</h1>
            <p className="wr-note">
              This review link is missing a booking reference. Please use the
              &quot;Write a Review&quot; button from your thank-you email, or open{' '}
              <Link href="/my-bookings" style={{ color: 'var(--gold)', fontWeight: 600 }}>My Bookings</Link> and rate a completed service from there.
            </p>
          </>
        ) : loading ? (
          <p className="wr-note">Loading your booking…</p>
        ) : notFound ? (
          <>
            <p className="wr-kicker">Write a Review</p>
            <h1 className="wr-h1">We couldn&apos;t find that booking</h1>
            <p className="wr-note">
              This booking isn&apos;t on your account. If you think this is a mistake,
              make sure you&apos;re signed in with the same email you booked with.
            </p>
            <div className="wr-links"><Link href="/my-bookings">Go to My Bookings</Link></div>
          </>
        ) : booking && booking.status !== "COMPLETED" ? (
          <>
            <p className="wr-kicker">Write a Review</p>
            <h1 className="wr-h1">Not quite ready yet</h1>
            <p className="wr-note">
              This booking hasn&apos;t been completed yet, so it can&apos;t be reviewed
              until after your appointment.
            </p>
            <div className="wr-links"><Link href="/my-bookings">Go to My Bookings</Link></div>
          </>
        ) : (justSubmitted || existingReview) ? (
          <>
            <p className="wr-kicker">{justSubmitted ? "Thank You" : "Already Reviewed"}</p>
            <h1 className="wr-h1">
              {justSubmitted ? <>Thanks for your <em>feedback!</em></> : <>You&apos;ve already reviewed this <em>visit</em></>}
            </h1>
            <div className="wr-readonly-stars" aria-hidden="true">
              {'★'.repeat((justSubmitted ?? existingReview)!.rating)}
              {'☆'.repeat(5 - (justSubmitted ?? existingReview)!.rating)}
            </div>
            {(justSubmitted ?? existingReview)?.comment && (
              <p className="wr-quote">&ldquo;{(justSubmitted ?? existingReview)!.comment}&rdquo;</p>
            )}
            <div className="wr-links">
              <Link href="/reviews">See Client Reviews</Link>
              <Link href="/my-bookings">My Bookings</Link>
            </div>
          </>
        ) : (
          <>
            <p className="wr-kicker">Write a Review</p>
            <h1 className="wr-h1">Rate your <em>{booking?.service?.name || "service"}</em></h1>
            <p className="wr-sub">A quick rating and a few words help other clients find us.</p>

            {booking && (
              <div className="wr-detail">
                <div className="wr-detail-row">
                  <span className="wr-detail-label">Service</span>
                  <span className="wr-detail-value">{booking.service?.name || "—"}</span>
                </div>
                {booking.staff?.name && (
                  <div className="wr-detail-row">
                    <span className="wr-detail-label">Specialist</span>
                    <span className="wr-detail-value">{booking.staff.name}</span>
                  </div>
                )}
                <div className="wr-detail-row">
                  <span className="wr-detail-label">Date</span>
                  <span className="wr-detail-value">{formatSalonDate(booking.appointment_date, { weekday: undefined, year: "numeric", month: "numeric", day: "numeric" })}</span>
                </div>
              </div>
            )}

            <label className="wr-field-label">Your rating</label>
            <StarPicker value={rating} onChange={setRating} />

            <label className="wr-field-label" htmlFor="wr-comment">Your comment (optional)</label>
            <textarea
              id="wr-comment"
              className="wr-textarea"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tell other clients about your experience…"
              maxLength={500}
            />

            {error && <p className="wr-error">{error}</p>}

            <button className="wr-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function WriteReviewPage() {
  return (
    <Suspense fallback={<div className="wr" style={{ alignItems: 'center' }}><p>Loading…</p></div>}>
      <WriteReviewContent />
    </Suspense>
  );
}

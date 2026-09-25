// app/booking/page.tsx
'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

// `new Date().toISOString()` reports the UTC calendar date, which runs
// ahead of local date in the evening in any negative-UTC-offset timezone
// (e.g. after ~8pm Eastern) — using it as the date input's `min` would
// block picking "today" once UTC has already rolled over to tomorrow.
// Build the min from local calendar components instead.
function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Same local-calendar-day comparison the backend's
// assertNoDuplicateServiceSameDay() uses — never compare via raw UTC
// substring/day math, for the same reason localTodayStr() above doesn't.
function isSameLocalDay(isoDateTime: string, yyyyMmDd: string): boolean {
  const d = new Date(isoDateTime);
  const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return dayStr === yyyyMmDd;
}

interface BookableService {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface BookableStaff {
  id: string;
  name: string;
}

// Just enough of GET /api/appointments/my-bookings's shape to run the
// same-service-same-day pre-check client-side. service_id is a plain
// scalar column on Appointment (always present in the response) even
// though the nested `service` relation is what most of the UI reads.
interface MyBooking {
  id: string;
  service_id: string;
  appointment_date: string;
  status: string;
}

// Snapshot of what was actually confirmed by the server, captured at the
// moment of a successful booking. The draft form fields (selectedSlot etc.)
// get reset/reloaded right after success (loadAvailableSlots clears
// selectedSlot as part of its normal "date/staff changed" behavior), so the
// summary can't keep reading live draft state once a booking succeeds — it
// needs its own copy that isn't touched by that reload.
interface ConfirmedBooking {
  serviceName: string;
  duration: number;
  price: number;
  date: string;
  slot: string;
  staffName?: string;
}

export default function BookingPage() {
  return (
    <Suspense fallback={null}>
      <BookingForm />
    </Suspense>
  );
}

function BookingForm() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [services, setServices]               = useState<BookableService[]>([]);
  const [staff, setStaff]                     = useState<BookableStaff[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedStaff, setSelectedStaff]     = useState('');
  const [selectedDate, setSelectedDate]       = useState('');
  const [availableSlots, setAvailableSlots]   = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot]       = useState('');
  const [notes, setNotes]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [bookingLoading, setBookingLoading]   = useState(false);
  const [error, setError]                     = useState('');
  const [successMsg, setSuccessMsg]           = useState('');
  const [lastBooking, setLastBooking]         = useState<ConfirmedBooking | null>(null);
  const [myBookings, setMyBookings]           = useState<MyBooking[]>([]);

  // Wait for AuthContext's async auth check before deciding to redirect —
  // otherwise a genuinely logged-in user gets bounced to /login on refresh
  // because `user` starts as null.
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = api.getToken();
        const [servicesRes, staffRes, myBookingsRes] = await Promise.all([
          api.getServices(),
          api.getStaff(),
          // Needed for the same-service-same-day pre-check below — only a
          // client-side convenience (the backend re-checks authoritatively
          // on submit either way), so a failure here is swallowed rather
          // than blocking the rest of the page.
          token ? api.getMyBookings(token).catch(() => null) : Promise.resolve(null),
        ]);
        const loadedServices: BookableService[] = servicesRes.success ? (servicesRes.services || []) : [];
        if (servicesRes.success) setServices(loadedServices);
        if (staffRes?.success) setStaff(staffRes.staff || []);
        if (myBookingsRes?.success) setMyBookings(myBookingsRes.appointments || []);

        // Deep-link from a "Book Now" on a specific service card (homepage
        // Signature Treatments, /services, ...) — e.g. /booking?service=<id>.
        // Only preselects an id that's actually in the freshly-fetched
        // (already active-only, per GET /api/services) list — a missing,
        // invalid, or inactive id is silently ignored and the dropdown
        // stays on its normal empty "Choose a service" state. The dropdown
        // remains fully editable afterward.
        const requestedId = searchParams.get('service');
        if (requestedId && loadedServices.some(s => s.id === requestedId)) {
          setSelectedService(requestedId);
        }
      } catch (err) {
        console.error('Failed to load data', err);
      }
    };
    loadData();
  }, [searchParams]);

  const loadAvailableSlots = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelectedSlot('');
    try {
      const res = await api.getAvailableSlots(selectedDate, selectedStaff || undefined);
      if (res.success) {
        setAvailableSlots(res.data?.availableSlots || []);
      } else {
        setError(res.message || 'Failed to load slots');
      }
    } catch {
      setError('Failed to load available slots');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStaff]);

  useEffect(() => {
    if (!selectedDate) return;
    (async () => {
      await loadAvailableSlots();
    })();
  }, [selectedDate, selectedStaff, loadAvailableSlots]);

  const handleBookAppointment = async () => {
    // Belt-and-suspenders against a double-click/double-submit slipping in
    // before React re-renders the button as disabled — the `disabled`
    // prop below already covers the normal case, this guards the gap.
    if (bookingLoading || lastBooking) return;

    if (!selectedService || !selectedDate || !selectedSlot) {
      setError('Please select service, date and time slot');
      return;
    }

    const token = api.getToken();
    if (!token) {
      setError('Your session has expired. Please log in again.');
      router.push('/login');
      return;
    }

    setBookingLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const fullDateTime = `${selectedDate}T${selectedSlot}:00`;

      const appointmentData = {
        service_id:       selectedService,
        staff_id:         selectedStaff || undefined,
        appointment_date: fullDateTime,
        notes:            notes?.trim() || undefined,
      };

      const res = await api.bookAppointment(appointmentData, token);

      if (res.success) {
        // Snapshot the confirmed details before anything below (notably
        // loadAvailableSlots, which resets selectedSlot as part of its
        // normal reload behavior) can change the live draft state out from
        // under the summary.
        setLastBooking({
          serviceName: services.find(s => s.id === selectedService)?.name ?? '',
          duration:    services.find(s => s.id === selectedService)?.duration ?? 0,
          price:       services.find(s => s.id === selectedService)?.price ?? 0,
          date:        selectedDate,
          slot:        selectedSlot,
          staffName:   selectedStaff ? staff.find(s => s.id === selectedStaff)?.name : undefined,
        });
        setSuccessMsg(
          `✅ Appointment booked successfully for ${formatDate(selectedDate)} at ${formatTime(selectedSlot)}!`
        );
        setNotes('');
        // The slot this customer just took is no longer available to
        // itself for a second click, and admin's Recent Bookings picks
        // this up via the bookingCreated socket event — but this tab's
        // own slot list can go stale (e.g. duration-based neighboring
        // slots), so refresh it against the server's view. lastBooking
        // (set above) keeps the summary showing the confirmed time even
        // though this clears selectedSlot.
        loadAvailableSlots();
        // Also refresh myBookings so the same-service-same-day pre-check
        // (duplicateBooking, below) knows about this booking immediately —
        // otherwise a customer could hit 'Book another appointment' and
        // pick the same service/day again before this tab ever reloads.
        api.getMyBookings(token).then(r => { if (r?.success) setMyBookings(r.appointments || []); }).catch(() => {});
      } else if (res.error === 'CUSTOMER_TIME_CONFLICT') {
        setError('You already have an appointment at this time.');
      } else if (res.error === 'DUPLICATE_BOOKING') {
        setError('You already have this exact appointment booked.');
      } else if (res.error === 'SLOT_UNAVAILABLE') {
        setError(res.message || 'That time is no longer available. Please choose a different slot.');
      } else if (res.error === 'DUPLICATE_SERVICE_SAME_DAY') {
        // Defense-in-depth: the pre-check below (duplicateBooking) should
        // already have hidden the slots/disabled Confirm before this could be
        // submitted, but myBookings can be stale (another tab, another
        // device) — never show a generic success then fail, always surface
        // the server's own reason.
        setError(res.message || 'You already have this service booked on this day. Please choose a different service or day.');
        if (token) {
          api.getMyBookings(token).then(r => { if (r?.success) setMyBookings(r.appointments || []); }).catch(() => {});
        }
      } else {
        setError(res.message || 'Booking failed');
      }
    } catch (err) {
      console.error('Booking Error:', err);
      setError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  // ✅ FIXED: Parse date parts directly to avoid UTC timezone shift
  // new Date('2026-05-19') is treated as UTC midnight → shows May 18 in US timezones
  // Parsing as (year, month-1, day) uses LOCAL time → always shows correct date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
    });
  };

  const formatTime = (slot: string) => {
    if (!slot) return '';
    const [hour, minute] = slot.split(':').map(Number);
    const ampm        = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  // Same-service-same-day pre-check (client-side convenience mirroring
  // the backend's assertNoDuplicateServiceSameDay) — staff-agnostic on
  // purpose, matching that function's stricter rule: an existing active
  // booking for this service on this day blocks a new one regardless of
  // which staff member either booking uses.
  const duplicateBooking = selectedService && selectedDate
    ? myBookings.find(b =>
        b.service_id === selectedService &&
        (b.status === 'PENDING' || b.status === 'CONFIRMED') &&
        isSameLocalDay(b.appointment_date, selectedDate)
      )
    : undefined;

  // Keep the Booking Summary from showing a stale selected time once the
  // slot picker above is replaced by the duplicate-booking message.
  useEffect(() => {
    if (duplicateBooking) setSelectedSlot('');
  }, [duplicateBooking?.id]);

  if (authLoading || !user) return null;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 pt-6 sm:pt-10">
      <h1 className="text-3xl sm:text-4xl font-semibold text-center mb-8 sm:mb-10 text-gray-800">
        Book Your Appointment
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-xl mb-8">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-400 text-green-800 px-6 py-4 rounded-xl mb-8 flex items-center justify-between">
          <span>{successMsg}</span>
          <button
            onClick={() => {
              setSuccessMsg('');
              setLastBooking(null);
              setSelectedService('');
              setSelectedDate('');
              setSelectedSlot('');
              setAvailableSlots([]);
              setNotes('');
            }}
            className="text-sm underline ml-4 hover:text-green-900"
          >
            Book another appointment
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-10">

        {/* ── Left: Form ── */}
        <div className="space-y-8">

          {/* Service */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Service</label>
            <select
              value={selectedService}
              onChange={e => setSelectedService(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Choose a service</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — ${s.price} ({s.duration} min)
                </option>
              ))}
            </select>
          </div>

          {/* Staff */}
          <div>
            <label className="block text-sm font-medium mb-2">Preferred Staff (Optional)</label>
            <select
              value={selectedStaff}
              onChange={e => setSelectedStaff(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Any Staff</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              min={localTodayStr()}
              className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-sm font-medium mb-2">Available Time Slots</label>
            {duplicateBooking ? (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                You already have {services.find(s => s.id === selectedService)?.name} booked on{' '}
                {formatDate(selectedDate)} at {formatTime(
                  new Date(duplicateBooking.appointment_date).toTimeString().slice(0, 5)
                )}. Choose a different service, or a different day.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                {loading ? (
                  <p className="col-span-4 text-gray-500">Loading available slots...</p>
                ) : availableSlots.length > 0 ? (
                  availableSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-xl border text-sm font-medium transition ${
                        selectedSlot === slot
                          ? 'bg-pink-600 text-white border-pink-600'
                          : 'hover:bg-gray-100 border-gray-300'
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  ))
                ) : selectedDate ? (
                  <p className="col-span-4 text-gray-500">No slots available for this date</p>
                ) : (
                  <p className="col-span-4 text-gray-400">Please select a date first</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Booking Summary ── */}
        <div className="bg-white p-5 sm:p-8 rounded-3xl shadow border h-fit lg:sticky lg:top-6">
          <h3 className="text-2xl font-semibold mb-6">Booking Summary</h3>

          {lastBooking ? (
            // Confirmed booking — show the snapshot taken at success time,
            // not the live draft fields (which loadAvailableSlots has since
            // reset as part of refreshing the slot list).
            <div className="mb-6 p-5 bg-gray-50 rounded-2xl space-y-3 text-sm">
              <p>
                <strong>Service:</strong>{' '}
                {lastBooking.serviceName}
              </p>
              <p>
                <strong>Duration:</strong>{' '}
                {lastBooking.duration} min
              </p>
              <p>
                <strong>Date:</strong>{' '}
                {formatDate(lastBooking.date)}
              </p>
              <p>
                <strong>Time:</strong>{' '}
                <span className="text-pink-600 font-semibold">{formatTime(lastBooking.slot)}</span>
              </p>
              {lastBooking.staffName && (
                <p>
                  <strong>Staff:</strong>{' '}
                  {lastBooking.staffName}
                </p>
              )}
              <p>
                <strong>Price:</strong>{' '}
                ${lastBooking.price}
              </p>
            </div>
          ) : selectedService ? (
            <div className="mb-6 p-5 bg-gray-50 rounded-2xl space-y-3 text-sm">
              <p>
                <strong>Service:</strong>{' '}
                {services.find(s => s.id === selectedService)?.name}
              </p>
              <p>
                <strong>Duration:</strong>{' '}
                {services.find(s => s.id === selectedService)?.duration} min
              </p>
              <p>
                <strong>Date:</strong>{' '}
                {/* ✅ Now uses fixed formatDate — shows correct local date */}
                {selectedDate
                  ? formatDate(selectedDate)
                  : <span className="text-gray-400">Not selected</span>
                }
              </p>
              <p>
                <strong>Time:</strong>{' '}
                {selectedSlot
                  ? <span className="text-pink-600 font-semibold">{formatTime(selectedSlot)}</span>
                  : <span className="text-gray-400">Not selected</span>
                }
              </p>
              {selectedStaff && (
                <p>
                  <strong>Staff:</strong>{' '}
                  {staff.find(s => s.id === selectedStaff)?.name}
                </p>
              )}
              <p>
                <strong>Price:</strong>{' '}
                ${services.find(s => s.id === selectedService)?.price}
              </p>
            </div>
          ) : (
            <div className="mb-6 p-5 bg-gray-50 rounded-2xl text-gray-400 text-sm">
              Select a service to see your booking summary
            </div>
          )}

          <textarea
            placeholder="Add any special requests or notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            suppressHydrationWarning
            className="w-full p-5 border border-gray-300 rounded-2xl h-32 resize-y focus:outline-none focus:ring-2 focus:ring-pink-500"
          />

          <button
            onClick={handleBookAppointment}
            disabled={bookingLoading || !!lastBooking || !!duplicateBooking || !selectedService || !selectedDate || !selectedSlot}
            className="w-full mt-8 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-400 text-white py-4 rounded-2xl font-semibold text-lg transition"
          >
            {bookingLoading ? 'Booking Appointment...' : 'Confirm & Book Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}

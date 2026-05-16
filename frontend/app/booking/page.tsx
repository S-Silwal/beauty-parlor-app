// app/booking/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function BookingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [services, setServices]               = useState<any[]>([]);
  const [staff, setStaff]                     = useState<any[]>([]);
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
  const [isClient, setIsClient]               = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (!user) router.push('/login');
  }, [user, router]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [servicesRes, staffRes] = await Promise.all([
          api.getServices(),
          api.getStaff(),
        ]);
        if (servicesRes.success) setServices(servicesRes.services || []);
        if (staffRes?.success) setStaff(staffRes.staff || []);
      } catch (err) {
        console.error('Failed to load data', err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDate) loadAvailableSlots();
  }, [selectedDate, selectedStaff]);

  const loadAvailableSlots = async () => {
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
  };

  const handleBookAppointment = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) {
      setError('Please select service, date and time slot');
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

      const res = await api.bookAppointment(appointmentData, api.getToken()!);

      if (res.success) {
        setSuccessMsg(
          `✅ Appointment booked successfully for ${formatDate(selectedDate)} at ${formatTime(selectedSlot)}!`
        );
        setNotes('');
      } else {
        setError(res.message || 'Booking failed');
      }
    } catch (err: any) {
      console.error('Booking Error:', err);
      setError(err.message || 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  // ✅ FIXED: Parse date parts directly to avoid UTC timezone shift
  // new Date('2026-05-19') is treated as UTC midnight → shows May 18 in US timezones
  // Parsing as (year, month-1, day) uses LOCAL time → always shows correct date
  const formatDate = (dateStr: string) => {
    if (!dateStr || !isClient) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
    });
  };

  const formatTime = (slot: string) => {
    if (!slot || !isClient) return '';
    const [hour, minute] = slot.split(':').map(Number);
    const ampm        = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 pt-10">
      <h1 className="text-4xl font-semibold text-center mb-10 text-gray-800">
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

      <div className="grid lg:grid-cols-2 gap-10">

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
              min={new Date().toISOString().split('T')[0]}
              className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-sm font-medium mb-2">Available Time Slots</label>
            <div className="grid grid-cols-4 gap-3">
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
          </div>
        </div>

        {/* ── Right: Booking Summary ── */}
        <div className="bg-white p-8 rounded-3xl shadow border h-fit sticky top-6">
          <h3 className="text-2xl font-semibold mb-6">Booking Summary</h3>

          {selectedService ? (
            <div className="mb-6 p-5 bg-gray-50 rounded-2xl space-y-3 text-sm">
              <p>
                <strong>Service:</strong>{' '}
                {services.find(s => s.id === selectedService)?.name}
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
            disabled={bookingLoading || !selectedService || !selectedDate || !selectedSlot}
            className="w-full mt-8 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-400 text-white py-4 rounded-2xl font-semibold text-lg transition"
          >
            {bookingLoading ? 'Booking Appointment...' : 'Confirm & Book Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}

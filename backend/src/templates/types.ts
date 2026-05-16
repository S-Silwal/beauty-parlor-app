// src/templates/types.ts
export interface BookingEmailData {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  staffName?: string;
  price?: string; 
  notes?: string;       // ✅ change number to string
}

export interface CancelledEmailData extends BookingEmailData {
  reason?: string;
}

export interface RescheduledEmailData extends BookingEmailData {
  oldDate?: string;
  oldTime?: string;
  newDate: string;
  newTime: string;
  reason?: string;
}
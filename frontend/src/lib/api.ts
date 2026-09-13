
// src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const api = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  register: async (name: string, email: string, password: string, phone?: string) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password, ...(phone ? { phone } : {}) }),
    });
    return res.json();
  },

  getCurrentUser: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    return res.json();
  },

  // Uses the httpOnly refresh-token cookie the backend set at login —
  // called proactively by AuthContext before the 15-min access token expires.
  refreshToken: async () => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.json();
  },

  logout: async () => {
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    return res.json();
  },
  // ====================== SERVICES ======================
  getServices: async () => {
    const res = await fetch(`${API_BASE}/api/appointments/services`);
    return res.json();
  },
getStaff: async () => {                    // ← Added this
    const res = await fetch(`${API_BASE}/api/appointments/staff`);
    return res.json();
  },
  // ====================== AVAILABLE SLOTS ======================
  getAvailableSlots: async (date: string, staffId?: string, serviceId?: string) => {
    let url = `${API_BASE}/api/appointments/available-slots?date=${date}`;
    if (staffId) url += `&staff_id=${staffId}`;
    if (serviceId) url += `&service_id=${serviceId}`;

    const res = await fetch(url);
    return res.json();
  },

  // ====================== APPOINTMENTS ======================
 bookAppointment: async (
   data: { service_id: string; staff_id?: string; appointment_date: string; notes?: string },
   token: string
 ) => {
  const res = await fetch(`${API_BASE}/api/appointments/book`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
},
  getMyBookings: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/appointments/my-bookings`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    return res.json();
  },

  // ====================== CHANGE REQUESTS (customer) ======================
  // These never change the booking directly — they submit a request that
  // only takes effect once an admin approves it.
  requestEditBooking: async (
    appointmentId: string,
    data: { requested_date?: string; requested_staff_id?: string; requested_service_id?: string },
    token: string
  ) => {
    const res = await fetch(`${API_BASE}/api/appointments/${appointmentId}/request-edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify(data),
    });
    return res.json();
  },
  requestCancelBooking: async (appointmentId: string, reason: string | undefined, token: string) => {
    const res = await fetch(`${API_BASE}/api/appointments/${appointmentId}/request-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },
  getMyChangeRequests: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/appointments/my-change-requests`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    return res.json();
  },

  // ====================== CHANGE REQUESTS (admin) ======================
  getPendingChangeRequests: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/appointments/change-requests/pending`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    return res.json();
  },
  resolveChangeRequest: async (
    requestId: string,
    decision: "APPROVED" | "DECLINED",
    declineReason: string | undefined,
    token: string
  ) => {
    const res = await fetch(`${API_BASE}/api/appointments/change-requests/${requestId}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify({ decision, decline_reason: declineReason }),
    });
    return res.json();
  },

  // ====================== GALLERY ======================
  getGallery: async () => {
    const res = await fetch(`${API_BASE}/api/gallery`);
    return res.json();
  },

  // ====================== REVIEWS ======================
  getReviewStats: async () => {
    const res = await fetch(`${API_BASE}/api/reviews/stats`, { cache: 'no-store' });
    return res.json();
  },
  getMyReviews: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/reviews/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    return res.json();
  },
  submitReview: async (
    data: { appointment_id: string; rating: number; comment?: string },
    token: string
  ) => {
    const res = await fetch(`${API_BASE}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // ====================== HELPER ======================
setToken: (token: string) => {
  // Store in localStorage for API Authorization headers
  localStorage.setItem('accessToken', token);
 
  // ✅ Also store in cookie so Next.js middleware can read it
  // Expires in 15 minutes (matches JWT expiry)
  const expires = new Date(Date.now() + 15 * 60 * 1000).toUTCString();
  document.cookie = `accessToken=${token}; path=/; expires=${expires}; SameSite=Strict`;
},
 
getToken: () => {
  return localStorage.getItem('accessToken');
},
 
removeToken: () => {
  localStorage.removeItem('accessToken');
 
  // ✅ Also clear the cookie
  document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
},
};
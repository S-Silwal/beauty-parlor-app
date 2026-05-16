
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

  register: async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
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
  getAvailableSlots: async (date: string, staffId?: string) => {
    let url = `${API_BASE}/api/appointments/available-slots?date=${date}`;
    if (staffId) url += `&staff_id=${staffId}`;

    const res = await fetch(url);
    return res.json();
  },

  // ====================== APPOINTMENTS ======================
 bookAppointment: async (data: any, token: string) => {
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

  // ====================== GALLERY ======================
  getGallery: async () => {
    const res = await fetch(`${API_BASE}/api/gallery`);
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
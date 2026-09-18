// app/admin/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { initSocket } from '@/lib/socket';

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

interface Booking {
  id: string;
  service: { name: string };
  staff?: { name: string };
  user: { name: string; email: string };
  appointment_date: string;
  status: AppointmentStatus;
  payment_status: string;
  total_price: number;
  duration: number;
  notes?: string; // ✅ customer notes
}

interface Staff {
  id: string;
  name: string;
  specialization?: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatar?: string;
  isActive: boolean;
  // Only present on the admin listing (GET /api/staff/admin) — the public
  // one never exposes a staff member's linked login account.
  user_id?: string | null;
  user?: { id: string; name: string; email: string } | null;
}

// A CUSTOMER or STAFF account that can be linked to a Staff row so that
// person can log in and see/manage only their own assigned bookings. See
// GET /api/users (admin-only).
interface Account {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF';
}

interface GalleryImage {
  id: string;
  url: string;
  alt_text?: string;
  category?: string;
  created_at: string;
}

// Admin-side shape of a homepage hero slide (see GET /api/hero-slides/admin).
interface HeroSlideItem {
  id: string;
  imageUrl: string;
  imagePublicId?: string | null;
  title: string;
  titleAccent?: string | null;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  sortOrder: number;
  isActive: boolean;
}

type ServiceCategory = 'EYEBROW_LASH' | 'WAXING' | 'FACIAL_SKINCARE';

interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  description?: string;
  duration: number;
  price: number | string; // Prisma Decimal comes back as a string over JSON
  image?: string | null;
  is_popular?: boolean; // drives the "Signature" badge on the public Services page
  isActive: boolean;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Night';
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; bg: string; text: string; dot: string }> = {
  PENDING:     { label: 'Pending',     bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  CONFIRMED:   { label: 'Confirmed',   bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  COMPLETED:   { label: 'Completed',   bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6' },
  CANCELLED:   { label: 'Cancelled',   bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
  RESCHEDULED: { label: 'Rescheduled', bg: '#EDE9FE', text: '#5B21B6', dot: '#8B5CF6' },
};

const GALLERY_CATEGORIES = [
  { value: 'brows_lashes', label: 'Brows & Lashes' },
  { value: 'waxing',       label: 'Waxing' },
  { value: 'facials',      label: 'Facials' },
  { value: 'before_after', label: 'Before & After' },
];

// Mirrors the backend's ServiceCategory enum (prisma/schema.prisma)
const SERVICE_CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'EYEBROW_LASH',    label: 'Brows & Lashes' },
  { value: 'WAXING',          label: 'Waxing' },
  { value: 'FACIAL_SKINCARE', label: 'Facials & Skincare' },
];

type AdminTab = 'overview' | 'bookings' | 'requests' | 'staff' | 'gallery' | 'services' | 'hero';

interface ChangeRequest {
  id: string;
  type: 'EDIT' | 'CANCEL';
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  requested_date?: string | null;
  customer_note?: string | null;
  created_at: string;
  appointment: {
    id: string;
    appointment_date: string;
    service: { name: string };
    staff?: { name: string } | null;
    user: { name: string; email: string };
  };
  requestedStaff?: { name: string } | null;
  requestedService?: { name: string } | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function AdminPanel() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [staff, setStaff]         = useState<Staff[]>([]);
  const [gallery, setGallery]     = useState<GalleryImage[]>([]);
  const [services, setServices]   = useState<Service[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [filter, setFilter]       = useState<AppointmentStatus | 'ALL'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [newBookingIds, setNewBookingIds] = useState<Set<string>>(new Set());
  const [greeting] = useState(getGreeting());

  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [resolvingId, setResolvingId]       = useState<string | null>(null);
  const [declineDraftId, setDeclineDraftId] = useState<string | null>(null);
  const [declineReason, setDeclineReason]   = useState('');
  const [newRequestIds, setNewRequestIds]   = useState<Set<string>>(new Set());

  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm]         = useState({ name: '', specialization: '', email: '', phone: '', bio: '', avatar: '', isActive: true, user_id: '' });
  const [staffLoading, setStaffLoading]   = useState(false);
  const [accounts, setAccounts]           = useState<Account[]>([]);
  const [selectedStaffFile, setSelectedStaffFile] = useState<File | null>(null);
  const [staffPreviewUrl, setStaffPreviewUrl]     = useState<string | null>(null);
  const [staffPhotoRemoved, setStaffPhotoRemoved] = useState(false);
  const [staffUploading, setStaffUploading]       = useState(false);
  const [staffUploadProgress, setStaffUploadProgress] = useState(0);
  const staffFileInputRef                         = useRef<HTMLInputElement>(null);

  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryForm, setGalleryForm]           = useState({ alt_text: '', category: 'brows_lashes' });
  const [selectedFile, setSelectedFile]         = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]             = useState<string | null>(null);
  const [uploadProgress, setUploadProgress]     = useState(0);
  const [galleryFilter, setGalleryFilter]       = useState('all');
  const fileInputRef                            = useRef<HTMLInputElement>(null);

  const [showServiceForm, setShowServiceForm]   = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm]           = useState({
    name: '', category: 'EYEBROW_LASH' as ServiceCategory, description: '', duration: '', price: '', image: '', is_popular: false,
  });
  const [serviceLoading, setServiceLoading]         = useState(false);
  const [selectedServiceFile, setSelectedServiceFile] = useState<File | null>(null);
  const [servicePreviewUrl, setServicePreviewUrl]     = useState<string | null>(null);
  const [serviceUploading, setServiceUploading]       = useState(false);
  const [serviceUploadProgress, setServiceUploadProgress] = useState(0);
  const serviceFileInputRef                           = useRef<HTMLInputElement>(null);

  const [heroSlides, setHeroSlides]           = useState<HeroSlideItem[]>([]);
  const [showHeroForm, setShowHeroForm]       = useState(false);
  const [editingHeroId, setEditingHeroId]     = useState<string | null>(null);
  const [heroForm, setHeroForm]               = useState({
    title: '', titleAccent: '', description: '', ctaLabel: '', ctaHref: '', isActive: true,
  });
  const [heroLoading, setHeroLoading]         = useState(false);
  const [selectedHeroFile, setSelectedHeroFile] = useState<File | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl]   = useState<string | null>(null);
  const [heroUploading, setHeroUploading]     = useState(false);
  const [heroUploadProgress, setHeroUploadProgress] = useState(0);
  const heroFileInputRef                      = useRef<HTMLInputElement>(null);

  // Wait for AuthContext's async auth check before deciding to redirect —
  // otherwise a genuinely logged-in admin gets bounced to /login on refresh
  // because `user` starts as null.
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isAdmin) { router.push('/dashboard'); }
  }, [user, isAdmin, authLoading, router]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBookings = async (highlightId?: string) => {
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/appointments/all`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setBookings(data.appointments || []);
        if (highlightId) {
          setNewBookingIds(prev => new Set(prev).add(highlightId));
          setTimeout(() => setNewBookingIds(prev => { const n = new Set(prev); n.delete(highlightId); return n; }), 6000);
        }
      }
    } catch (err) { console.error('Failed to fetch bookings', err); }
    finally { setLoading(false); }
  };

  const fetchStaff = async () => {
    try {
      // The admin-only listing (unlike public GET /api/staff) includes each
      // staff member's linked login account, which the Staff Management UI
      // needs to show/edit.
      const token = api.getToken();
      const res   = await fetch(`${API}/api/staff/admin`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
      });
      const data = await res.json();
      if (data.success) setStaff(data.staff || []);
    } catch (err) { console.error('Failed to fetch staff', err); }
  };

  const fetchAccounts = async () => {
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
      });
      const data = await res.json();
      if (data.success) setAccounts(data.users || []);
    } catch (err) { console.error('Failed to fetch accounts', err); }
  };

  const fetchGallery = async () => {
    try {
      const res  = await fetch(`${API}/api/gallery`);
      const data = await res.json();
      if (data.success) setGallery(data.images || []);
    } catch (err) { console.error('Failed to fetch gallery', err); }
  };

  const fetchServices = async () => {
    try {
      const res  = await fetch(`${API}/api/services`);
      const data = await res.json();
      if (data.success) setServices(data.services || []);
    } catch (err) { console.error('Failed to fetch services', err); }
  };

  const fetchHeroSlides = async () => {
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/hero-slides/admin`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
      });
      const data = await res.json();
      if (data.success) setHeroSlides(data.slides || []);
    } catch (err) { console.error('Failed to fetch hero slides', err); }
  };

  const fetchChangeRequests = async (highlightId?: string) => {
    try {
      const token = api.getToken();
      if (!token) return;
      const data = await api.getPendingChangeRequests(token);
      if (data.success) {
        setChangeRequests(data.requests || []);
        if (highlightId) {
          setNewRequestIds(prev => new Set(prev).add(highlightId));
          setTimeout(() => setNewRequestIds(prev => { const n = new Set(prev); n.delete(highlightId); return n; }), 6000);
        }
      }
    } catch (err) { console.error('Failed to fetch change requests', err); }
  };

  useEffect(() => {
    if (!user || !isAdmin) return;

    (async () => {
      await Promise.all([fetchBookings(), fetchStaff(), fetchAccounts(), fetchGallery(), fetchServices(), fetchChangeRequests(), fetchHeroSlides()]);
    })();

    const socket = initSocket();
    socket.on('bookingCreated', (b: Booking) => fetchBookings(b?.id));
    socket.on('bookingUpdated', () => fetchBookings());
    // A customer submitted a new edit/cancel request — show it live without
    // waiting for a manual refresh.
    socket.on('changeRequestCreated', (r: ChangeRequest) => fetchChangeRequests(r?.id));
    // A request was just resolved (by this admin or another) — drop it from
    // the pending list and refresh the underlying booking it touched.
    socket.on('changeRequestResolved', () => { fetchChangeRequests(); fetchBookings(); });
    // Another admin session (or this one, on a different tab) saved a staff
    // change — keep this panel's list in sync without a manual refresh.
    socket.on('staffUpdated', () => fetchStaff());
    return () => {
      socket.off('bookingCreated');
      socket.off('bookingUpdated');
      socket.off('changeRequestCreated');
      socket.off('changeRequestResolved');
      socket.off('staffUpdated');
    };
  }, [user, isAdmin]);

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setUpdatingId(id);
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/appointments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        // Merge the server's copy (not just `status`) so a COMPLETED
        // transition — which also flips payment_status to PAID server-side —
        // is reflected immediately in the Revenue stat without waiting on
        // the next socket-triggered refetch.
        setBookings(prev => prev.map(b => b.id === id ? { ...b, ...data.appointment } : b));
        showToast(`Booking ${status.toLowerCase()} successfully`);
      } else showToast(data.message || 'Update failed', 'error');
    } catch { showToast('Failed to update booking', 'error'); }
    finally { setUpdatingId(null); }
  };

  const resolveRequest = async (requestId: string, decision: 'APPROVED' | 'DECLINED', reason?: string) => {
    setResolvingId(requestId);
    try {
      const token = api.getToken();
      if (!token) return;
      const data = await api.resolveChangeRequest(requestId, decision, reason, token);
      if (data.success) {
        setChangeRequests(prev => prev.filter(r => r.id !== requestId));
        setDeclineDraftId(null);
        setDeclineReason('');
        fetchBookings();
        showToast(decision === 'APPROVED' ? 'Request approved' : 'Request declined');
      } else {
        showToast(data.message || 'Failed to resolve request', 'error');
      }
    } catch {
      showToast('Failed to resolve request', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const emptyStaffForm = { name: '', specialization: '', email: '', phone: '', bio: '', avatar: '', isActive: true, user_id: '' };

  const openAddStaff = () => {
    setEditingStaffId(null);
    setStaffForm(emptyStaffForm);
    setSelectedStaffFile(null);
    setStaffPreviewUrl(null);
    setStaffPhotoRemoved(false);
    if (staffFileInputRef.current) staffFileInputRef.current.value = '';
    setShowStaffForm(true);
  };

  const openEditStaff = (s: Staff) => {
    setEditingStaffId(s.id);
    setStaffForm({
      name: s.name,
      specialization: s.specialization || '',
      email: s.email || '',
      phone: s.phone || '',
      bio: s.bio || '',
      avatar: s.avatar || '',
      isActive: s.isActive,
      user_id: s.user_id || '',
    });
    setSelectedStaffFile(null);
    setStaffPreviewUrl(null);
    setStaffPhotoRemoved(false);
    if (staffFileInputRef.current) staffFileInputRef.current.value = '';
    setShowStaffForm(true);
  };

  const closeStaffForm = () => {
    setShowStaffForm(false);
    setEditingStaffId(null);
    setStaffForm(emptyStaffForm);
    setSelectedStaffFile(null);
    setStaffPreviewUrl(null);
    setStaffPhotoRemoved(false);
    if (staffFileInputRef.current) staffFileInputRef.current.value = '';
  };

  const handleStaffFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { showToast('Only JPG, PNG and WebP images are allowed', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Image must be under 10MB', 'error'); return; }
    setSelectedStaffFile(file);
    setStaffPreviewUrl(URL.createObjectURL(file));
    setStaffPhotoRemoved(false);
  };

  // Explicitly clears the photo (distinct from just never having picked
  // one) — handleSaveStaff sends `avatar: null` for this so the backend
  // deletes the Cloudinary asset instead of leaving it untouched.
  const handleRemoveStaffPhoto = () => {
    setSelectedStaffFile(null);
    setStaffPreviewUrl(null);
    setStaffForm(p => ({ ...p, avatar: '' }));
    setStaffPhotoRemoved(true);
    if (staffFileInputRef.current) staffFileInputRef.current.value = '';
  };

  // Accounts an admin can pick from for the "linked login" dropdown: not
  // already linked to a *different* staff member (the backend would reject
  // that with a 409 anyway — filtering here just keeps the list honest).
  // The staff member currently being edited keeps seeing their own account.
  const linkableAccounts = accounts.filter(
    a => !staff.some(s => s.user_id === a.id && s.id !== editingStaffId)
  );

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return;
    setStaffLoading(true);
    try {
      const token   = api.getToken();
      const isEdit  = !!editingStaffId;
      let avatarUrl: string | undefined;
      let avatarPublicId: string | undefined;

      // Only touch Cloudinary if the admin picked a new photo — a text-only
      // edit never re-uploads or replaces the existing photo.
      if (selectedStaffFile) {
        setStaffUploading(true); setStaffUploadProgress(20);
        const sigRes  = await fetch(`${API}/api/staff/signed-url`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
        const sigData = await sigRes.json();
        if (!sigData.success) throw new Error('Failed to get upload signature');
        const { signature, timestamp, apiKey, folder, allowedFormats, uploadUrl } = sigData;
        setStaffUploadProgress(45);
        const formData = new FormData();
        formData.append('file', selectedStaffFile);
        formData.append('signature', signature);
        formData.append('timestamp', String(timestamp));
        formData.append('api_key', apiKey);
        formData.append('folder', folder);
        // Must match exactly what the backend signed — Cloudinary rejects
        // the request if the params sent don't match the signed string.
        formData.append('allowed_formats', allowedFormats);
        const uploadRes  = await fetch(uploadUrl, { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Cloudinary upload failed');
        avatarUrl = uploadData.secure_url;
        avatarPublicId = uploadData.public_id;
        setStaffUploadProgress(85);
      }

      const { user_id, avatar: _avatar, ...rest } = staffForm;
      const payload: Record<string, unknown> = {
        ...rest,
        // Create: omit entirely when unset (undefined isn't sent by
        // JSON.stringify). Update: send null to explicitly clear an
        // existing link — the backend treats that as "unlink".
        ...(user_id ? { user_id } : isEdit ? { user_id: null } : {}),
      };
      if (avatarUrl) {
        // New photo uploaded — replace.
        payload.avatar = avatarUrl;
        payload.avatarPublicId = avatarPublicId;
      } else if (staffPhotoRemoved) {
        // Admin explicitly removed the photo — clear it.
        payload.avatar = null;
        payload.avatarPublicId = null;
      }
      // Otherwise: omit `avatar` entirely so an edit leaves the existing
      // photo untouched, and a create with no photo picked stays photo-less.

      const res     = await fetch(`${API}/api/staff${isEdit ? `/${editingStaffId}` : ''}`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'Staff member updated successfully' : 'Staff member added successfully');
        closeStaffForm();
        fetchStaff();
        fetchAccounts();
      } else showToast(data.message || `Failed to ${isEdit ? 'update' : 'add'} staff`, 'error');
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to ${editingStaffId ? 'update' : 'add'} staff`, 'error');
    } finally {
      setStaffLoading(false); setStaffUploading(false); setStaffUploadProgress(0);
    }
  };

  const handleRemoveStaff = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from staff?`)) return;
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/staff/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
      });
      const data = await res.json();
      if (data.success) { showToast('Staff removed'); fetchStaff(); fetchAccounts(); }
      else showToast(data.message || 'Failed to remove staff', 'error');
    } catch { showToast('Failed to remove staff', 'error'); }
  };

  const emptyServiceForm = { name: '', category: 'EYEBROW_LASH' as ServiceCategory, description: '', duration: '', price: '', image: '', is_popular: false };

  const openAddService = () => {
    setEditingServiceId(null);
    setServiceForm(emptyServiceForm);
    setSelectedServiceFile(null);
    setServicePreviewUrl(null);
    setShowServiceForm(true);
  };

  const openEditService = (sv: Service) => {
    setEditingServiceId(sv.id);
    setServiceForm({
      name: sv.name,
      category: sv.category,
      description: sv.description || '',
      duration: String(sv.duration),
      price: String(sv.price),
      image: sv.image || '',
      is_popular: sv.is_popular ?? false,
    });
    setSelectedServiceFile(null);
    setServicePreviewUrl(null);
    setShowServiceForm(true);
  };

  const closeServiceForm = () => {
    setShowServiceForm(false);
    setEditingServiceId(null);
    setServiceForm(emptyServiceForm);
    setSelectedServiceFile(null);
    setServicePreviewUrl(null);
    if (serviceFileInputRef.current) serviceFileInputRef.current.value = '';
  };

  const handleServiceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { showToast('Only JPG, PNG and WebP images are allowed', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Image must be under 10MB', 'error'); return; }
    setSelectedServiceFile(file);
    setServicePreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name.trim() || !serviceForm.duration || !serviceForm.price) return;
    const isEdit = !!editingServiceId;
    setServiceLoading(true);
    try {
      const token = api.getToken();
      let imageUrl = serviceForm.image; // existing photo when editing, '' otherwise

      // Only touch Cloudinary if the admin picked a new photo
      if (selectedServiceFile) {
        setServiceUploading(true); setServiceUploadProgress(20);
        const sigRes  = await fetch(`${API}/api/services/signed-url`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
        const sigData = await sigRes.json();
        if (!sigData.success) throw new Error('Failed to get upload signature');
        const { signature, timestamp, apiKey, folder, allowedFormats, uploadUrl } = sigData;
        setServiceUploadProgress(45);
        const formData = new FormData();
        formData.append('file', selectedServiceFile);
        formData.append('signature', signature);
        formData.append('timestamp', String(timestamp));
        formData.append('api_key', apiKey);
        formData.append('folder', folder);
        // Must match exactly what the backend signed — Cloudinary rejects
        // the request if the params sent don't match the signed string.
        formData.append('allowed_formats', allowedFormats);
        const uploadRes  = await fetch(uploadUrl, { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Cloudinary upload failed');
        imageUrl = uploadData.secure_url;
        setServiceUploadProgress(85);
      }

      const res = await fetch(`${API}/api/services${isEdit ? `/${editingServiceId}` : ''}`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({
          name:        serviceForm.name,
          category:    serviceForm.category,
          description: serviceForm.description || undefined,
          duration:    Number(serviceForm.duration),
          price:       Number(serviceForm.price),
          is_popular:  serviceForm.is_popular,
          ...(imageUrl ? { image: imageUrl } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'Service updated successfully' : 'Service added successfully');
        closeServiceForm();
        fetchServices();
      } else showToast(data.message || `Failed to ${isEdit ? 'update' : 'add'} service`, 'error');
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'add'} service`, 'error');
    } finally {
      setServiceLoading(false); setServiceUploading(false); setServiceUploadProgress(0);
    }
  };

  const handleRemoveService = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from services?`)) return;
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/services/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
      });
      const data = await res.json();
      if (data.success) { showToast('Service removed'); fetchServices(); }
      else showToast(data.message || 'Failed to remove service', 'error');
    } catch { showToast('Failed to remove service', 'error'); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { showToast('Only JPG, PNG and WebP images are allowed', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Image must be under 10MB', 'error'); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleGalleryUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { showToast('Please select an image', 'error'); return; }
    setGalleryUploading(true); setUploadProgress(0);
    try {
      const token   = api.getToken();
      const sigRes  = await fetch(`${API}/api/gallery/signed-url`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      const sigData = await sigRes.json();
      if (!sigData.success) throw new Error('Failed to get upload signature');
      const { signature, timestamp, apiKey, folder, allowedFormats, uploadUrl } = sigData;
      setUploadProgress(20);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('signature', signature);
      formData.append('timestamp', String(timestamp));
      formData.append('api_key', apiKey);
      formData.append('folder', folder);
      // Must match exactly what the backend signed — Cloudinary rejects the
      // request if the params sent don't match the signed string.
      formData.append('allowed_formats', allowedFormats);
      const uploadRes  = await fetch(uploadUrl, { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Cloudinary upload failed');
      setUploadProgress(80);
      const saveRes  = await fetch(`${API}/api/gallery/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ url: uploadData.secure_url, public_id: uploadData.public_id, alt_text: galleryForm.alt_text || selectedFile.name, category: galleryForm.category }),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error('Failed to save image to database');
      setUploadProgress(100);
      showToast('Image uploaded to gallery successfully');
      setSelectedFile(null); setPreviewUrl(null);
      setGalleryForm({ alt_text: '', category: 'brows_lashes' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchGallery();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Upload failed', 'error'); }
    finally { setGalleryUploading(false); setUploadProgress(0); }
  };

  const handleDeleteImage = async (id: string) => {
    if (!confirm('Remove this image from the gallery?')) return;
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/gallery/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      const data  = await res.json();
      if (data.success) { showToast('Image removed'); fetchGallery(); }
      else showToast(data.message || 'Failed to remove image', 'error');
    } catch { showToast('Failed to remove image', 'error'); }
  };

  const emptyHeroForm = { title: '', titleAccent: '', description: '', ctaLabel: '', ctaHref: '', isActive: true };

  const openAddHero = () => {
    setEditingHeroId(null);
    setHeroForm(emptyHeroForm);
    setSelectedHeroFile(null);
    setHeroPreviewUrl(null);
    setShowHeroForm(true);
  };

  const openEditHero = (h: HeroSlideItem) => {
    setEditingHeroId(h.id);
    setHeroForm({
      title: h.title,
      titleAccent: h.titleAccent || '',
      description: h.description,
      ctaLabel: h.ctaLabel,
      ctaHref: h.ctaHref,
      isActive: h.isActive,
    });
    setSelectedHeroFile(null);
    // Show the slide's current background so the live preview below isn't
    // blank while editing text-only fields.
    setHeroPreviewUrl(h.imageUrl);
    setShowHeroForm(true);
  };

  const closeHeroForm = () => {
    setShowHeroForm(false);
    setEditingHeroId(null);
    setHeroForm(emptyHeroForm);
    setSelectedHeroFile(null);
    setHeroPreviewUrl(null);
    if (heroFileInputRef.current) heroFileInputRef.current.value = '';
  };

  const handleHeroFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { showToast('Only JPG, PNG and WebP images are allowed', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Image must be under 10MB', 'error'); return; }
    setSelectedHeroFile(file);
    setHeroPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingHeroId;
    if (!isEdit && !selectedHeroFile) { showToast('Please select a background photo', 'error'); return; }
    if (!heroForm.title.trim() || !heroForm.description.trim() || !heroForm.ctaLabel.trim() || !heroForm.ctaHref.trim()) return;

    setHeroLoading(true);
    try {
      const token = api.getToken();
      let imageUrl: string | undefined;
      let imagePublicId: string | undefined;

      // Only touch Cloudinary if the admin picked a new photo — a text-only
      // edit never re-uploads or replaces the existing background.
      if (selectedHeroFile) {
        setHeroUploading(true); setHeroUploadProgress(20);
        const sigRes  = await fetch(`${API}/api/hero-slides/signed-url`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
        const sigData = await sigRes.json();
        if (!sigData.success) throw new Error('Failed to get upload signature');
        const { signature, timestamp, apiKey, folder, allowedFormats, uploadUrl } = sigData;
        setHeroUploadProgress(45);
        const formData = new FormData();
        formData.append('file', selectedHeroFile);
        formData.append('signature', signature);
        formData.append('timestamp', String(timestamp));
        formData.append('api_key', apiKey);
        formData.append('folder', folder);
        // Must match exactly what the backend signed — Cloudinary rejects
        // the request if the params sent don't match the signed string.
        formData.append('allowed_formats', allowedFormats);
        const uploadRes  = await fetch(uploadUrl, { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Cloudinary upload failed');
        imageUrl = uploadData.secure_url;
        imagePublicId = uploadData.public_id;
        setHeroUploadProgress(85);
      }

      const res = await fetch(`${API}/api/hero-slides${isEdit ? `/${editingHeroId}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({
          title:        heroForm.title,
          titleAccent:  heroForm.titleAccent || undefined,
          description:  heroForm.description,
          ctaLabel:     heroForm.ctaLabel,
          ctaHref:      heroForm.ctaHref,
          isActive:     heroForm.isActive,
          ...(imageUrl ? { imageUrl, imagePublicId } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'Hero slide updated' : 'Hero slide added');
        closeHeroForm();
        fetchHeroSlides();
      } else showToast(data.message || `Failed to ${isEdit ? 'update' : 'add'} hero slide`, 'error');
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'add'} hero slide`, 'error');
    } finally {
      setHeroLoading(false); setHeroUploading(false); setHeroUploadProgress(0);
    }
  };

  const handleToggleHeroActive = async (h: HeroSlideItem) => {
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/hero-slides/${h.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ isActive: !h.isActive }),
      });
      const data = await res.json();
      if (data.success) { showToast(h.isActive ? 'Slide deactivated' : 'Slide activated'); fetchHeroSlides(); }
      else showToast(data.message || 'Failed to update slide', 'error');
    } catch { showToast('Failed to update slide', 'error'); }
  };

  const handleReorderHero = async (id: string, direction: 'up' | 'down') => {
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/hero-slides/${id}/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (data.success) setHeroSlides(data.slides || []);
      else showToast(data.message || 'Failed to reorder slides', 'error');
    } catch { showToast('Failed to reorder slides', 'error'); }
  };

  const handleDeleteHero = async (id: string, title: string) => {
    if (!confirm(`Remove the "${title}" hero slide? This deletes its photo permanently.`)) return;
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/hero-slides/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      const data  = await res.json();
      if (data.success) { showToast('Hero slide removed'); fetchHeroSlides(); }
      else showToast(data.message || 'Failed to remove hero slide', 'error');
    } catch { showToast('Failed to remove hero slide', 'error'); }
  };

  const revenue = bookings
    .filter(b => b.status === 'COMPLETED' && b.payment_status === 'PAID')
    .reduce((sum, b) => sum + Number(b.total_price), 0);

  const stats = {
    total:     bookings.length,
    pending:   bookings.filter(b => b.status === 'PENDING').length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    completed: bookings.filter(b => b.status === 'COMPLETED').length,
    revenue,
  };

  const filtered        = filter === 'ALL' ? bookings : bookings.filter(b => b.status === filter);
  const filteredGallery = galleryFilter === 'all' ? gallery : gallery.filter(g => g.category === galleryFilter);

  if (authLoading || !user || !isAdmin) return null;

  return (
    <div style={{ minHeight:'100vh', background:'#F5F0EB', fontFamily:"'Jost', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');
        .ap-header{background:#2B221C;padding:0 32px;border-bottom:1px solid rgba(212,184,150,.16);}
        .ap-header-inner{max-width:1280px;margin:0 auto;height:80px;display:flex;align-items:center;justify-content:space-between;}
        .ap-logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;color:#F7F3EE;letter-spacing:.01em;}
        .ap-logo em{font-style:italic;color:#D4B896;}
        .ap-home-link{font-size:12px;font-weight:600;letter-spacing:.04em;color:#D4B896;text-decoration:none;padding:6px 12px;border:1px solid rgba(212,184,150,.35);border-radius:999px;transition:background .15s,color .15s;white-space:nowrap;}
        .ap-home-link:hover{background:rgba(212,184,150,.14);color:#F7F3EE;}
        .ap-user-block{display:flex;align-items:center;gap:28px;}
        .ap-user-id{display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
        .ap-user-name{font-size:15px;line-height:1;color:#EFE3D0;font-weight:600;letter-spacing:.01em;}
        .ap-user-role{font-size:10px;line-height:1;color:#B89A6A;letter-spacing:.16em;text-transform:uppercase;font-weight:600;}
        .ap-user-sep{width:1px;height:32px;background:rgba(212,184,150,.22);flex-shrink:0;}
        .ap-tabs{background:#fff;border-bottom:1px solid #EDE6DC;}
        .ap-tabs-inner{max-width:1280px;margin:0 auto;padding:0 32px;display:flex;gap:4px;overflow-x:auto;}
        .ap-tab{display:flex;align-items:center;gap:8px;padding:19px 22px 15px;border:none;background:none;cursor:pointer;font-family:'Jost',sans-serif;font-size:13px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#7A7268;border-bottom:3px solid transparent;transition:all .2s;white-space:nowrap;}
        .ap-tab:hover{color:#2C2825;background:#FAF6F1;}
        .ap-tab.on{color:#2C2825;font-weight:700;border-bottom-color:#B89A6A;}
        .ap-tab-badge{font-size:11px;font-weight:600;letter-spacing:0;padding:1px 7px;border-radius:20px;background:#F0E9DD;color:#9E8B67;}
        .ap-tab.on .ap-tab-badge{background:#B89A6A;color:#FDFAF6;}
        .ap-body{max-width:1280px;margin:0 auto;padding:40px 32px 80px;}
        .ap-greeting{margin-bottom:36px;}
        .ap-greeting h1{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,4vw,44px);font-weight:300;color:#2C2825;margin:0 0 8px;}
        .ap-greeting h1 em{font-style:italic;color:#B89A6A;}
        .ap-greeting p{font-size:17px;font-weight:400;color:#8A7B6E;line-height:1.5;}
        .ap-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px;margin-bottom:36px;}
        .ap-stat{background:#fff;border:1px solid #EDE6DC;border-radius:6px;padding:28px 26px;}
        .ap-stat-label{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#6B5D50;margin-bottom:14px;}
        .ap-stat-value{font-family:'Jost',sans-serif;font-size:40px;font-weight:600;color:#2C2825;line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums;}
        .ap-stat-sub{font-size:13px;font-weight:400;color:#9C8768;margin-top:8px;line-height:1.4;}
        .ap-stat-link{display:block;text-decoration:none;transition:box-shadow .2s,transform .2s;}
        .ap-stat-link:hover{box-shadow:0 6px 18px rgba(44,40,37,0.10);transform:translateY(-2px);}
        .ap-stat-cta{font-size:12px;font-weight:600;color:#B89A6A;margin-top:12px;}
        .ap-rev-note{font-size:12px;font-weight:400;color:#9E968E;margin-top:6px;line-height:1.45;letter-spacing:.01em;}
        .ap-viewall{padding:10px 20px;border-radius:999px;background:#2C2825;border:1px solid #2C2825;font-family:'Jost',sans-serif;font-size:13px;font-weight:600;letter-spacing:.06em;color:#F7F3EE;cursor:pointer;transition:all .2s;}
        .ap-viewall:hover{background:#B89A6A;border-color:#B89A6A;}
        .ap-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;}
        .ap-filter{padding:8px 16px;border-radius:999px;border:1.5px solid #EDE6DC;background:#fff;font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9E968E;cursor:pointer;transition:all .2s;}
        .ap-filter:hover{border-color:#B89A6A;color:#2C2825;}
        .ap-filter.on{background:#2C2825;border-color:#2C2825;color:#F7F3EE;}

        /* ✅ Updated grid — 7 columns including Notes */
        .ap-table{background:#fff;border:1px solid #EDE6DC;border-radius:6px;overflow:hidden;}
        .ap-table-head{display:grid;grid-template-columns:1.1fr 1.2fr 1fr 0.7fr 1fr 0.9fr 1.2fr;gap:12px;padding:14px 24px;background:#FDFAF6;border-bottom:1px solid #EDE6DC;}
        .ap-th{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9E968E;}
        .ap-row{display:grid;grid-template-columns:1.1fr 1.2fr 1fr 0.7fr 1fr 0.9fr 1.2fr;gap:12px;padding:18px 24px;border-bottom:1px solid #F5F0EB;align-items:center;transition:background .15s;}
        .ap-row:last-child{border-bottom:none;}
        .ap-row:hover{background:#FDFAF6;}
        .ap-row.new-booking{background:#F0FDF4;}
        .ap-row-name{font-size:14px;font-weight:600;color:#2C2825;}
        .ap-row-email{font-size:11px;color:#9E968E;margin-top:2px;}
        .ap-row-service{font-size:13px;font-weight:500;color:#2C2825;}
        .ap-row-price{font-size:11px;color:#B89A6A;margin-top:2px;}
        .ap-row-date{font-size:13px;color:#2C2825;}
        .ap-row-time{font-size:11px;color:#9E968E;margin-top:2px;}
        .ap-notes{font-size:12px;color:#6B635A;font-style:italic;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
        .ap-notes.na{font-style:normal;color:#C4BAB0;}
        .ap-status{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.04em;}
        .ap-action-btn{padding:6px 14px;border-radius:3px;border:none;font-family:'Jost',sans-serif;font-size:11px;font-weight:700;letter-spacing:.08em;cursor:pointer;transition:all .2s;}
        .ap-action-btn:disabled{opacity:.5;cursor:not-allowed;}
        .ap-actions{display:flex;gap:8px;flex-wrap:wrap;}
        .ap-empty{padding:60px 24px;text-align:center;color:#9E968E;}
        .ap-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;}
        .ap-section-title{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400;color:#2C2825;margin:0;}
        .ap-add-btn{background:#2C2825;color:#F7F3EE;border:none;padding:10px 20px;border-radius:3px;font-family:'Jost',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:background .2s;}
        .ap-add-btn:hover{background:#B89A6A;}
        .ap-staff-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;}
        .ap-staff-card{background:#fff;border:1px solid #EDE6DC;border-radius:6px;padding:22px 24px;}
        .ap-staff-thumb{position:relative;width:100%;aspect-ratio:16/10;border-radius:4px;overflow:hidden;margin-bottom:16px;background:#EDE6DC;}
        .ap-staff-thumb img{object-fit:cover;}
        .ap-staff-name{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;color:#2C2825;margin:0 0 4px;}
        .ap-staff-spec{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#B89A6A;margin-bottom:12px;}
        .ap-staff-info{font-size:13px;font-weight:300;color:#9E968E;line-height:1.7;}
        .ap-staff-actions{display:flex;gap:10px;margin-top:14px;}
        .ap-staff-edit{background:none;border:1px solid #E8E0D6;color:#6B635A;padding:6px 14px;border-radius:3px;font-size:11px;font-family:'Jost',sans-serif;cursor:pointer;transition:all .2s;}
        .ap-staff-edit:hover{border-color:#B89A6A;color:#B89A6A;background:#FBF8F3;}
        .ap-staff-remove{background:none;border:1px solid #FECACA;color:#B91C1C;padding:6px 14px;border-radius:3px;font-size:11px;font-family:'Jost',sans-serif;cursor:pointer;transition:all .2s;}
        .ap-staff-remove:hover{background:#FEE2E2;}
        .ap-gallery-layout{display:grid;grid-template-columns:360px 1fr;gap:32px;align-items:start;}
        .ap-upload-card{background:#fff;border:1px solid #EDE6DC;border-radius:6px;padding:28px;position:sticky;top:24px;}
        .ap-upload-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:#2C2825;margin:0 0 20px;}
        .ap-drop-zone{border:2px dashed #EDE6DC;border-radius:6px;padding:32px 20px;text-align:center;cursor:pointer;transition:all .2s;background:#FDFAF6;}
        .ap-drop-zone:hover{border-color:#B89A6A;background:#F7F3EE;}
        .ap-drop-icon{width:48px;height:48px;background:#EDE6DC;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#B89A6A;}
        .ap-drop-text{font-size:13px;font-weight:500;color:#6B635A;margin-bottom:4px;}
        .ap-drop-hint{font-size:11px;color:#9E968E;}
        .ap-preview{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;margin-top:16px;display:block;}
        .ap-form-field{margin-bottom:16px;margin-top:16px;}
        .ap-form-label{display:block;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6B635A;margin-bottom:7px;}
        .ap-form-input{width:100%;padding:11px 14px;border:1px solid #E8E0D6;border-radius:3px;font-family:'Jost',sans-serif;font-size:14px;font-weight:300;color:#2C2825;outline:none;transition:border-color .2s;box-sizing:border-box;}
        .ap-form-input:focus{border-color:#B89A6A;}
        .ap-form-select{width:100%;padding:11px 14px;border:1px solid #E8E0D6;border-radius:3px;font-family:'Jost',sans-serif;font-size:14px;font-weight:300;color:#2C2825;outline:none;background:#fff;cursor:pointer;}
        .ap-progress{height:4px;background:#EDE6DC;border-radius:2px;margin-top:12px;overflow:hidden;}
        .ap-progress-bar{height:100%;background:#B89A6A;border-radius:2px;transition:width .3s ease;}
        .ap-upload-btn{width:100%;padding:12px;background:#2C2825;color:#F7F3EE;border:none;border-radius:3px;font-family:'Jost',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;margin-top:16px;transition:background .2s;}
        .ap-upload-btn:hover:not(:disabled){background:#B89A6A;}
        .ap-upload-btn:disabled{opacity:.5;cursor:not-allowed;}
        .ap-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;}
        .ap-gallery-item{position:relative;border-radius:6px;overflow:hidden;border:1px solid #EDE6DC;background:#EDE6DC;aspect-ratio:4/3;}
        .ap-gallery-img{object-fit:cover;transition:transform .3s;}
        .ap-gallery-item:hover .ap-gallery-img{transform:scale(1.04);}
        .ap-gallery-overlay{position:absolute;inset:0;background:rgba(44,40,37,0);transition:background .2s;display:flex;flex-direction:column;justify-content:space-between;padding:10px;}
        .ap-gallery-item:hover .ap-gallery-overlay{background:rgba(44,40,37,.55);}
        .ap-gallery-cat{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;background:rgba(44,40,37,.7);color:#D4B896;padding:3px 8px;border-radius:2px;width:fit-content;opacity:0;transition:opacity .2s;}
        .ap-gallery-item:hover .ap-gallery-cat{opacity:1;}
        .ap-gallery-del{background:#EF4444;color:#fff;border:none;border-radius:3px;padding:5px 10px;font-size:10px;font-family:'Jost',sans-serif;font-weight:700;cursor:pointer;opacity:0;transition:opacity .2s;align-self:flex-end;}
        .ap-gallery-item:hover .ap-gallery-del{opacity:1;}
        .ap-form-overlay{position:fixed;inset:0;background:rgba(44,40,37,.5);z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;}
        .ap-form-card{background:#fff;border-radius:8px;padding:36px 40px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(44,40,37,.15);}
        .ap-form-title{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400;color:#2C2825;margin:0 0 24px;}
        .ap-form-actions{display:flex;gap:12px;margin-top:24px;}
        .ap-form-submit{flex:1;padding:12px;background:#2C2825;color:#F7F3EE;border:none;border-radius:3px;font-family:'Jost',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:background .2s;}
        .ap-form-submit:hover:not(:disabled){background:#B89A6A;}
        .ap-form-submit:disabled{opacity:.6;cursor:not-allowed;}
        .ap-form-cancel{padding:12px 20px;background:transparent;border:1px solid #EDE6DC;color:#9E968E;border-radius:3px;font-family:'Jost',sans-serif;font-size:12px;cursor:pointer;}
        .ap-form-cancel:hover{border-color:#B89A6A;}
        .ap-form-checkbox{display:flex;align-items:center;gap:9px;margin-top:18px;font-family:'Jost',sans-serif;font-size:13px;color:#6B635A;cursor:pointer;}
        .ap-form-checkbox input{width:15px;height:15px;accent-color:#B89A6A;cursor:pointer;}
        .ap-toast{position:fixed;top:24px;right:24px;z-index:100;padding:14px 20px;border-radius:4px;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.12);animation:ap-fadein .2s ease;}
        @keyframes ap-fadein{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .ap-loading{display:flex;align-items:center;justify-content:center;min-height:50vh;}
        .ap-spinner{width:36px;height:36px;border:3px solid #EDE6DC;border-top-color:#B89A6A;border-radius:50%;animation:ap-spin .8s linear infinite;}
        @keyframes ap-spin{to{transform:rotate(360deg)}}
        @media(max-width:1024px){.ap-gallery-layout{grid-template-columns:1fr;}.ap-upload-card{position:static;}}
        @media(max-width:900px){
          .ap-table-head,.ap-row{grid-template-columns:1fr 1fr 1fr;}
          .ap-th:nth-child(n+4),.ap-row>*:nth-child(n+4){display:none;}
          .ap-body{padding:24px 16px 60px;}
          .ap-tabs-inner{padding:0 16px;}
        }
        /* Hero tab — compact live preview reusing the homepage hero's own
           gradient/typography so what the admin sees here matches what
           goes live (see components/HeroSlider.tsx). */
        .ap-hero-preview{position:relative;border-radius:6px;overflow:hidden;background-size:cover;background-position:center;background-color:#2C2825;padding:32px 24px;margin-top:20px;min-height:190px;display:flex;flex-direction:column;justify-content:center;}
        .ap-hero-preview-rule{display:block;width:32px;height:2px;background:#D4B896;margin-bottom:14px;}
        .ap-hero-preview-h1{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:#F7F3EE;line-height:1.15;margin:0 0 10px;}
        .ap-hero-preview-h1 em{font-style:italic;color:#D4B896;}
        .ap-hero-preview-p{font-size:12px;font-weight:300;color:#D9D1C7;max-width:360px;line-height:1.6;margin:0 0 16px;}
        .ap-hero-preview-cta{display:inline-block;width:fit-content;background:transparent;color:#F7F3EE;border:1px solid #D4B896;font-family:'Jost',sans-serif;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:9px 18px;border-radius:2px;}
      `}</style>

      {toast && (
        <div className="ap-toast" style={{ background: toast.type === 'success' ? '#065F46' : '#991B1B', color:'#fff' }}>
          {toast.msg}
        </div>
      )}

      {newBookingIds.size > 0 && (
        <div style={{ background:'#D1FAE5', borderBottom:'1px solid #6EE7B7', padding:'12px 32px' }}>
          <p style={{ fontSize:13, color:'#065F46', fontWeight:600, maxWidth:1280, margin:'0 auto' }}>
            🔔 New booking just received! Check the Bookings tab.
          </p>
        </div>
      )}

      {newRequestIds.size > 0 && (
        <div style={{ background:'#FEF3C7', borderBottom:'1px solid #FDE68A', padding:'12px 32px' }}>
          <p style={{ fontSize:13, color:'#92400E', fontWeight:600, maxWidth:1280, margin:'0 auto' }}>
            🔔 New change request just received! Check the Requests tab.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="ap-header">
        <div className="ap-header-inner">
          <div style={{ display:'flex', alignItems:'center', gap:24 }}>
            <Link href="/" className="ap-logo" style={{ textDecoration:'none' }}>
              Crown <em>&amp; Glow</em>
            </Link>
            <Link href="/" className="ap-home-link">
              ← Back to Home
            </Link>
          </div>
          <div style={{ textAlign:'right' }}>
            <p className="ap-user-name">{user.name}</p>
            <p className="ap-user-role">Administrator</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ap-tabs">
        <div className="ap-tabs-inner">
          {([
            { key:'overview', label:'Overview' },
            { key:'bookings', label:'Bookings' },
            { key:'requests', label:'Requests', badge: changeRequests.length || undefined },
            { key:'staff',    label:'Staff' },
            { key:'services', label:`Services (${services.length})` },
            { key:'gallery',  label:`Gallery (${gallery.length})` },
            { key:'hero',     label:`Hero (${heroSlides.length})` },
          ] as { key: AdminTab; label: string; badge?: number }[]).map(t => (
            <button key={t.key} className={`ap-tab${activeTab === t.key ? ' on' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
              {!!t.badge && <span className="ap-tab-badge">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="ap-loading"><div className="ap-spinner"/></div>
      ) : (
        <div className="ap-body">

          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <>
              <div className="ap-greeting">
                <h1>{greeting}, <em>{user.name.split(' ')[0]}.</em></h1>
                <p>Here&apos;s what&apos;s happening at Crown &amp; Glow today.</p>
              </div>
              <div className="ap-stats">
                {[
                  { label:'Total Bookings', value:stats.total,     color:'#2C2825', sub:'all time' },
                  { label:'Pending',        value:stats.pending,   color:'#F59E0B', sub:'need action' },
                  { label:'Confirmed',      value:stats.confirmed, color:'#10B981', sub:'upcoming' },
                  { label:'Completed',      value:stats.completed, color:'#3B82F6', sub:'delivered' },
                ].map(s => (
                  <div key={s.label} className="ap-stat">
                    <p className="ap-stat-label">{s.label}</p>
                    <p className="ap-stat-value" style={{ color:s.color }}>{s.value}</p>
                    <p className="ap-stat-sub">{s.sub}</p>
                  </div>
                ))}
                <Link href="/admin/revenue" className="ap-stat ap-stat-link" style={{ borderColor:'#B89A6A' }}>
                  <p className="ap-stat-label">Revenue</p>
                  <p className="ap-stat-value">${stats.revenue.toLocaleString('en-US')}</p>
                  <p className="ap-stat-sub" style={{ color:'#B89A6A' }}>completed + paid only</p>
                  <p className="ap-rev-note">Excludes pending, cancelled &amp; unpaid</p>
                  <p className="ap-stat-cta">View full report →</p>
                </Link>
                <div className="ap-stat">
                  <p className="ap-stat-label">Gallery</p>
                  <p className="ap-stat-value">{gallery.length}</p>
                  <p className="ap-stat-sub">photos published</p>
                </div>
              </div>
              <div style={{ background:'#fff', border:'1px solid #EDE6DC', borderRadius:6, overflow:'hidden' }}>
                <div style={{ padding:'22px 24px', borderBottom:'1px solid #EDE6DC', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:400, color:'#2C2825', margin:0 }}>Recent Bookings</h2>
                  <button className="ap-viewall" onClick={() => setActiveTab('bookings')}>View All →</button>
                </div>
                {bookings.slice(0,5).map(b => {
                  const cfg  = STATUS_CONFIG[b.status];
                  const date = new Date(b.appointment_date);
                  return (
                    <div key={b.id} style={{ padding:'22px 24px', borderBottom:'1px solid #F5F0EB', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                      <div>
                        <p style={{ fontSize:16, fontWeight:600, color:'#2C2825', margin:'0 0 5px' }}>{b.user.name}</p>
                        <p style={{ fontSize:13, fontWeight:400, color:'#9E968E' }}>{b.service.name} · {date.toLocaleDateString('en-US',{month:'short',day:'numeric'})} at {date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</p>
                      </div>
                      <span className="ap-status" style={{ background:cfg.bg, color:cfg.text }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:cfg.dot, display:'inline-block' }}/>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Bookings ── */}
          {activeTab === 'bookings' && (
            <>
              <div className="ap-greeting">
                <h1>Booking <em>Management</em></h1>
                <p>Review, confirm and manage all appointments.</p>
              </div>
              <div className="ap-filters">
                {(['ALL','PENDING','CONFIRMED','COMPLETED','CANCELLED'] as const).map(s => (
                  <button key={s} className={`ap-filter${filter === s ? ' on' : ''}`} onClick={() => setFilter(s)}>
                    {s === 'ALL' ? 'All' : STATUS_CONFIG[s].label}{' '}
                    <span style={{ opacity:.6 }}>{s === 'ALL' ? bookings.length : bookings.filter(b => b.status === s).length}</span>
                  </button>
                ))}
              </div>
              <div className="ap-table">
                {/* ✅ 7 column header — Notes added */}
                <div className="ap-table-head">
                  {['Customer','Service','Date & Time','Staff','Notes','Status','Actions'].map(h => (
                    <p key={h} className="ap-th">{h}</p>
                  ))}
                </div>
                {filtered.length === 0 ? (
                  <div className="ap-empty">No bookings in this category.</div>
                ) : (
                  filtered.map(booking => {
                    const cfg   = STATUS_CONFIG[booking.status];
                    const date  = new Date(booking.appointment_date);
                    const isNew = newBookingIds.has(booking.id);
                    return (
                      <div key={booking.id} className={`ap-row${isNew ? ' new-booking' : ''}`}>
                        {/* Customer */}
                        <div>
                          <p className="ap-row-name">{booking.user.name}</p>
                          <p className="ap-row-email">{booking.user.email}</p>
                        </div>
                        {/* Service */}
                        <div>
                          <p className="ap-row-service">{booking.service.name}</p>
                          <p className="ap-row-price">${Number(booking.total_price).toLocaleString('en-US')} · {booking.duration}min</p>
                        </div>
                        {/* Date & Time */}
                        <div>
                          <p className="ap-row-date">{date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                          <p className="ap-row-time">{date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</p>
                        </div>
                        {/* Staff */}
                        <p style={{ fontSize:13, color:'#9E968E' }}>{booking.staff?.name || 'Any'}</p>
                        {/* ✅ Notes — shows customer note or N/A */}
                        <p className={`ap-notes${booking.notes ? '' : ' na'}`}>
                          {booking.notes || 'N/A'}
                        </p>
                        {/* Status */}
                        <span className="ap-status" style={{ background:cfg.bg, color:cfg.text }}>
                          <span style={{ width:5, height:5, borderRadius:'50%', background:cfg.dot, display:'inline-block' }}/>
                          {cfg.label}
                        </span>
                        {/* Actions */}
                        <div className="ap-actions">
                          {booking.status === 'PENDING' && (<>
                            <button className="ap-action-btn" style={{ background:'#065F46', color:'#fff' }} disabled={updatingId === booking.id} onClick={() => updateStatus(booking.id,'CONFIRMED')}>{updatingId === booking.id ? '…' : 'Confirm'}</button>
                            <button className="ap-action-btn" style={{ background:'#FEE2E2', color:'#991B1B' }} disabled={updatingId === booking.id} onClick={() => updateStatus(booking.id,'CANCELLED')}>Cancel</button>
                          </>)}
                          {booking.status === 'CONFIRMED' && (<>
                            <button className="ap-action-btn" style={{ background:'#1E40AF', color:'#fff' }} disabled={updatingId === booking.id} onClick={() => updateStatus(booking.id,'COMPLETED')}>{updatingId === booking.id ? '…' : 'Complete'}</button>
                            <button className="ap-action-btn" style={{ background:'#FEE2E2', color:'#991B1B' }} disabled={updatingId === booking.id} onClick={() => updateStatus(booking.id,'CANCELLED')}>Cancel</button>
                          </>)}
                          {['COMPLETED','CANCELLED'].includes(booking.status) && (
                            <span style={{ fontSize:12, color:'#B89A6A' }}>No actions</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ── Change Requests ── */}
          {activeTab === 'requests' && (
            <>
              <div className="ap-greeting">
                <h1>Change <em>Requests</em></h1>
                <p>Customer-submitted edits and cancellations awaiting your approval.</p>
              </div>
              {changeRequests.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 24px', background:'#fff', border:'1px solid #EDE6DC', borderRadius:6 }}>
                  <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:'#9E968E' }}>No pending requests</p>
                  <p style={{ fontSize:13, color:'#B89A6A', marginTop:8 }}>Customer edit/cancel requests will show up here in real time.</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {changeRequests.map(req => {
                    const appt      = req.appointment;
                    const origDate  = new Date(appt.appointment_date);
                    const newDate   = req.requested_date ? new Date(req.requested_date) : null;
                    const isNew     = newRequestIds.has(req.id);
                    const isCancel  = req.type === 'CANCEL';
                    const isDeclining = declineDraftId === req.id;
                    return (
                      <div
                        key={req.id}
                        style={{
                          background: isNew ? '#F0FDF4' : '#fff',
                          border: '1px solid #EDE6DC',
                          borderRadius: 6,
                          padding: '22px 26px',
                        }}
                      >
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                              <span
                                className="ap-status"
                                style={{
                                  background: isCancel ? '#FEE2E2' : '#FEF3C7',
                                  color: isCancel ? '#991B1B' : '#92400E',
                                }}
                              >
                                {isCancel ? 'Cancellation' : 'Edit'} Request
                              </span>
                              <span style={{ fontSize:12, color:'#9E968E' }}>
                                {new Date(req.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })} at{' '}
                                {new Date(req.created_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
                              </span>
                            </div>
                            <p style={{ fontSize:16, fontWeight:600, color:'#2C2825', margin:'0 0 2px' }}>{appt.user.name}</p>
                            <p style={{ fontSize:12, color:'#9E968E' }}>{appt.user.email}</p>
                          </div>
                        </div>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginTop:18 }}>
                          <div style={{ background:'#FDFAF6', border:'1px solid #EDE6DC', borderRadius:6, padding:'14px 16px' }}>
                            <p style={{ fontSize:10, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'#9E968E', marginBottom:8 }}>
                              Original Booking
                            </p>
                            <p style={{ fontSize:13, color:'#2C2825', fontWeight:500 }}>{appt.service.name}</p>
                            <p style={{ fontSize:12, color:'#6B635A', marginTop:2 }}>
                              {origDate.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })} at{' '}
                              {origDate.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
                            </p>
                            <p style={{ fontSize:12, color:'#9E968E', marginTop:2 }}>{appt.staff?.name || 'No preference'}</p>
                          </div>

                          <div style={{ background: isCancel ? '#FEF2F2' : '#F0FDF4', border:'1px solid ' + (isCancel ? '#FECACA' : '#BBF7D0'), borderRadius:6, padding:'14px 16px' }}>
                            <p style={{ fontSize:10, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color: isCancel ? '#991B1B' : '#065F46', marginBottom:8 }}>
                              {isCancel ? 'Requested Cancellation' : 'Requested Change'}
                            </p>
                            {isCancel ? (
                              <p style={{ fontSize:13, color:'#991B1B' }}>Cancel this booking entirely</p>
                            ) : (
                              <>
                                <p style={{ fontSize:13, color:'#2C2825', fontWeight:500 }}>
                                  {req.requestedService?.name || appt.service.name}
                                </p>
                                <p style={{ fontSize:12, color:'#065F46', marginTop:2, fontWeight:600 }}>
                                  {newDate
                                    ? `${newDate.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })} at ${newDate.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}`
                                    : `${origDate.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })} at ${origDate.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })} (unchanged)`}
                                </p>
                                <p style={{ fontSize:12, color:'#6B635A', marginTop:2 }}>
                                  {req.requestedStaff?.name || appt.staff?.name || 'No preference'}
                                </p>
                              </>
                            )}
                            {req.customer_note && (
                              <p style={{ fontSize:12, color:'#6B635A', fontStyle:'italic', marginTop:8 }}>&quot;{req.customer_note}&quot;</p>
                            )}
                          </div>
                        </div>

                        {isDeclining ? (
                          <div style={{ marginTop:16 }}>
                            <textarea
                              value={declineReason}
                              onChange={e => setDeclineReason(e.target.value)}
                              placeholder="Reason for the customer (optional)"
                              maxLength={300}
                              style={{ width:'100%', padding:'10px 12px', border:'1px solid #EDE6DC', borderRadius:6, fontFamily:"'Jost',sans-serif", fontSize:13, resize:'vertical', minHeight:60 }}
                            />
                            <div style={{ display:'flex', gap:10, marginTop:10 }}>
                              <button
                                className="ap-action-btn"
                                style={{ background:'#991B1B', color:'#fff' }}
                                disabled={resolvingId === req.id}
                                onClick={() => resolveRequest(req.id, 'DECLINED', declineReason.trim() || undefined)}
                              >
                                {resolvingId === req.id ? '…' : 'Confirm Decline'}
                              </button>
                              <button
                                className="ap-action-btn"
                                style={{ background:'#F5F0EB', color:'#6B635A' }}
                                onClick={() => { setDeclineDraftId(null); setDeclineReason(''); }}
                              >
                                Never Mind
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', gap:10, marginTop:18 }}>
                            <button
                              className="ap-action-btn"
                              style={{ background:'#065F46', color:'#fff', padding:'8px 20px' }}
                              disabled={resolvingId === req.id}
                              onClick={() => resolveRequest(req.id, 'APPROVED')}
                            >
                              {resolvingId === req.id ? '…' : 'Approve'}
                            </button>
                            <button
                              className="ap-action-btn"
                              style={{ background:'#FEE2E2', color:'#991B1B', padding:'8px 20px' }}
                              disabled={resolvingId === req.id}
                              onClick={() => { setDeclineDraftId(req.id); setDeclineReason(''); }}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Staff ── */}
          {activeTab === 'staff' && (
            <>
              <div className="ap-section-head">
                <h2 className="ap-section-title">Staff <em style={{ fontStyle:'italic', color:'#B89A6A' }}>Management</em></h2>
                <button className="ap-add-btn" onClick={openAddStaff}>+ Add Staff</button>
              </div>
              {staff.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 24px', background:'#fff', border:'1px solid #EDE6DC', borderRadius:6 }}>
                  <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:'#9E968E', marginBottom:12 }}>No staff members yet</p>
                  <button className="ap-add-btn" onClick={openAddStaff}>Add your first staff member</button>
                </div>
              ) : (
                <div className="ap-staff-grid">
                  {staff.map(s => (
                    <div key={s.id} className="ap-staff-card">
                      {s.avatar && (
                        <div className="ap-staff-thumb">
                          <Image src={s.avatar} alt={s.name} fill sizes="(max-width: 900px) 100vw, 33vw" />
                        </div>
                      )}
                      <h3 className="ap-staff-name">{s.name}</h3>
                      {s.specialization && <p className="ap-staff-spec">{s.specialization}</p>}
                      <div className="ap-staff-info">
                        {s.email && <p>✉️ {s.email}</p>}
                        {s.phone && <p>📞 {s.phone}</p>}
                        {s.bio && <p style={{ marginTop:6, lineHeight:1.6 }}>{s.bio}</p>}
                        <p style={{ marginTop:6 }}>Status: <span style={{ color:s.isActive ? '#065F46' : '#991B1B', fontWeight:600 }}>{s.isActive ? 'Active' : 'Inactive'}</span></p>
                        <p style={{ marginTop:2, fontSize:12, color:'#9E968E' }}>
                          {s.isActive ? 'Shown on the public About page' : 'Hidden from the public About page'}
                        </p>
                        <p style={{ marginTop:6 }}>
                          Portal login:{' '}
                          {s.user ? (
                            <span style={{ color:'#065F46', fontWeight:600 }}>{s.user.name} ({s.user.email})</span>
                          ) : (
                            <span style={{ color:'#9E968E' }}>None</span>
                          )}
                        </p>
                      </div>
                      <div className="ap-staff-actions">
                        <button className="ap-staff-edit" onClick={() => openEditStaff(s)}>Edit</button>
                        <button className="ap-staff-remove" onClick={() => handleRemoveStaff(s.id, s.name)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Services ── */}
          {activeTab === 'services' && (
            <>
              <div className="ap-section-head">
                <h2 className="ap-section-title">Services <em style={{ fontStyle:'italic', color:'#B89A6A' }}>Management</em></h2>
                <button className="ap-add-btn" onClick={openAddService}>+ Add Service</button>
              </div>
              {services.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 24px', background:'#fff', border:'1px solid #EDE6DC', borderRadius:6 }}>
                  <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:'#9E968E', marginBottom:12 }}>No services yet</p>
                  <button className="ap-add-btn" onClick={openAddService}>Add your first service</button>
                </div>
              ) : (
                <div className="ap-staff-grid">
                  {services.map(sv => (
                    <div key={sv.id} className="ap-staff-card">
                      {sv.image && (
                        <div className="ap-staff-thumb">
                          <Image src={sv.image} alt={sv.name} fill sizes="(max-width: 900px) 100vw, 33vw" />
                        </div>
                      )}
                      <h3 className="ap-staff-name">{sv.name}</h3>
                      <p className="ap-staff-spec">
                        {SERVICE_CATEGORIES.find(c => c.value === sv.category)?.label || sv.category}
                      </p>
                      <div className="ap-staff-info">
                        {sv.description && <p>{sv.description}</p>}
                        <p style={{ marginTop:6 }}>⏱ {sv.duration} min &nbsp;·&nbsp; ${Number(sv.price).toFixed(2)}</p>
                        <p style={{ marginTop:6 }}>Status: <span style={{ color:sv.isActive ? '#065F46' : '#991B1B', fontWeight:600 }}>{sv.isActive ? 'Active' : 'Inactive'}</span></p>
                      </div>
                      <div className="ap-staff-actions">
                        <button className="ap-staff-edit" onClick={() => openEditService(sv)}>Edit</button>
                        <button className="ap-staff-remove" onClick={() => handleRemoveService(sv.id, sv.name)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Gallery ── */}
          {activeTab === 'gallery' && (
            <>
              <div className="ap-section-head">
                <h2 className="ap-section-title">Gallery <em style={{ fontStyle:'italic', color:'#B89A6A' }}>Management</em></h2>
                <p style={{ fontSize:13, color:'#9E968E' }}>{gallery.length} photos · Cloudinary CDN</p>
              </div>
              <div className="ap-gallery-layout">
                <div className="ap-upload-card">
                  <h3 className="ap-upload-title">Upload New Photo</h3>
                  <form onSubmit={handleGalleryUpload}>
                    <div className="ap-drop-zone" onClick={() => fileInputRef.current?.click()}>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} style={{ display:'none' }}/>
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local blob: object URL, not an optimizable remote image
                        <img src={previewUrl} alt="Preview" className="ap-preview"/>
                      ) : (
                        <>
                          <div className="ap-drop-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21,15 16,10 5,21"/>
                            </svg>
                          </div>
                          <p className="ap-drop-text">Click to select photo</p>
                          <p className="ap-drop-hint">JPG, PNG or WebP · Max 10MB</p>
                        </>
                      )}
                    </div>
                    {selectedFile && <p style={{ fontSize:12, color:'#9E968E', marginTop:8, textAlign:'center' }}>{selectedFile.name} · {(selectedFile.size/1024/1024).toFixed(2)}MB</p>}
                    <div className="ap-form-field">
                      <label className="ap-form-label">Category *</label>
                      <select className="ap-form-select" value={galleryForm.category} onChange={e => setGalleryForm(p => ({ ...p, category:e.target.value }))}>
                        {GALLERY_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="ap-form-field" style={{ marginTop:12 }}>
                      <label className="ap-form-label">Description (optional)</label>
                      <input className="ap-form-input" type="text" value={galleryForm.alt_text} onChange={e => setGalleryForm(p => ({ ...p, alt_text:e.target.value }))} placeholder="e.g. Eyebrow lamination result"/>
                    </div>
                    {galleryUploading && <div className="ap-progress"><div className="ap-progress-bar" style={{ width:`${uploadProgress}%` }}/></div>}
                    <button type="submit" className="ap-upload-btn" disabled={galleryUploading || !selectedFile}>
                      {galleryUploading ? (uploadProgress < 80 ? `Uploading… ${uploadProgress}%` : 'Saving…') : 'Upload to Gallery'}
                    </button>
                  </form>
                </div>
                <div>
                  <div className="ap-filters" style={{ marginBottom:20 }}>
                    <button className={`ap-filter${galleryFilter==='all'?' on':''}`} onClick={() => setGalleryFilter('all')}>All <span style={{ opacity:.6 }}>{gallery.length}</span></button>
                    {GALLERY_CATEGORIES.map(c => (
                      <button key={c.value} className={`ap-filter${galleryFilter===c.value?' on':''}`} onClick={() => setGalleryFilter(c.value)}>
                        {c.label} <span style={{ opacity:.6 }}>{gallery.filter(g => g.category===c.value).length}</span>
                      </button>
                    ))}
                  </div>
                  {filteredGallery.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'60px 24px', background:'#fff', border:'1px solid #EDE6DC', borderRadius:6 }}>
                      <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'#9E968E', marginBottom:8 }}>No photos yet</p>
                      <p style={{ fontSize:13, color:'#B89A6A' }}>Upload your first photo using the panel on the left.</p>
                    </div>
                  ) : (
                    <div className="ap-gallery-grid">
                      {filteredGallery.map(img => (
                        <div key={img.id} className="ap-gallery-item">
                          <Image src={img.url} alt={img.alt_text||'Gallery'} fill sizes="(max-width: 900px) 50vw, 25vw" className="ap-gallery-img"/>
                          <div className="ap-gallery-overlay">
                            <span className="ap-gallery-cat">{GALLERY_CATEGORIES.find(c => c.value===img.category)?.label || img.category}</span>
                            <button className="ap-gallery-del" onClick={() => handleDeleteImage(img.id)}>Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Hero ── */}
          {activeTab === 'hero' && (
            <>
              <div className="ap-section-head">
                <h2 className="ap-section-title">Homepage Hero <em style={{ fontStyle:'italic', color:'#B89A6A' }}>Slides</em></h2>
                <button className="ap-add-btn" onClick={openAddHero}>+ Add Slide</button>
              </div>
              <p style={{ fontSize:13, color:'#9E968E', marginTop:-12, marginBottom:24, maxWidth:640, lineHeight:1.6 }}>
                {/* How to change the homepage background, in plain terms for whoever is running this panel. */}
                Change the homepage background here — upload a new photo, edit the headline or button, and save. No code change or redeploy needed.
                With two or more active slides the homepage automatically rotates through them; with exactly one, it displays as a static hero.
              </p>
              {heroSlides.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 24px', background:'#fff', border:'1px solid #EDE6DC', borderRadius:6 }}>
                  <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:'#9E968E', marginBottom:12 }}>No hero slides yet</p>
                  <button className="ap-add-btn" onClick={openAddHero}>Add your first slide</button>
                </div>
              ) : (
                <div className="ap-staff-grid">
                  {heroSlides.map((h, i) => (
                    <div key={h.id} className="ap-staff-card">
                      <div className="ap-staff-thumb">
                        <Image src={h.imageUrl} alt={h.title} fill sizes="(max-width: 900px) 100vw, 33vw" />
                      </div>
                      <h3 className="ap-staff-name">{h.title}{h.titleAccent ? ` ${h.titleAccent}` : ''}</h3>
                      <p className="ap-staff-spec">Slide {i + 1} of {heroSlides.length} &middot; Order {h.sortOrder}</p>
                      <div className="ap-staff-info">
                        <p>{h.description}</p>
                        <p style={{ marginTop:6 }}>Button: <strong>{h.ctaLabel}</strong> &rarr; {h.ctaHref}</p>
                        <p style={{ marginTop:6 }}>Status: <span style={{ color:h.isActive ? '#065F46' : '#991B1B', fontWeight:600 }}>{h.isActive ? 'Active' : 'Inactive'}</span></p>
                      </div>
                      <div className="ap-staff-actions" style={{ flexWrap:'wrap' }}>
                        <button className="ap-staff-edit" onClick={() => handleReorderHero(h.id, 'up')} disabled={i === 0} title="Move earlier">&uarr;</button>
                        <button className="ap-staff-edit" onClick={() => handleReorderHero(h.id, 'down')} disabled={i === heroSlides.length - 1} title="Move later">&darr;</button>
                        <button className="ap-staff-edit" onClick={() => handleToggleHeroActive(h)}>{h.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button className="ap-staff-edit" onClick={() => openEditHero(h)}>Edit</button>
                        <button className="ap-staff-remove" onClick={() => handleDeleteHero(h.id, h.title)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {showStaffForm && (
        <div className="ap-form-overlay" onClick={closeStaffForm}>
          <div className="ap-form-card" onClick={e => e.stopPropagation()}>
            <h2 className="ap-form-title">{editingStaffId ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
            <form onSubmit={handleSaveStaff}>
              <div className="ap-form-field" style={{ marginTop:0 }}>
                <label className="ap-form-label">Full Name *</label>
                <input className="ap-form-input" type="text" required value={staffForm.name} placeholder="Priya Sharma" onChange={e => setStaffForm(p => ({ ...p, name:e.target.value }))}/>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Specialization</label>
                <input className="ap-form-input" type="text" value={staffForm.specialization} placeholder="e.g. Eyebrow & Lash Expert" onChange={e => setStaffForm(p => ({ ...p, specialization:e.target.value }))}/>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Email</label>
                <input className="ap-form-input" type="email" value={staffForm.email} placeholder="staff@crownandglow.com" onChange={e => setStaffForm(p => ({ ...p, email:e.target.value }))}/>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Phone</label>
                <input className="ap-form-input" type="tel" value={staffForm.phone} placeholder="(317) 555-0187" onChange={e => setStaffForm(p => ({ ...p, phone:e.target.value }))}/>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Bio</label>
                <textarea
                  className="ap-form-input"
                  rows={3}
                  value={staffForm.bio}
                  placeholder="A couple of sentences for the About page — experience, specialty, what clients love."
                  onChange={e => setStaffForm(p => ({ ...p, bio:e.target.value }))}
                  style={{ resize:'vertical' }}
                />
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Photo</label>
                <div className="ap-drop-zone" onClick={() => staffFileInputRef.current?.click()}>
                  <input ref={staffFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleStaffFileSelect} style={{ display:'none' }}/>
                  {staffPreviewUrl || staffForm.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- may be a local blob: preview, not always an optimizable remote image
                    <img src={staffPreviewUrl || staffForm.avatar} alt="Preview" className="ap-preview"/>
                  ) : (
                    <>
                      <div className="ap-drop-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21,15 16,10 5,21"/>
                        </svg>
                      </div>
                      <p className="ap-drop-text">Click to select photo</p>
                      <p className="ap-drop-hint">JPG, PNG or WebP · Max 10MB</p>
                    </>
                  )}
                </div>
                {(staffPreviewUrl || staffForm.avatar) && (
                  <button
                    type="button"
                    onClick={handleRemoveStaffPhoto}
                    style={{ marginTop:8, background:'none', border:'none', color:'#991B1B', fontSize:12, fontWeight:600, cursor:'pointer', padding:0 }}
                  >
                    Remove photo
                  </button>
                )}
                {selectedStaffFile && <p style={{ fontSize:12, color:'#9E968E', marginTop:8, textAlign:'center' }}>{selectedStaffFile.name} · {(selectedStaffFile.size/1024/1024).toFixed(2)}MB</p>}
                {staffUploading && <div className="ap-progress"><div className="ap-progress-bar" style={{ width:`${staffUploadProgress}%` }}/></div>}
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Portal Login</label>
                <select
                  className="ap-form-select"
                  value={staffForm.user_id}
                  onChange={e => setStaffForm(p => ({ ...p, user_id: e.target.value }))}
                >
                  <option value="">No portal login</option>
                  {linkableAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                  ))}
                </select>
                <p style={{ fontSize:12, color:'#9E968E', marginTop:6, lineHeight:1.5 }}>
                  Linking a customer account here promotes it to Staff and scopes that
                  login to only this person&apos;s own bookings. Only accounts not
                  already linked to another staff member are listed.
                </p>
              </div>
              {editingStaffId && (
                <label className="ap-form-checkbox">
                  <input type="checkbox" checked={staffForm.isActive} onChange={e => setStaffForm(p => ({ ...p, isActive:e.target.checked }))}/>
                  <span>Active (visible to customers for booking, and shown on the public About page)</span>
                </label>
              )}
              <div className="ap-form-actions">
                <button type="submit" className="ap-form-submit" disabled={staffLoading}>
                  {staffLoading ? (editingStaffId ? 'Saving…' : 'Adding…') : (editingStaffId ? 'Save Changes' : 'Add Staff Member')}
                </button>
                <button type="button" className="ap-form-cancel" onClick={closeStaffForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Service Modal */}
      {showServiceForm && (
        <div className="ap-form-overlay" onClick={closeServiceForm}>
          <div className="ap-form-card" onClick={e => e.stopPropagation()}>
            <h2 className="ap-form-title">{editingServiceId ? 'Edit Service' : 'Add Service'}</h2>
            <form onSubmit={handleSaveService}>
              <div className="ap-form-field" style={{ marginTop:0 }}>
                <label className="ap-form-label">Service Name *</label>
                <input className="ap-form-input" type="text" required value={serviceForm.name} placeholder="e.g. Eyebrow Lamination" onChange={e => setServiceForm(p => ({ ...p, name:e.target.value }))}/>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Category *</label>
                <select className="ap-form-select" value={serviceForm.category} onChange={e => setServiceForm(p => ({ ...p, category:e.target.value as ServiceCategory }))}>
                  {SERVICE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Description</label>
                <input className="ap-form-input" type="text" value={serviceForm.description} placeholder="Brief description shown to customers" onChange={e => setServiceForm(p => ({ ...p, description:e.target.value }))}/>
              </div>
              <div className="ap-form-field" style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1 }}>
                  <label className="ap-form-label">Duration (min) *</label>
                  <input className="ap-form-input" type="number" min={1} max={480} required value={serviceForm.duration} placeholder="45" onChange={e => setServiceForm(p => ({ ...p, duration:e.target.value }))}/>
                </div>
                <div style={{ flex:1 }}>
                  <label className="ap-form-label">Price ($) *</label>
                  <input className="ap-form-input" type="number" min={0} step="0.01" required value={serviceForm.price} placeholder="45.00" onChange={e => setServiceForm(p => ({ ...p, price:e.target.value }))}/>
                </div>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Photo</label>
                <div className="ap-drop-zone" onClick={() => serviceFileInputRef.current?.click()}>
                  <input ref={serviceFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleServiceFileSelect} style={{ display:'none' }}/>
                  {servicePreviewUrl || serviceForm.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- may be a local blob: preview, not always an optimizable remote image
                    <img src={servicePreviewUrl || serviceForm.image} alt="Preview" className="ap-preview"/>
                  ) : (
                    <>
                      <div className="ap-drop-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21,15 16,10 5,21"/>
                        </svg>
                      </div>
                      <p className="ap-drop-text">Click to select photo</p>
                      <p className="ap-drop-hint">JPG, PNG or WebP · Max 10MB</p>
                    </>
                  )}
                </div>
                {selectedServiceFile && <p style={{ fontSize:12, color:'#9E968E', marginTop:8, textAlign:'center' }}>{selectedServiceFile.name} · {(selectedServiceFile.size/1024/1024).toFixed(2)}MB</p>}
                {serviceUploading && <div className="ap-progress"><div className="ap-progress-bar" style={{ width:`${serviceUploadProgress}%` }}/></div>}
              </div>
              <label className="ap-form-checkbox">
                <input type="checkbox" checked={serviceForm.is_popular} onChange={e => setServiceForm(p => ({ ...p, is_popular:e.target.checked }))}/>
                <span>Signature service (shows the &quot;Signature&quot; badge on the public Services page)</span>
              </label>
              <div className="ap-form-actions">
                <button type="submit" className="ap-form-submit" disabled={serviceLoading}>
                  {serviceLoading ? (editingServiceId ? 'Saving…' : 'Adding…') : (editingServiceId ? 'Save Changes' : 'Add Service')}
                </button>
                <button type="button" className="ap-form-cancel" onClick={closeServiceForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Hero Slide Modal */}
      {showHeroForm && (
        <div className="ap-form-overlay" onClick={closeHeroForm}>
          <div className="ap-form-card" onClick={e => e.stopPropagation()} style={{ maxWidth:560 }}>
            <h2 className="ap-form-title">{editingHeroId ? 'Edit Hero Slide' : 'Add Hero Slide'}</h2>
            <form onSubmit={handleSaveHero}>
              <div className="ap-form-field" style={{ marginTop:0 }}>
                <label className="ap-form-label">Background Photo {editingHeroId ? '' : '*'}</label>
                <div className="ap-drop-zone" onClick={() => heroFileInputRef.current?.click()}>
                  <input ref={heroFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleHeroFileSelect} style={{ display:'none' }}/>
                  {heroPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- may be a local blob: preview or an already-uploaded remote image
                    <img src={heroPreviewUrl} alt="Preview" className="ap-preview"/>
                  ) : (
                    <>
                      <div className="ap-drop-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21,15 16,10 5,21"/>
                        </svg>
                      </div>
                      <p className="ap-drop-text">Click to select photo</p>
                      <p className="ap-drop-hint">JPG, PNG or WebP &middot; Max 10MB</p>
                    </>
                  )}
                </div>
                {selectedHeroFile && <p style={{ fontSize:12, color:'#9E968E', marginTop:8, textAlign:'center' }}>{selectedHeroFile.name} &middot; {(selectedHeroFile.size/1024/1024).toFixed(2)}MB</p>}
                {heroUploading && <div className="ap-progress"><div className="ap-progress-bar" style={{ width:`${heroUploadProgress}%` }}/></div>}
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Title *</label>
                <input className="ap-form-input" type="text" required value={heroForm.title} placeholder="Where beauty" onChange={e => setHeroForm(p => ({ ...p, title:e.target.value }))}/>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Accent Line (italic, optional)</label>
                <input className="ap-form-input" type="text" value={heroForm.titleAccent} placeholder="meets ritual." onChange={e => setHeroForm(p => ({ ...p, titleAccent:e.target.value }))}/>
              </div>
              <div className="ap-form-field">
                <label className="ap-form-label">Description *</label>
                <input className="ap-form-input" type="text" required value={heroForm.description} placeholder="Premium beauty treatments crafted with precision, care, and artistry — for every version of you." onChange={e => setHeroForm(p => ({ ...p, description:e.target.value }))}/>
              </div>
              <div className="ap-form-field" style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1 }}>
                  <label className="ap-form-label">Button Label *</label>
                  <input className="ap-form-input" type="text" required value={heroForm.ctaLabel} placeholder="Explore Services" onChange={e => setHeroForm(p => ({ ...p, ctaLabel:e.target.value }))}/>
                </div>
                <div style={{ flex:1 }}>
                  <label className="ap-form-label">Button Link *</label>
                  <input className="ap-form-input" type="text" required value={heroForm.ctaHref} placeholder="/services" onChange={e => setHeroForm(p => ({ ...p, ctaHref:e.target.value }))}/>
                </div>
              </div>
              {editingHeroId && (
                <label className="ap-form-checkbox">
                  <input type="checkbox" checked={heroForm.isActive} onChange={e => setHeroForm(p => ({ ...p, isActive:e.target.checked }))}/>
                  <span>Active (shown in the homepage rotation)</span>
                </label>
              )}

              {/* Live preview — same gradient/typography the homepage hero uses. */}
              <div
                className="ap-hero-preview"
                style={{ backgroundImage: `linear-gradient(160deg, rgba(20,16,12,.72) 0%, rgba(44,35,25,.55) 55%, rgba(184,154,106,.28) 100%), url('${heroPreviewUrl || ''}')` }}
              >
                <span className="ap-hero-preview-rule"/>
                <p className="ap-hero-preview-h1">
                  {heroForm.title || 'Where beauty'}
                  {heroForm.titleAccent ? (<><br/><em>{heroForm.titleAccent}</em></>) : null}
                </p>
                <p className="ap-hero-preview-p">
                  {heroForm.description || 'Premium beauty treatments crafted with precision, care, and artistry — for every version of you.'}
                </p>
                <span className="ap-hero-preview-cta">{heroForm.ctaLabel || 'Explore Services'}</span>
              </div>

              <div className="ap-form-actions">
                <button type="submit" className="ap-form-submit" disabled={heroLoading}>
                  {heroLoading ? (editingHeroId ? 'Saving…' : 'Adding…') : (editingHeroId ? 'Save Changes' : 'Add Slide')}
                </button>
                <button type="button" className="ap-form-cancel" onClick={closeHeroForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

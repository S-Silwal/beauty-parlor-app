// app/admin/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
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
  isActive: boolean;
}

interface GalleryImage {
  id: string;
  url: string;
  alt_text?: string;
  category?: string;
  created_at: string;
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

type AdminTab = 'overview' | 'bookings' | 'staff' | 'gallery';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function AdminPanel() {
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();

  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [staff, setStaff]         = useState<Staff[]>([]);
  const [gallery, setGallery]     = useState<GalleryImage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [filter, setFilter]       = useState<AppointmentStatus | 'ALL'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [newBookingIds, setNewBookingIds] = useState<Set<string>>(new Set());
  const [greeting] = useState(getGreeting());

  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm]         = useState({ name: '', specialization: '', email: '', phone: '' });
  const [staffLoading, setStaffLoading]   = useState(false);

  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryForm, setGalleryForm]           = useState({ alt_text: '', category: 'brows_lashes' });
  const [selectedFile, setSelectedFile]         = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]             = useState<string | null>(null);
  const [uploadProgress, setUploadProgress]     = useState(0);
  const [galleryFilter, setGalleryFilter]       = useState('all');
  const fileInputRef                            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (!isAdmin) { router.push('/dashboard'); }
  }, [user, isAdmin, router]);

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
      const res  = await fetch(`${API}/api/staff`);
      const data = await res.json();
      if (data.success) setStaff(data.staff || []);
    } catch (err) { console.error('Failed to fetch staff', err); }
  };

  const fetchGallery = async () => {
    try {
      const res  = await fetch(`${API}/api/gallery`);
      const data = await res.json();
      if (data.success) setGallery(data.images || []);
    } catch (err) { console.error('Failed to fetch gallery', err); }
  };

  useEffect(() => {
    if (!user || !isAdmin) return;
    fetchBookings();
    fetchStaff();
    fetchGallery();
    const socket = initSocket();
    socket.on('bookingCreated', (b: Booking) => fetchBookings(b?.id));
    socket.on('bookingUpdated', () => fetchBookings());
    return () => { socket.off('bookingCreated'); socket.off('bookingUpdated'); };
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
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
        showToast(`Booking ${status.toLowerCase()} successfully`);
      } else showToast(data.message || 'Update failed', 'error');
    } catch { showToast('Failed to update booking', 'error'); }
    finally { setUpdatingId(null); }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return;
    setStaffLoading(true);
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(staffForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Staff member added successfully');
        setShowStaffForm(false);
        setStaffForm({ name: '', specialization: '', email: '', phone: '' });
        fetchStaff();
      } else showToast(data.message || 'Failed to add staff', 'error');
    } catch { showToast('Failed to add staff', 'error'); }
    finally { setStaffLoading(false); }
  };

  const handleRemoveStaff = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from staff?`)) return;
    try {
      const token = api.getToken();
      const res   = await fetch(`${API}/api/staff/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
      });
      const data = await res.json();
      if (data.success) { showToast('Staff removed'); fetchStaff(); }
      else showToast(data.message || 'Failed to remove staff', 'error');
    } catch { showToast('Failed to remove staff', 'error'); }
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
      const { signature, timestamp, apiKey, cloudName, folder, uploadUrl } = sigData;
      setUploadProgress(20);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('signature', signature);
      formData.append('timestamp', String(timestamp));
      formData.append('api_key', apiKey);
      formData.append('folder', folder);
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
    } catch (err: any) { showToast(err.message || 'Upload failed', 'error'); }
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

  if (!user || !isAdmin) return null;

  return (
    <div style={{ minHeight:'100vh', background:'#F5F0EB', fontFamily:"'Jost', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');
        .ap-header{background:#2C2825;padding:0 32px;}
        .ap-header-inner{max-width:1280px;margin:0 auto;height:68px;display:flex;align-items:center;justify-content:space-between;}
        .ap-logo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:500;color:#F7F3EE;}
        .ap-logo em{font-style:italic;color:#D4B896;}
        .ap-user-name{font-size:13px;color:#D4B896;font-weight:500;}
        .ap-user-role{font-size:10px;color:#6B635A;letter-spacing:.1em;text-transform:uppercase;}
        .ap-logout{background:none;border:1px solid rgba(212,184,150,.3);color:#9E968E;padding:6px 14px;border-radius:2px;font-size:11px;cursor:pointer;font-family:'Jost',sans-serif;letter-spacing:.08em;text-transform:uppercase;transition:all .2s;margin-left:16px;}
        .ap-logout:hover{border-color:#B89A6A;color:#D4B896;}
        .ap-tabs{background:#fff;border-bottom:1px solid #EDE6DC;}
        .ap-tabs-inner{max-width:1280px;margin:0 auto;padding:0 32px;display:flex;gap:0;overflow-x:auto;}
        .ap-tab{padding:18px 24px 14px;border:none;background:none;cursor:pointer;font-family:'Jost',sans-serif;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#9E968E;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap;}
        .ap-tab:hover{color:#2C2825;background:#F7F3EE;}
        .ap-tab.on{color:#2C2825;border-bottom-color:#B89A6A;}
        .ap-body{max-width:1280px;margin:0 auto;padding:40px 32px 80px;}
        .ap-greeting{margin-bottom:36px;}
        .ap-greeting h1{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,4vw,44px);font-weight:300;color:#2C2825;margin:0 0 6px;}
        .ap-greeting h1 em{font-style:italic;color:#B89A6A;}
        .ap-greeting p{font-size:14px;font-weight:300;color:#9E968E;}
        .ap-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px;margin-bottom:36px;}
        .ap-stat{background:#fff;border:1px solid #EDE6DC;border-radius:6px;padding:22px 24px;}
        .ap-stat-label{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9E968E;margin-bottom:10px;}
        .ap-stat-value{font-family:'Cormorant Garamond',serif;font-size:38px;font-weight:400;color:#2C2825;line-height:1;}
        .ap-stat-sub{font-size:11px;color:#B89A6A;margin-top:6px;}
        .ap-rev-note{font-size:11px;color:#9E968E;margin-top:4px;font-style:italic;}
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
        .ap-status{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.08em;}
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
        .ap-staff-name{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;color:#2C2825;margin:0 0 4px;}
        .ap-staff-spec{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#B89A6A;margin-bottom:12px;}
        .ap-staff-info{font-size:13px;font-weight:300;color:#9E968E;line-height:1.7;}
        .ap-staff-remove{margin-top:14px;background:none;border:1px solid #FECACA;color:#B91C1C;padding:6px 14px;border-radius:3px;font-size:11px;font-family:'Jost',sans-serif;cursor:pointer;transition:all .2s;}
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
        .ap-gallery-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s;}
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

      {/* Header */}
      <div className="ap-header">
        <div className="ap-header-inner">
          <div className="ap-logo">Crown <em>&amp; Glow</em> <span style={{ fontSize:11, letterSpacing:'.16em', textTransform:'uppercase', color:'#6B635A', marginLeft:12 }}>Admin</span></div>
          <div style={{ display:'flex', alignItems:'center' }}>
            <div style={{ textAlign:'right' }}>
              <p className="ap-user-name">{user.name}</p>
              <p className="ap-user-role">Administrator</p>
            </div>
            <button className="ap-logout" onClick={async () => { await logout(); router.push('/login'); }}>Logout</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ap-tabs">
        <div className="ap-tabs-inner">
          {([
            { key:'overview', label:'Overview' },
            { key:'bookings', label:'Bookings' },
            { key:'staff',    label:'Staff' },
            { key:'gallery',  label:`Gallery (${gallery.length})` },
          ] as { key: AdminTab; label: string }[]).map(t => (
            <button key={t.key} className={`ap-tab${activeTab === t.key ? ' on' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
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
                <p>Here's what's happening at Crown &amp; Glow today.</p>
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
                <div className="ap-stat" style={{ borderColor:'#B89A6A' }}>
                  <p className="ap-stat-label">Revenue</p>
                  <p className="ap-stat-value">${stats.revenue.toLocaleString('en-US')}</p>
                  <p className="ap-stat-sub" style={{ color:'#B89A6A' }}>completed + paid only</p>
                  <p className="ap-rev-note">Excludes pending, cancelled &amp; unpaid</p>
                </div>
                <div className="ap-stat">
                  <p className="ap-stat-label">Gallery</p>
                  <p className="ap-stat-value">{gallery.length}</p>
                  <p className="ap-stat-sub">photos published</p>
                </div>
              </div>
              <div style={{ background:'#fff', border:'1px solid #EDE6DC', borderRadius:6, overflow:'hidden' }}>
                <div style={{ padding:'20px 24px', borderBottom:'1px solid #EDE6DC', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, color:'#2C2825', margin:0 }}>Recent Bookings</h2>
                  <button className="ap-filter on" style={{ border:'none' }} onClick={() => setActiveTab('bookings')}>View All →</button>
                </div>
                {bookings.slice(0,5).map(b => {
                  const cfg  = STATUS_CONFIG[b.status];
                  const date = new Date(b.appointment_date);
                  return (
                    <div key={b.id} style={{ padding:'16px 24px', borderBottom:'1px solid #F5F0EB', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                      <div>
                        <p style={{ fontSize:14, fontWeight:600, color:'#2C2825', margin:'0 0 3px' }}>{b.user.name}</p>
                        <p style={{ fontSize:12, color:'#9E968E' }}>{b.service.name} · {date.toLocaleDateString('en-US',{month:'short',day:'numeric'})} at {date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</p>
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

          {/* ── Staff ── */}
          {activeTab === 'staff' && (
            <>
              <div className="ap-section-head">
                <h2 className="ap-section-title">Staff <em style={{ fontStyle:'italic', color:'#B89A6A' }}>Management</em></h2>
                <button className="ap-add-btn" onClick={() => setShowStaffForm(true)}>+ Add Staff</button>
              </div>
              {staff.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 24px', background:'#fff', border:'1px solid #EDE6DC', borderRadius:6 }}>
                  <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:'#9E968E', marginBottom:12 }}>No staff members yet</p>
                  <button className="ap-add-btn" onClick={() => setShowStaffForm(true)}>Add your first staff member</button>
                </div>
              ) : (
                <div className="ap-staff-grid">
                  {staff.map(s => (
                    <div key={s.id} className="ap-staff-card">
                      <h3 className="ap-staff-name">{s.name}</h3>
                      {s.specialization && <p className="ap-staff-spec">{s.specialization}</p>}
                      <div className="ap-staff-info">
                        {s.email && <p>✉️ {s.email}</p>}
                        {s.phone && <p>📞 {s.phone}</p>}
                        <p style={{ marginTop:6 }}>Status: <span style={{ color:s.isActive ? '#065F46' : '#991B1B', fontWeight:600 }}>{s.isActive ? 'Active' : 'Inactive'}</span></p>
                      </div>
                      <button className="ap-staff-remove" onClick={() => handleRemoveStaff(s.id, s.name)}>Remove</button>
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
                          <img src={img.url} alt={img.alt_text||'Gallery'} className="ap-gallery-img" loading="lazy"/>
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

        </div>
      )}

      {/* Add Staff Modal */}
      {showStaffForm && (
        <div className="ap-form-overlay" onClick={() => setShowStaffForm(false)}>
          <div className="ap-form-card" onClick={e => e.stopPropagation()}>
            <h2 className="ap-form-title">Add Staff Member</h2>
            <form onSubmit={handleAddStaff}>
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
              <div className="ap-form-actions">
                <button type="submit" className="ap-form-submit" disabled={staffLoading}>{staffLoading ? 'Adding…' : 'Add Staff Member'}</button>
                <button type="button" className="ap-form-cancel" onClick={() => setShowStaffForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

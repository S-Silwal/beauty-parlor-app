'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ResendVerificationPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/resend-verification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );
      // Always show success — the backend never reveals whether an
      // account exists for this email.
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');
        .rv { min-height:100vh; background:#F7F3EE; display:flex; align-items:center; justify-content:center; padding:24px; font-family:'Jost',sans-serif; }
        .rv-card { background:#fff; border-radius:8px; padding:52px 48px; max-width:460px; width:100%; box-shadow:0 8px 40px rgba(44,40,37,.08); }
        .rv-back { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500; letter-spacing:.08em; text-transform:uppercase; color:#9E968E; text-decoration:none; margin-bottom:32px; transition:color .2s; }
        .rv-back:hover { color:#B89A6A; }
        .rv-icon { width:64px; height:64px; background:#EDE6DC; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:24px; color:#B89A6A; }
        .rv-title { font-family:'Cormorant Garamond',serif; font-size:38px; font-weight:300; color:#2C2825; margin:0 0 8px; line-height:1.05; }
        .rv-title em { font-style:italic; color:#B89A6A; }
        .rv-subtitle { font-size:15px; font-weight:300; color:#9E968E; margin-bottom:36px; line-height:1.65; }
        .rv-error { background:#FEF2F2; border:1px solid #FECACA; border-radius:3px; padding:12px 16px; font-size:13px; color:#B91C1C; margin-bottom:20px; }
        .rv-label { display:block; font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:#6B635A; margin-bottom:8px; }
        .rv-input { width:100%; padding:14px 16px; background:#fff; border:1px solid #E8E0D6; border-radius:3px; font-family:'Jost',sans-serif; font-size:15px; font-weight:300; color:#2C2825; outline:none; transition:border-color .2s,box-shadow .2s; box-sizing:border-box; margin-bottom:24px; }
        .rv-input::placeholder { color:#C4BAB0; }
        .rv-input:focus { border-color:#B89A6A; box-shadow:0 0 0 3px rgba(184,154,106,.12); }
        .rv-btn { width:100%; padding:15px; background:#2C2825; color:#F7F3EE; border:none; border-radius:3px; cursor:pointer; font-family:'Jost',sans-serif; font-size:12px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; transition:background .22s,transform .2s; }
        .rv-btn:hover:not(:disabled) { background:#B89A6A; transform:translateY(-1px); }
        .rv-btn:disabled { opacity:.6; cursor:not-allowed; }
        /* Success */
        .rv-success-icon { width:72px; height:72px; background:#D1FAE5; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 24px; }
        .rv-success-title { font-family:'Cormorant Garamond',serif; font-size:36px; font-weight:300; color:#2C2825; margin:0 0 12px; text-align:center; }
        .rv-success-title em { font-style:italic; color:#B89A6A; }
        .rv-success-text { font-size:15px; font-weight:300; color:#6B635A; line-height:1.8; text-align:center; margin-bottom:32px; }
        .rv-success-btn { display:block; width:100%; text-align:center; background:#2C2825; color:#F7F3EE; text-decoration:none; padding:14px 32px; border-radius:3px; font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; transition:background .22s; }
        .rv-success-btn:hover { background:#B89A6A; }
      `}</style>

      <div className="rv">
        <div className="rv-card">

          {done ? (
            <>
              <div className="rv-success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="rv-success-title">Check your <em>email!</em></h1>
              <p className="rv-success-text">
                If an account exists for <strong style={{ color: '#2C2825' }}>{email}</strong> and
                still needs verification, we&apos;ve sent a new link. Check your inbox and spam folder.
              </p>
              <Link href="/login" className="rv-success-btn">Back to Login</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="rv-back">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back to login
              </Link>

              <div className="rv-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>

              <h1 className="rv-title">Resend <em>verification</em></h1>
              <p className="rv-subtitle">
                Enter your email and we&apos;ll send a fresh verification link.
              </p>

              {error && <div className="rv-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <label className="rv-label" htmlFor="rv-email">Email Address</label>
                <input
                  id="rv-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  suppressHydrationWarning
                  className="rv-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <button type="submit" disabled={loading} className="rv-btn" suppressHydrationWarning>
                  {loading ? 'Sending…' : 'Send Verification Email'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </>
  );
}

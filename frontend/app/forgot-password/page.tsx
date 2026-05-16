// app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/forgot-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );
      const data = await res.json();
      // Always show success (backend never reveals if email exists)
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
        .fp { min-height:100vh; background:#F7F3EE; display:flex; align-items:center; justify-content:center; padding:24px; font-family:'Jost',sans-serif; }
        .fp-card { background:#fff; border-radius:8px; padding:52px 48px; max-width:460px; width:100%; box-shadow:0 8px 40px rgba(44,40,37,.08); }
        .fp-back { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500; letter-spacing:.08em; text-transform:uppercase; color:#9E968E; text-decoration:none; margin-bottom:32px; transition:color .2s; }
        .fp-back:hover { color:#B89A6A; }
        .fp-icon { width:64px; height:64px; background:#EDE6DC; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:24px; color:#B89A6A; }
        .fp-title { font-family:'Cormorant Garamond',serif; font-size:38px; font-weight:300; color:#2C2825; margin:0 0 8px; line-height:1.05; }
        .fp-title em { font-style:italic; color:#B89A6A; }
        .fp-subtitle { font-size:15px; font-weight:300; color:#9E968E; margin-bottom:36px; line-height:1.65; }
        .fp-error { background:#FEF2F2; border:1px solid #FECACA; border-radius:3px; padding:12px 16px; font-size:13px; color:#B91C1C; margin-bottom:20px; }
        .fp-label { display:block; font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:#6B635A; margin-bottom:8px; }
        .fp-input { width:100%; padding:14px 16px; background:#fff; border:1px solid #E8E0D6; border-radius:3px; font-family:'Jost',sans-serif; font-size:15px; font-weight:300; color:#2C2825; outline:none; transition:border-color .2s,box-shadow .2s; box-sizing:border-box; margin-bottom:24px; }
        .fp-input::placeholder { color:#C4BAB0; }
        .fp-input:focus { border-color:#B89A6A; box-shadow:0 0 0 3px rgba(184,154,106,.12); }
        .fp-btn { width:100%; padding:15px; background:#2C2825; color:#F7F3EE; border:none; border-radius:3px; cursor:pointer; font-family:'Jost',sans-serif; font-size:12px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; transition:background .22s,transform .2s; }
        .fp-btn:hover:not(:disabled) { background:#B89A6A; transform:translateY(-1px); }
        .fp-btn:disabled { opacity:.6; cursor:not-allowed; }
        .fp-login { text-align:center; margin-top:24px; font-size:14px; font-weight:300; color:#9E968E; }
        .fp-login a { color:#B89A6A; font-weight:600; text-decoration:none; }
        .fp-login a:hover { color:#2C2825; }
        /* Success */
        .fp-success-icon { width:72px; height:72px; background:#D1FAE5; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 24px; }
        .fp-success-title { font-family:'Cormorant Garamond',serif; font-size:36px; font-weight:300; color:#2C2825; margin:0 0 12px; text-align:center; }
        .fp-success-title em { font-style:italic; color:#B89A6A; }
        .fp-success-text { font-size:15px; font-weight:300; color:#6B635A; line-height:1.8; text-align:center; margin-bottom:32px; }
        .fp-success-btn { display:block; width:100%; text-align:center; background:#2C2825; color:#F7F3EE; text-decoration:none; padding:14px 32px; border-radius:3px; font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; transition:background .22s; }
        .fp-success-btn:hover { background:#B89A6A; }
      `}</style>

      <div className="fp">
        <div className="fp-card">

          {done ? (
            <>
              <div className="fp-success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="fp-success-title">Check your <em>email!</em></h1>
              <p className="fp-success-text">
                If an account exists for <strong style={{ color: '#2C2825' }}>{email}</strong>,
                we've sent a password reset link. Check your inbox and spam folder.
                <br/><br/>
                The link expires in <strong>1 hour</strong>.
              </p>
              <Link href="/login" className="fp-success-btn">Back to Login</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="fp-back">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back to login
              </Link>

              <div className="fp-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>

              <h1 className="fp-title">Forgot <em>password?</em></h1>
              <p className="fp-subtitle">
                No worries! Enter your email and we'll send you a reset link.
              </p>

              {error && <div className="fp-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <label className="fp-label" htmlFor="fp-email">Email Address</label>
                <input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  suppressHydrationWarning
                  className="fp-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <button type="submit" disabled={loading} className="fp-btn" suppressHydrationWarning>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <div className="fp-login">
                Remember your password?{' '}
                <Link href="/login">Sign in</Link>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}

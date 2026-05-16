// app/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const token         = searchParams.get('token');

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  // Validate token exists
  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  // Password strength checker
  const strength = (() => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 8)          score++;
    if (/[A-Z]/.test(password))        score++;
    if (/[0-9]/.test(password))        score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (strength < 2) {
      setError('Please choose a stronger password');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: password }),
        }
      );
      const data = await res.json();

      if (!data.success) throw new Error(data.message || 'Reset failed');

      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');
        .rp { min-height:100vh; background:#F7F3EE; display:flex; align-items:center; justify-content:center; padding:24px; font-family:'Jost',sans-serif; }
        .rp-card { background:#fff; border-radius:8px; padding:52px 48px; max-width:460px; width:100%; box-shadow:0 8px 40px rgba(44,40,37,.08); }
        .rp-icon { width:64px; height:64px; background:#EDE6DC; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:24px; color:#B89A6A; }
        .rp-title { font-family:'Cormorant Garamond',serif; font-size:38px; font-weight:300; color:#2C2825; margin:0 0 8px; line-height:1.05; }
        .rp-title em { font-style:italic; color:#B89A6A; }
        .rp-subtitle { font-size:15px; font-weight:300; color:#9E968E; margin-bottom:36px; line-height:1.65; }
        .rp-error { background:#FEF2F2; border:1px solid #FECACA; border-radius:3px; padding:12px 16px; font-size:13px; color:#B91C1C; margin-bottom:20px; }
        .rp-field { margin-bottom:20px; }
        .rp-label { display:block; font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:#6B635A; margin-bottom:8px; }
        .rp-input-wrap { position:relative; }
        .rp-input { width:100%; padding:14px 48px 14px 16px; background:#fff; border:1px solid #E8E0D6; border-radius:3px; font-family:'Jost',sans-serif; font-size:15px; font-weight:300; color:#2C2825; outline:none; transition:border-color .2s,box-shadow .2s; box-sizing:border-box; }
        .rp-input::placeholder { color:#C4BAB0; }
        .rp-input:focus { border-color:#B89A6A; box-shadow:0 0 0 3px rgba(184,154,106,.12); }
        .rp-eye { position:absolute; right:14px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#9E968E; padding:4px; transition:color .2s; }
        .rp-eye:hover { color:#B89A6A; }
        .rp-strength-bar { height:4px; border-radius:2px; background:#EDE6DC; margin-top:8px; overflow:hidden; }
        .rp-strength-fill { height:100%; border-radius:2px; transition:width .3s,background .3s; }
        .rp-strength-label { font-size:11px; margin-top:4px; font-weight:600; }
        .rp-btn { width:100%; padding:15px; background:#2C2825; color:#F7F3EE; border:none; border-radius:3px; cursor:pointer; font-family:'Jost',sans-serif; font-size:12px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; transition:background .22s,transform .2s; margin-top:8px; }
        .rp-btn:hover:not(:disabled) { background:#B89A6A; transform:translateY(-1px); }
        .rp-btn:disabled { opacity:.6; cursor:not-allowed; }
        /* Success */
        .rp-success-icon { width:72px; height:72px; background:#D1FAE5; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 24px; }
        .rp-success-title { font-family:'Cormorant Garamond',serif; font-size:36px; font-weight:300; color:#2C2825; margin:0 0 12px; text-align:center; }
        .rp-success-title em { font-style:italic; color:#B89A6A; }
        .rp-success-text { font-size:15px; font-weight:300; color:#6B635A; line-height:1.8; text-align:center; margin-bottom:32px; }
        .rp-success-btn { display:block; width:100%; text-align:center; background:#2C2825; color:#F7F3EE; text-decoration:none; padding:14px 32px; border-radius:3px; font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; transition:background .22s; }
        .rp-success-btn:hover { background:#B89A6A; }
        .rp-redirect { text-align:center; font-size:13px; color:#9E968E; margin-top:14px; }
        @media(max-width:480px) { .rp-card{padding:36px 20px;} }
      `}</style>

      <div className="rp">
        <div className="rp-card">

          {done ? (
            <>
              <div className="rp-success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="rp-success-title">Password <em>reset!</em></h1>
              <p className="rp-success-text">
                Your password has been successfully reset.
                You can now log in with your new password.
              </p>
              <Link href="/login" className="rp-success-btn">Go to Login</Link>
              <p className="rp-redirect">Redirecting in 3 seconds…</p>
            </>
          ) : (
            <>
              <div className="rp-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </div>

              <h1 className="rp-title">Reset <em>password</em></h1>
              <p className="rp-subtitle">Choose a strong new password for your account.</p>

              {error && <div className="rp-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                {/* New password */}
                <div className="rp-field">
                  <label className="rp-label" htmlFor="rp-password">New Password</label>
                  <div className="rp-input-wrap">
                    <input
                      id="rp-password"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required suppressHydrationWarning
                      className="rp-input"
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                    />
                    <button type="button" className="rp-eye" onClick={() => setShowPass(p => !p)} suppressHydrationWarning>
                      {showPass ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {password.length > 0 && (
                    <>
                      <div className="rp-strength-bar">
                        <div className="rp-strength-fill" style={{ width: `${strength * 25}%`, background: strengthColor }} />
                      </div>
                      <p className="rp-strength-label" style={{ color: strengthColor }}>{strengthLabel}</p>
                    </>
                  )}
                </div>

                {/* Confirm password */}
                <div className="rp-field">
                  <label className="rp-label" htmlFor="rp-confirm">Confirm Password</label>
                  <div className="rp-input-wrap">
                    <input
                      id="rp-confirm"
                      type={showConf ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required suppressHydrationWarning
                      className="rp-input"
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      style={{ borderColor: confirm && password !== confirm ? '#EF4444' : undefined }}
                    />
                    <button type="button" className="rp-eye" onClick={() => setShowConf(p => !p)} suppressHydrationWarning>
                      {showConf ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>Passwords do not match</p>
                  )}
                </div>

                <button type="submit" disabled={loading || !token} className="rp-btn" suppressHydrationWarning>
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </>
  );
}

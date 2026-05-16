// app/verify-email/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Status = 'loading' | 'success' | 'error' | 'expired';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get('token');
  const [status, setStatus]   = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please check your email link.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${token}`
        );
        const data = await res.json();

        if (data.success) {
          setStatus('success');
          setMessage(data.message);
          // Auto redirect to login after 3 seconds
          setTimeout(() => router.push('/login'), 3000);
        } else {
          const isExpired = data.message?.toLowerCase().includes('expired');
          setStatus(isExpired ? 'expired' : 'error');
          setMessage(data.message || 'Verification failed');
        }
      } catch {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    })();
  }, [token]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');
        .ve { min-height:100vh; background:#F7F3EE; display:flex; align-items:center; justify-content:center; padding:24px; font-family:'Jost',sans-serif; }
        .ve-card { background:#fff; border-radius:8px; padding:56px 48px; max-width:480px; width:100%; text-align:center; box-shadow:0 8px 40px rgba(44,40,37,.08); }
        .ve-icon { width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 28px; }
        .ve-icon-loading { background:#EDE6DC; animation:ve-pulse 1.5s infinite; }
        .ve-icon-success { background:#D1FAE5; }
        .ve-icon-error   { background:#FEE2E2; }
        .ve-icon-expired { background:#FEF3C7; }
        @keyframes ve-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .ve-title { font-family:'Cormorant Garamond',serif; font-size:36px; font-weight:300; color:#2C2825; margin:0 0 12px; line-height:1.1; }
        .ve-title em { font-style:italic; color:#B89A6A; }
        .ve-text { font-size:15px; font-weight:300; color:#6B635A; line-height:1.8; margin:0 0 32px; }
        .ve-btn { display:inline-block; background:#2C2825; color:#F7F3EE; text-decoration:none; padding:14px 32px; border-radius:3px; font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; transition:background .22s; }
        .ve-btn:hover { background:#B89A6A; }
        .ve-btn-gold { background:#B89A6A; color:#2C2825; }
        .ve-btn-gold:hover { background:#D4B896; }
        .ve-redirect { font-size:13px; color:#9E968E; margin-top:16px; }
      `}</style>

      <div className="ve">
        <div className="ve-card">

          {status === 'loading' && (
            <>
              <div className="ve-icon ve-icon-loading">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B89A6A" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <h1 className="ve-title">Verifying your <em>email…</em></h1>
              <p className="ve-text">Please wait while we verify your email address.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="ve-icon ve-icon-success">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="ve-title">Email <em>verified!</em></h1>
              <p className="ve-text">
                Your email has been successfully verified.
                You can now log in to your Crown &amp; Glow account.
              </p>
              <Link href="/login" className="ve-btn">Go to Login</Link>
              <p className="ve-redirect">Redirecting automatically in 3 seconds…</p>
            </>
          )}

          {status === 'expired' && (
            <>
              <div className="ve-icon ve-icon-expired">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h1 className="ve-title">Link <em>expired</em></h1>
              <p className="ve-text">
                {message || 'This verification link has expired.'}<br/>
                Please request a new verification email.
              </p>
              <Link href="/resend-verification" className="ve-btn ve-btn-gold">
                Resend Verification Email
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="ve-icon ve-icon-error">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h1 className="ve-title">Verification <em>failed</em></h1>
              <p className="ve-text">{message || 'Something went wrong. Please try again.'}</p>
              <Link href="/register" className="ve-btn">Back to Register</Link>
            </>
          )}

        </div>
      </div>
    </>
  );
}

// app/register/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import PasswordStrengthChecker, { isPasswordValid } from '../../components/PasswordStrengthChecker';

// ── Phone helpers ─────────────────────────────────────────────────────────────

/** Format digits into (XXX) XXX-XXXX as user types */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

/** Strip formatting to raw digits */
function stripPhone(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

type PhoneError =
  | 'too_short'
  | 'too_long'
  | 'invalid_area'
  | 'valid'
  | 'empty';

function validatePhone(digits: string): PhoneError {
  if (digits.length === 0)  return 'empty';
  if (digits.length < 10)   return 'too_short';
  if (digits.length > 10)   return 'too_long';
  const area = digits.slice(0, 3);
  if (['000','911','555'].includes(area)) return 'invalid_area';
  return 'valid';
}

const PHONE_MESSAGES: Record<PhoneError, string> = {
  empty:        '',
  valid:        '✓ Valid US phone number',
  too_short:    'Phone number is too short — need 10 digits',
  too_long:     'Phone number is too long — max 10 digits',
  invalid_area: 'Invalid area code',
};

// ─────────────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name:     '',
    email:    '',
    phone:    '',   // formatted display value
    password: '',
  });
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [done,     setDone]    = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [phoneTouched,    setPhoneTouched]    = useState(false);

  // ── Derived state ──────────────────────────────────────────────────────────
  const phoneDigits  = stripPhone(formData.phone);
  const phoneStatus  = validatePhone(phoneDigits);
  const phoneIsValid = phoneStatus === 'valid' || phoneStatus === 'empty'; // optional field
  const passwordValid = isPasswordValid(formData.password);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      // Only allow digits — auto-format
      const digits = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, phone: formatPhone(digits) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Frontend gates
    if (!passwordValid) {
      setPasswordTouched(true);
      setError('Please meet all password requirements below.');
      return;
    }
    if (!phoneIsValid) {
      setPhoneTouched(true);
      setError('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name:     formData.name,
        email:    formData.email,
        password: formData.password,
        // Send raw digits, or omit if empty
        ...(phoneDigits ? { phone: phoneDigits } : {}),
      };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/register`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Registration failed');
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');

        .rg{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;font-family:'Jost',sans-serif;}
        .rg-visual{position:relative;overflow:hidden;background:#2C2825;}
        .rg-img{width:100%;height:100%;object-fit:cover;display:block;opacity:.7;}
        .rg-overlay{position:absolute;inset:0;background:linear-gradient(160deg,rgba(26,21,16,.6) 0%,rgba(184,154,106,.12) 100%);}
        .rg-vbody{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:52px 56px;}
        .rg-logo{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:500;color:#F7F3EE;}
        .rg-logo em{font-style:italic;color:#D4B896;}
        .rg-tagline{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,3.5vw,46px);font-weight:300;color:#F7F3EE;line-height:1.15;margin-bottom:12px;}
        .rg-tagline em{font-style:italic;color:#D4B896;}
        .rg-vsub{font-size:14px;font-weight:300;color:#C8BFB4;line-height:1.8;max-width:300px;}

        .rg-panel{background:#FDFAF6;display:flex;align-items:flex-start;justify-content:center;padding:52px 48px;position:relative;overflow-y:auto;}
        .rg-panel::before{content:'';position:absolute;top:0;left:0;width:1px;height:100%;background:linear-gradient(to bottom,transparent,#EDE6DC 25%,#EDE6DC 75%,transparent);}
        .rg-box{width:100%;max-width:420px;padding:16px 0;}

        .rg-eyebrow{font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#B89A6A;margin-bottom:14px;}
        .rg-title{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:400;color:#2C2825;margin:0 0 6px;line-height:1.0;}
        .rg-title em{font-style:italic;color:#B89A6A;}
        .rg-subtitle{font-size:15px;font-weight:300;color:#9E968E;margin-bottom:28px;line-height:1.65;}

        .rg-err{background:#FEF2F2;border:1px solid #FECACA;border-radius:3px;padding:12px 16px;font-size:13px;color:#B91C1C;margin-bottom:18px;}
        .rg-field{margin-bottom:18px;}
        .rg-label{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#6B635A;margin-bottom:7px;}
        .rg-optional{font-size:10px;font-weight:400;letter-spacing:.06em;color:#B89A6A;text-transform:none;}

        .rg-wrap{position:relative;}
        .rg-input{width:100%;padding:13px 16px;background:#fff;border:1px solid #E8E0D6;border-radius:3px;font-family:'Jost',sans-serif;font-size:15px;font-weight:300;color:#2C2825;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box;}
        .rg-input::placeholder{color:#C4BAB0;}
        .rg-input:focus{border-color:#B89A6A;box-shadow:0 0 0 3px rgba(184,154,106,.12);}
        .rg-input.pr{padding-right:48px;}
        .rg-input.ok{border-color:#10B981;}
        .rg-input.bad{border-color:#EF4444;}

        /* Phone prefix */
        .rg-phone-wrap{display:flex;gap:0;}
        .rg-phone-prefix{display:flex;align-items:center;padding:0 14px;background:#F7F3EE;border:1px solid #E8E0D6;border-right:none;border-radius:3px 0 0 3px;font-size:14px;font-weight:500;color:#6B635A;white-space:nowrap;flex-shrink:0;}
        .rg-phone-input{border-radius:0 3px 3px 0!important;flex:1;}

        .rg-hint{font-size:12px;margin-top:5px;font-weight:400;}
        .rg-hint.valid{color:#059669;}
        .rg-hint.error{color:#EF4444;}
        .rg-hint.neutral{color:#9E968E;}

        .rg-eye{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9E968E;padding:4px;transition:color .2s;line-height:0;}
        .rg-eye:hover{color:#B89A6A;}

        .rg-btn{width:100%;padding:14px;background:#2C2825;color:#F7F3EE;border:none;border-radius:3px;cursor:pointer;font-family:'Jost',sans-serif;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;transition:background .22s,transform .2s;margin-top:6px;margin-bottom:22px;}
        .rg-btn:hover:not(:disabled){background:#B89A6A;transform:translateY(-1px);}
        .rg-btn:disabled{opacity:.5;cursor:not-allowed;}

        .rg-div{display:flex;align-items:center;gap:14px;margin-bottom:20px;}
        .rg-dline{flex:1;height:1px;background:#EDE6DC;}
        .rg-dtext{font-size:11px;color:#B8B0A8;letter-spacing:.06em;white-space:nowrap;}
        .rg-link-row{text-align:center;font-size:15px;font-weight:300;color:#9E968E;}
        .rg-link{color:#B89A6A;font-weight:600;text-decoration:none;transition:color .2s;}
        .rg-link:hover{color:#2C2825;}

        /* Success */
        .rg-success{text-align:center;padding:20px 0;}
        .rg-si{width:72px;height:72px;background:#D1FAE5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;}
        .rg-st{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:400;color:#2C2825;margin:0 0 12px;}
        .rg-st em{font-style:italic;color:#B89A6A;}
        .rg-sp{font-size:15px;font-weight:300;color:#6B635A;line-height:1.8;margin-bottom:28px;}
        .rg-sb{display:inline-block;background:#2C2825;color:#F7F3EE;text-decoration:none;padding:13px 28px;border-radius:3px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;transition:background .22s;}
        .rg-sb:hover{background:#B89A6A;}

        @media(max-width:800px){
          .rg{grid-template-columns:1fr;}
          .rg-visual{height:200px;}
          .rg-vbody{padding:24px 28px;}
          .rg-panel{padding:36px 20px;}
          .rg-panel::before{display:none;}
        }
      `}</style>

      <div className="rg">

        {/* ── Left visual ── */}
        <div className="rg-visual">
          <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=85" alt="Crown & Glow" className="rg-img"/>
          <div className="rg-overlay"/>
          <div className="rg-vbody">
            <div className="rg-logo">Crown <em>&amp; Glow</em></div>
            <div>
              <h2 className="rg-tagline">Begin your <em>beauty journey.</em></h2>
              <p className="rg-vsub">Join thousands of clients who trust Crown &amp; Glow for premium beauty treatments in Indianapolis.</p>
            </div>
          </div>
        </div>

        {/* ── Right form ── */}
        <div className="rg-panel">
          <div className="rg-box">

            {done ? (
              /* ── Success screen ── */
              <div className="rg-success">
                <div className="rg-si">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h1 className="rg-st">Check your <em>email!</em></h1>
                <p className="rg-sp">
                  We've sent a verification link to<br/>
                  <strong style={{color:'#2C2825'}}>{formData.email}</strong><br/><br/>
                  Click the link to activate your account.<br/>
                  It expires in <strong>24 hours</strong>.
                </p>
                <Link href="/login" className="rg-sb">Go to Login</Link>
                <p style={{marginTop:18,fontSize:13,color:'#9E968E'}}>
                  Didn't receive it?{' '}
                  <button
                    onClick={async () => {
                      await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL||'http://localhost:5000'}/api/auth/resend-verification`,
                        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:formData.email})}
                      );
                      alert('Verification email resent!');
                    }}
                    style={{color:'#B89A6A',fontWeight:600,background:'none',border:'none',cursor:'pointer',fontSize:13}}
                  >Resend email</button>
                </p>
              </div>
            ) : (
              <>
                <p className="rg-eyebrow">Crown &amp; Glow · Indianapolis</p>
                <h1 className="rg-title">Create <em>Account</em></h1>
                <p className="rg-subtitle">Join us and start booking your beauty treatments.</p>

                {error && <div className="rg-err" role="alert">{error}</div>}

                <form onSubmit={handleSubmit} noValidate>

                  {/* ── Name ── */}
                  <div className="rg-field">
                    <label className="rg-label" htmlFor="rg-name">Full Name</label>
                    <input
                      id="rg-name" type="text" name="name"
                      value={formData.name} onChange={handleChange}
                      required suppressHydrationWarning
                      className="rg-input" placeholder="Jana Silwal"
                      autoComplete="name"
                    />
                  </div>

                  {/* ── Email ── */}
                  <div className="rg-field">
                    <label className="rg-label" htmlFor="rg-email">Email Address</label>
                    <input
                      id="rg-email" type="email" name="email"
                      value={formData.email} onChange={handleChange}
                      required suppressHydrationWarning
                      className="rg-input" placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  {/* ── Phone ── */}
                  <div className="rg-field">
                    <label className="rg-label" htmlFor="rg-phone">
                      Phone Number
                      <span className="rg-optional">Optional</span>
                    </label>
                    <div className="rg-phone-wrap">
                      {/* Country prefix */}
                      <div className="rg-phone-prefix">🇺🇸 +1</div>
                      <input
                        id="rg-phone"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        onFocus={() => setPhoneTouched(true)}
                        suppressHydrationWarning
                        inputMode="numeric"
                        className={`rg-input rg-phone-input${
                          phoneTouched && phoneDigits
                            ? phoneIsValid ? ' ok' : ' bad'
                            : ''
                        }`}
                        placeholder="(317) 555-0187"
                        autoComplete="tel"
                        maxLength={14} // (XXX) XXX-XXXX = 14 chars
                        aria-describedby="phone-hint"
                      />
                    </div>

                    {/* Real-time phone feedback */}
                    {phoneTouched && phoneDigits && (
                      <p
                        id="phone-hint"
                        className={`rg-hint ${phoneIsValid ? 'valid' : 'error'}`}
                      >
                        {phoneIsValid
                          ? '✓ Valid US phone number'
                          : PHONE_MESSAGES[phoneStatus]
                        }
                      </p>
                    )}
                    {(!phoneTouched || !phoneDigits) && (
                      <p id="phone-hint" className="rg-hint neutral">
                        Format: (XXX) XXX-XXXX — digits only, auto-formatted
                      </p>
                    )}
                  </div>

                  {/* ── Password ── */}
                  <div className="rg-field">
                    <label className="rg-label" htmlFor="rg-pw">Password</label>
                    <div className="rg-wrap">
                      <input
                        id="rg-pw"
                        type={showPass ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        onFocus={() => setPasswordTouched(true)}
                        required suppressHydrationWarning
                        className={`rg-input pr${
                          passwordTouched && formData.password
                            ? passwordValid ? ' ok' : ' bad'
                            : ''
                        }`}
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        aria-describedby="pw-reqs"
                      />
                      <button
                        type="button" className="rg-eye"
                        onClick={() => setShowPass(p => !p)}
                        suppressHydrationWarning
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                      >
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

                    {/* Real-time password checker */}
                    <div id="pw-reqs">
                      <PasswordStrengthChecker
                        password={formData.password}
                        show={passwordTouched}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || (passwordTouched && !passwordValid) || (phoneTouched && !phoneIsValid)}
                    className="rg-btn"
                    suppressHydrationWarning
                  >
                    {loading ? 'Creating Account…' : 'Create Account'}
                  </button>
                </form>

                <div className="rg-div">
                  <div className="rg-dline"/>
                  <span className="rg-dtext">Already have an account?</span>
                  <div className="rg-dline"/>
                </div>
                <div className="rg-link-row">
                  <Link href="/login" className="rg-link">Sign in instead →</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSuccess(true);
      setTimeout(() => {
        setFormData({ name: '', email: '', phone: '', message: '' });
        setSubmitted(false);
        setSuccess(false);
      }, 2200);
    }, 900);
  };

  return (
    <div
      className="min-h-screen py-16 px-6"
      style={{ background: '#FAF7F4', fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@300;400;500&display=swap');

        .cg-input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 14px;
          background: #F5F0EB;
          border: 0.5px solid #DDD5C8;
          border-radius: 8px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: #2C1A0E;
          outline: none;
          transition: border 0.15s;
        }
        .cg-input:focus { border-color: #C9956B; }
        .cg-input::placeholder { color: #B8A898; }

        .cg-btn {
          width: 100%;
          margin-top: 0.5rem;
          padding: 12px;
          background: #2C1A0E;
          color: #FAF7F4;
          border: none;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }
        .cg-btn:hover:not(:disabled) { background: #3d2612; }
        .cg-btn:disabled { opacity: 0.6; cursor: default; }
        .cg-btn-success { background: #3B6D11 !important; }

        .cg-section-label {
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #C9956B;
          font-weight: 500;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cg-section-label::after {
          content: '';
          flex: 1;
          height: 0.5px;
          background: #DDD5C8;
        }

        .cg-hours-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 4px 20px;
          font-size: 13px;
        }

        .cg-wa-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: #F5F0EB;
          border: 0.5px solid #DDD5C8;
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .cg-wa-row:hover { border-color: #C9956B; }
      `}</style>

      <div className="max-w-4xl mx-auto">

        {/* Page Header */}
        <div className="mb-10">
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#C9956B',
            fontWeight: 500,
            marginBottom: 8,
          }}>
            Crown & Glow
          </p>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 300,
            color: '#2C1A0E',
            lineHeight: 1.15,
            margin: '0 0 8px',
          }}>
            Get in touch
          </h1>
          <p style={{ fontSize: 14, color: '#8B6244', fontWeight: 300, margin: 0 }}>
            We'd love to hear from you — questions, requests, or just to say hello.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-2 gap-10">

          {/* Left — Form */}
          <div
            style={{
              background: '#fff',
              border: '0.5px solid #DDD5C8',
              borderRadius: 16,
              padding: '2rem',
            }}
          >
            <p className="cg-section-label">Send a message</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="c-name"
                  style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B6244', fontWeight: 500, marginBottom: 6 }}
                >
                  Full name
                </label>
                <input
                  id="c-name"
                  type="text"
                  required
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="cg-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="c-email"
                    style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B6244', fontWeight: 500, marginBottom: 6 }}
                  >
                    Email
                  </label>
                  <input
                    id="c-email"
                    type="email"
                    required
                    placeholder="you@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="cg-input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="c-phone"
                    style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B6244', fontWeight: 500, marginBottom: 6 }}
                  >
                    Phone
                  </label>
                  <input
                    id="c-phone"
                    type="tel"
                    placeholder="+1 000 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="cg-input"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="c-msg"
                  style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B6244', fontWeight: 500, marginBottom: 6 }}
                >
                  Message
                </label>
                <textarea
                  id="c-msg"
                  required
                  rows={5}
                  placeholder="How can we help you today?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="cg-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitted}
                className={`cg-btn ${success ? 'cg-btn-success' : ''}`}
              >
                {success ? 'Message sent ✓' : submitted ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </div>

          {/* Right — Info */}
          <div className="space-y-8 pt-1">
            <p className="cg-section-label">Find us</p>

            {/* Address & contacts */}
            <div className="space-y-4">
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#2C1A0E', margin: 0 }}>
                Our salon
              </h2>
              {[
                { icon: '📍', text: '456 Glow Avenue, Suite 200\nIndianapolis, Indiana 46204' },
                { icon: '📞', text: '(317) 0000000' },
                { icon: '✉️', text: 'hello@crownandglow.com' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 14, marginTop: 1 }}>{icon}</span>
                  <span style={{ fontSize: 13, color: '#8B6244', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Hours */}
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#2C1A0E', margin: '0 0 12px' }}>
                Business hours
              </h2>
              <div className="cg-hours-grid">
                {[
                  ['Mon – Fri', '9:00 AM – 8:00 PM'],
                  ['Saturday',  '9:00 AM – 7:00 PM'],
                  ['Sunday',    '10:00 AM – 5:00 PM'],
                ]
              // ✅ Correct — key on the outer element
.map(([day, time]) => (
  <div key={day} style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: '#8B6244' }}>{day}</span>
    <span style={{ color: '#2C1A0E', fontWeight: 500 }}>{time}</span>
  </div>
))}
              </div>
            </div>
            {/* Divider */}
            <div style={{ height: '0.5px', background: '#DDD5C8' }} />

            {/* WhatsApp */}
            <div className="cg-wa-row">
              <span style={{ fontSize: 20 }}>💬</span>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B6244' }}>
                  Quick response on WhatsApp
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#2C1A0E' }}>(317) 000-0000</span>
              </div>
              <span style={{ color: '#C9956B', fontSize: 16 }}>→</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

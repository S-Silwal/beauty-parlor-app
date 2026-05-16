const BRAND = {
  name: 'Crown & Glow',
  color: '#B89A6A',
  dark: '#2C2825',
  cream: '#F7F3EE',
  address: '456 Glow Avenue, Suite 200, Indianapolis, IN 46204',
  phone: '(317) 555-0187',
  website: 'https://crownandglow.com',
  unsubscribe: 'https://crownandglow.com/unsubscribe',
};

// ── Base wrapper ─────────────────────────────────────────────────────────────
const baseTemplate = (content: string, previewText: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${BRAND.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #F7F3EE; font-family: 'Helvetica Neue', Arial, sans-serif; color: #2C2825; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(44,40,37,.08); }
    .header { background: #2C2825; padding: 36px 40px; text-align: center; }
    .header-logo { font-size: 26px; font-weight: 300; color: #F7F3EE; letter-spacing: .04em; }
    .header-logo em { font-style: italic; color: #D4B896; }
    .gold-bar { height: 3px; background: linear-gradient(to right, #B89A6A, #D4B896, #B89A6A); }
    .body { padding: 40px; }
    .h1 { font-size: 26px; font-weight: 300; color: #2C2825; margin-bottom: 8px; line-height: 1.3; }
    .h1 em { font-style: italic; color: #B89A6A; }
    .subtitle { font-size: 14px; color: #9E968E; margin-bottom: 32px; }
    .detail-card { background: #F7F3EE; border-radius: 6px; padding: 24px; margin: 24px 0; border-left: 3px solid #B89A6A; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EDE6DC; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #9E968E; font-weight: 500; }
    .detail-value { color: #2C2825; font-weight: 500; text-align: right; }
    .btn { display: inline-block; background: #2C2825; color: #F7F3EE !important; text-decoration: none; padding: 14px 32px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; margin: 24px 0; }
    .btn:hover { background: #B89A6A; }
    .btn-gold { background: #B89A6A; color: #2C2825 !important; }
    .p { font-size: 15px; line-height: 1.8; color: #6B635A; margin-bottom: 16px; }
    .footer { padding: 28px 40px; text-align: center; border-top: 1px solid #EDE6DC; }
    .footer-text { font-size: 12px; color: #9E968E; line-height: 1.8; }
    .footer-link { color: #B89A6A; text-decoration: none; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
    .badge-green { background: #D1FAE5; color: #065F46; }
    .badge-red { background: #FEE2E2; color: #991B1B; }
    .badge-gold { background: #FEF3C7; color: #92400E; }
    @media (max-width: 600px) {
      .body { padding: 24px 20px; }
      .detail-row { flex-direction: column; gap: 4px; }
      .detail-value { text-align: left; }
    }
  </style>
</head>
<body>
  <!-- Preview text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-logo">Crown <em>&amp; Glow</em></div>
      </div>
      <div class="gold-bar"></div>
      ${content}
      <div class="footer">
        <p class="footer-text">
          ${BRAND.name} · ${BRAND.address}<br/>
          <a href="tel:${BRAND.phone}" class="footer-link">${BRAND.phone}</a> ·
          <a href="mailto:hello@crownandglow.com" class="footer-link">hello@crownandglow.com</a>
        </p>
        <p class="footer-text" style="margin-top:12px;">
          <a href="${BRAND.unsubscribe}?email={{email}}" class="footer-link">Unsubscribe</a> ·
          <a href="${BRAND.website}/privacy" class="footer-link">Privacy Policy</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ── Template data types ───────────────────────────────────────────────────────
export interface BookingEmailData {
  customerName: string;
  customerEmail: string;
  serviceName: string;
  staffName?: string;
  appointmentDate: string; // "Friday, May 15, 2026"
  appointmentTime: string; // "9:30 AM"
  price?: string;          // "$50"
  notes?: string;
  bookingId: string;
}
// ── 2. Reminder 24 Hours ─────────────────────────────────────────────────────
export function reminder24hTemplate(data: BookingEmailData): { subject: string; html: string } {
  const subject = `⏰ Reminder: ${data.serviceName} Tomorrow at ${data.appointmentTime}`;

  const html = baseTemplate(`
    <div class="body">
      <span class="badge badge-gold" style="margin-bottom:20px;">Appointment Tomorrow</span>
      <h1 class="h1">See you <em>tomorrow!</em></h1>
      <p class="subtitle">Just a friendly reminder about your upcoming appointment.</p>

      <div class="detail-card">
        <div class="detail-row">
          <span class="detail-label">Service</span>
          <span class="detail-value">${data.serviceName}</span>
        </div>
        ${data.staffName ? `
        <div class="detail-row">
          <span class="detail-label">Specialist</span>
          <span class="detail-value">${data.staffName}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${data.appointmentDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Time</span>
          <span class="detail-value">${data.appointmentTime}</span>
        </div>
      </div>

      <p class="p">
        🌟 <strong>Preparation tips for ${data.serviceName}:</strong><br/>
        Come with clean skin, avoid heavy moisturizers, and wear comfortable clothing.
        Arrive 5 minutes early so we can get started on time.
      </p>

      <center>
        <a href="${BRAND.website}/dashboard" class="btn btn-gold">View Booking Details</a>
      </center>

      <p class="p" style="font-size:13px;color:#9E968E;">
        Need to cancel? Please call us at ${BRAND.phone} as soon as possible.
        Last-minute cancellations may incur a fee.
      </p>
    </div>
  `, `Reminder: Your ${data.serviceName} is tomorrow at ${data.appointmentTime}`);

  return { subject, html };
}
// src/templates/brand.ts
// Shared branding + safety helpers for every email template.
//
// Previously each template carried its own copy of BRAND with a hardcoded
// `website: 'https://crownandglow.com'` — a domain this project doesn't own,
// so every email button ("View My Bookings", "Book Again"…) sent customers
// to a stranger's site. Links now come from FRONTEND_URL, the same variable
// CORS and the auth emails already use, so they always match the deployed app.

/** First origin in FRONTEND_URL (it may be a comma-separated CORS list), no trailing slash. */
function appUrl(): string {
  return (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '');
}

export const BRAND = {
  name: 'Crown & Glow',
  color: '#B89A6A',
  dark: '#2C2825',
  cream: '#F7F3EE',
  address: '456 Glow Avenue, Suite 200, Indianapolis, IN 46204',
  phone: '(317) 555-0187',
  // Getters, not values: read at send time, so it never matters whether this
  // module was imported before dotenv populated process.env.
  get website(): string {
    return appUrl();
  },
  // Optional — the footer only shows a contact address when one is configured.
  get supportEmail(): string {
    return process.env.SUPPORT_EMAIL?.trim() ?? '';
  },
};

/** Escape a value for safe insertion into HTML text or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns a copy of `data` with every string field HTML-escaped. Customer-
 * controlled text (name, booking notes) used to be interpolated raw, so a
 * note like `<a href="https://evil.example">Verify your card</a>` rendered as
 * a real link inside a genuine Crown & Glow email. Templates build the plain-
 * text subject line from the raw data first, then escape before building HTML.
 */
export function escapeData<T extends object>(data: T): T {
  const out = { ...data } as Record<string, unknown>;
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string') out[key] = escapeHtml(value);
  }
  return out as T;
}

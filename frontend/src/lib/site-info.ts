// Single source of truth for the salon's public contact details and
// operating hours. Imported by the footer (shown on every page) and the
// contact page so the two can never drift out of sync — update a value
// here once and both pick it up.

export const SITE_ADDRESS_LINE1 = '123 Placeholder Lane, Suite 100';
export const SITE_ADDRESS_LINE2 = 'Anytown, ST 00000';
export const SITE_ADDRESS = `${SITE_ADDRESS_LINE1}, ${SITE_ADDRESS_LINE2}`;
export const SITE_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=123+Placeholder+Lane+Anytown+ST+00000';

export const SITE_PHONE_DISPLAY = '(317) 000-0000';
export const SITE_PHONE_TEL = '+13170000000';

export const SITE_EMAIL = 'hello@crownandglow.com';

// Mirrors the hours actually printed on the site. `display` feeds the
// "Today · Sat 9:00 AM – 7:00 PM" line in the footer; `HOURS_SUMMARY` is
// the same data shaped for a simple day/time list (contact page, footer).
export const HOURS: Record<string, { open: number; close: number; display: string }> = {
  Mon: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Tue: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Wed: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Thu: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Fri: { open: 9 * 60,  close: 20 * 60, display: '9:00 AM – 8:00 PM' },
  Sat: { open: 9 * 60,  close: 19 * 60, display: '9:00 AM – 7:00 PM' },
  Sun: { open: 10 * 60, close: 17 * 60, display: '10:00 AM – 5:00 PM' },
};

export const HOURS_SUMMARY: { label: string; time: string }[] = [
  { label: 'Mon – Fri', time: '9:00 AM – 8:00 PM' },
  { label: 'Saturday',  time: '9:00 AM – 7:00 PM' },
  { label: 'Sunday',    time: '10:00 AM – 5:00 PM' },
];

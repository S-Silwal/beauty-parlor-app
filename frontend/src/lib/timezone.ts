// src/lib/timezone.ts
//
// Mirrors backend/src/utils/timezone.ts — see that file's header for the
// full rationale. In short: `appointment_date` is always an absolute UTC
// instant, but the customer picks (and needs to see) *salon-local*
// wall-clock time, which is neither this browser's own timezone nor the
// backend server's. Every place in the frontend that turns a picked
// date+slot into an instant for the API, or turns a stored instant back
// into something to display or compare against a picked date+slot, must
// go through these helpers — never a bare `new Date(...)` plus its
// browser-local getters/toLocaleString.
export const SALON_TZ = "America/Indiana/Indianapolis";

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

/**
 * Converts a wall-clock date + time *as experienced at the salon* into the
 * real UTC instant it represents — correctly handling EST/EDT (and any
 * future DST rule change) via the IANA tzdb, never a hardcoded offset.
 * This is the one and only place a customer-picked date+slot should turn
 * into an ISO string for the API (`.toISOString()` the result).
 *
 * @param dateStr 'YYYY-MM-DD'
 * @param timeStr 'HH:mm' (24h)
 */
export function salonWallTimeToUtc(dateStr: string, timeStr: string, timeZone: string = SALON_TZ): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const utcGuessMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuessMs), timeZone);
  return new Date(utcGuessMs - offsetMs);
}

export interface SalonLocalParts {
  dateStr: string; // 'YYYY-MM-DD'
  timeStr: string; // 'HH:mm', 24h
}

/** Salon-local calendar date + clock time of a stored UTC instant (or the
 * ISO string the API returns it as). Use this — never
 * `date.getFullYear()/getDate()/getHours()` — whenever a stored
 * `appointment_date` needs to feed back into a date input or slot picker,
 * or be compared against one. */
export function toSalonLocalParts(instant: Date | string, timeZone: string = SALON_TZ): SalonLocalParts {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    timeStr: `${get("hour")}:${get("minute")}`,
  };
}

/** 'YYYY-MM-DD' of `instant` as experienced at the salon — the tz-safe
 * replacement for reading `.getFullYear()/getMonth()/getDate()` off a
 * parsed `appointment_date`, which reads *this browser's* timezone. */
export function salonLocalDateStr(instant: Date | string, timeZone: string = SALON_TZ): string {
  return toSalonLocalParts(instant, timeZone).dateStr;
}

/** Today's date at the salon, 'YYYY-MM-DD' — the tz-safe replacement for
 * building "today" from `new Date().getFullYear()/...` (this browser's
 * timezone) when it's used as a date picker's `min` or an "is this slot in
 * the past" check against the salon's own calendar. */
export function salonTodayStr(timeZone: string = SALON_TZ): string {
  return salonLocalDateStr(new Date(), timeZone);
}

/** "Sunday, September 27, 2026" — `instant` formatted in salon-local time.
 * Pass `options` to override/extend the default long format while still
 * always pinning `timeZone` to the salon's, e.g. `{ weekday: undefined,
 * month: 'short' }` for a compact "Sep 27, 2026" style. */
export function formatSalonDate(
  instant: Date | string,
  options: Intl.DateTimeFormatOptions = {},
  timeZone: string = SALON_TZ
): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return d.toLocaleDateString("en-US", {
    timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric",
    ...options,
  });
}

/** "11:00 AM" — `instant` formatted in salon-local time. */
export function formatSalonTime(
  instant: Date | string,
  options: Intl.DateTimeFormatOptions = {},
  timeZone: string = SALON_TZ
): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return d.toLocaleTimeString("en-US", {
    timeZone, hour: "numeric", minute: "2-digit", hour12: true,
    ...options,
  });
}

/** Convenience pairing of the two formatters above, for messages like
 * "You already have X booked on {date} at {time}." */
export function toSalonDateTime(instant: Date | string, timeZone: string = SALON_TZ): { date: string; time: string } {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return { date: formatSalonDate(d, {}, timeZone), time: formatSalonTime(d, {}, timeZone) };
}

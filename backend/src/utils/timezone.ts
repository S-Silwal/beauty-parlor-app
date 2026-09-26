// src/utils/timezone.ts
//
// Every `appointment_date` in this system is stored as an absolute instant
// (UTC — see schema.prisma's `@db.Timestamptz` on Appointment.appointment_date).
// But the salon itself, the "you already have this service booked today"
// rule, and every human-facing display (booking summary, conflict
// messages, admin appointment list/calendar, emails) all operate in
// *salon-local* wall-clock time — never the server process's own OS
// timezone (Railway runs this container in UTC, which has nothing to do
// with Indianapolis) and never the reading browser's timezone (a customer
// or admin can be anywhere in the world).
//
// SALON_TZ is the single source of truth for what "local" means in this
// codebase. Every helper below takes it as a default parameter — pass a
// different IANA zone explicitly if the business ever adds a second
// location; never hardcode a UTC offset (-4/-5) anywhere, since that
// silently breaks across the EST/EDT DST transition twice a year.
export const SALON_TZ = "America/Indiana/Indianapolis";

/**
 * How far `timeZone`'s local wall clock is ahead of UTC at the instant
 * `date`, in milliseconds (e.g. -4h for America/Indiana/Indianapolis in
 * EDT, -5h in EST). Built on Intl.DateTimeFormat — available in Node
 * without any extra dependency — rather than a date-time library.
 */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Reconstruct what `date`'s instant reads as in `timeZone`, treating
  // those printed digits as if they were themselves UTC — the gap between
  // that and `date` itself is exactly the zone's offset at that instant.
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

/**
 * Converts a wall-clock date + time *as experienced at the salon* into the
 * real UTC instant it represents — correctly handling EST/EDT (and any
 * future DST rule change) via the IANA tzdb, never a hardcoded offset.
 * This is the one and only place a customer- or admin-entered local time
 * should turn into a Date for storage.
 *
 * @param dateStr 'YYYY-MM-DD'
 * @param timeStr 'HH:mm' (24h)
 */
export function salonWallTimeToUtc(dateStr: string, timeStr: string, timeZone: string = SALON_TZ): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Guess the instant by treating the wall-clock digits as if they were
  // UTC, measure how far that guess's own reading in `timeZone` drifts
  // from the wall-clock we actually want, and correct by that amount.
  // One correction always suffices: real-world DST jumps are whole hours,
  // never anywhere near the guess's own margin of error.
  const utcGuessMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuessMs), timeZone);
  return new Date(utcGuessMs - offsetMs);
}

/** Salon-local calendar/clock components of a stored UTC instant. */
export interface SalonLocalParts {
  year: number; month: number; day: number; // month is 1-12
  hour: number; minute: number;
  /** 'YYYY-MM-DD' — for calendar-day comparisons/bucketing. */
  dateStr: string;
  /** 'HH:mm', 24h. */
  timeStr: string;
}

export function toSalonLocalParts(instant: Date, timeZone: string = SALON_TZ): SalonLocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get("year"), month = get("month"), day = get("day"), hour = get("hour"), minute = get("minute");
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    year, month, day, hour, minute,
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
    timeStr: `${pad(hour)}:${pad(minute)}`,
  };
}

/**
 * 'YYYY-MM-DD' of `instant` as experienced at the salon — the single
 * source of truth for "what calendar day is this appointment on", used by
 * every same-day duplicate/overlap check. Never derive this from
 * `instant.getDate()` / `toISOString().slice(0, 10)` — the former reads
 * the server process's own timezone (UTC on Railway), the latter is
 * always raw UTC; neither is Indianapolis.
 */
export function salonLocalDateStr(instant: Date, timeZone: string = SALON_TZ): string {
  return toSalonLocalParts(instant, timeZone).dateStr;
}

/** Today's date at the salon, 'YYYY-MM-DD' — the tz-safe replacement for
 * building "today" from `new Date().getFullYear()/...` (the server
 * process's own timezone, UTC on Railway — not Indianapolis). */
export function salonTodayStr(timeZone: string = SALON_TZ): string {
  return salonLocalDateStr(new Date(), timeZone);
}

/**
 * The UTC instant range covering one entire salon-local calendar day — the
 * tz-safe replacement for `new Date(y, m, d, 0/23, 59, 59, 999)`, which
 * built that range in the server process's own timezone instead of the
 * salon's. Use `{ gte: start, lte: end }` in Prisma range queries scoped
 * to "that local day".
 */
export function salonDayBounds(localDateString: string, timeZone: string = SALON_TZ): { start: Date; end: Date } {
  const start = salonWallTimeToUtc(localDateString, "00:00", timeZone);
  const [y, m, d] = localDateString.split("-").map(Number);
  // One tick before the *next* local day's 00:00 — correct regardless of
  // whether this particular local day is 23, 24, or 25 hours long across a
  // DST transition, unlike a fixed "+ 23:59:59.999".
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDateStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  const end = new Date(salonWallTimeToUtc(nextDateStr, "00:00", timeZone).getTime() - 1);
  return { start, end };
}

/** "Sunday, September 27, 2026" — `instant` formatted in salon-local time. */
export function formatSalonDate(instant: Date, timeZone: string = SALON_TZ): string {
  return instant.toLocaleDateString("en-US", {
    timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

/** "11:00 AM" — `instant` formatted in salon-local time. */
export function formatSalonTime(instant: Date, timeZone: string = SALON_TZ): string {
  return instant.toLocaleTimeString("en-US", {
    timeZone, hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/** Convenience pairing of the two formatters above, for messages like
 * "You already have X booked on {date} at {time}." */
export function toSalonDateTime(instant: Date, timeZone: string = SALON_TZ): { date: string; time: string } {
  return { date: formatSalonDate(instant, timeZone), time: formatSalonTime(instant, timeZone) };
}

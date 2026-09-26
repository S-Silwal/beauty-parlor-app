import { describe, it, expect } from '@jest/globals';
import {
  SALON_TZ,
  salonWallTimeToUtc,
  toSalonLocalParts,
  salonLocalDateStr,
  salonDayBounds,
  formatSalonDate,
  formatSalonTime,
  toSalonDateTime,
} from '../../utils/timezone';

// Pure unit coverage for the salon-timezone conversion layer — no DB, no
// HTTP. This is the fix for a real production bug: a customer booking
// "11:00 AM" (salon-local) was stored as 11:00 UTC instead of the correct
// 15:00Z/16:00Z (EDT/EST), so anything that converted UTC -> local
// correctly (the admin panel, a from-scratch duplicate-booking check) then
// displayed a time 4-5 hours off from what the customer saw on their own
// success screen. Every case below is either the exact reported scenario
// or a boundary case (DST, evening-crossing-UTC-midnight) that a hardcoded
// offset or a server/browser-local Date getter would get wrong.
describe('backend/src/utils/timezone (salon-local <-> UTC conversion)', () => {
  it('exposes the salon\'s IANA zone, not a hardcoded offset', () => {
    expect(SALON_TZ).toBe('America/Indiana/Indianapolis');
  });

  it('converts an EDT (summer) local wall time to the correct UTC instant', () => {
    // 11:00 AM local on Sep 27, 2026 (EDT, UTC-4) -> 15:00 UTC. This is the
    // exact case from the bug report: the customer picked 11:00 AM and the
    // success screen/summary correctly showed 11:00 AM, but the stored
    // instant was 11:00 UTC (4 hours early) instead of 15:00 UTC, which is
    // what every proper UTC->local display (admin, the duplicate-booking
    // banner) then converted back to 7:00 AM.
    const instant = salonWallTimeToUtc('2026-09-27', '11:00');
    expect(instant.toISOString()).toBe('2026-09-27T15:00:00.000Z');
  });

  it('converts an EST (winter) local wall time to the correct UTC instant', () => {
    // Same clock time, six months later (EST, UTC-5) -> 16:00 UTC. A
    // hardcoded "-4 hours" would get this one wrong by an hour.
    const instant = salonWallTimeToUtc('2026-01-15', '11:00');
    expect(instant.toISOString()).toBe('2026-01-15T16:00:00.000Z');
  });

  it('round-trips a UTC instant back to the exact salon-local wall time that produced it', () => {
    const edt = salonWallTimeToUtc('2026-09-27', '11:00');
    expect(toSalonLocalParts(edt)).toEqual({
      year: 2026, month: 9, day: 27, hour: 11, minute: 0,
      dateStr: '2026-09-27', timeStr: '11:00',
    });

    const est = salonWallTimeToUtc('2026-01-15', '11:00');
    expect(toSalonLocalParts(est)).toEqual({
      year: 2026, month: 1, day: 15, hour: 11, minute: 0,
      dateStr: '2026-01-15', timeStr: '11:00',
    });
  });

  it('reads the correct salon-local calendar day even late in the evening, after UTC has already rolled to the next day', () => {
    // 11:00 PM EDT local on Sep 27 is 03:00 UTC on Sep 28 — a UTC-day or
    // server-process-local-day (Railway runs this container in UTC) read
    // would misfile this as Sep 28, not the salon's actual Sep 27.
    const lateEvening = salonWallTimeToUtc('2026-09-27', '23:00');
    expect(lateEvening.toISOString()).toBe('2026-09-28T03:00:00.000Z');
    expect(salonLocalDateStr(lateEvening)).toBe('2026-09-27');
  });

  it('builds salon-local calendar-day bounds that correctly span into the next UTC day', () => {
    const { start, end } = salonDayBounds('2026-09-27');
    expect(start.toISOString()).toBe('2026-09-27T04:00:00.000Z'); // 00:00 EDT
    expect(end.toISOString()).toBe('2026-09-28T03:59:59.999Z');   // 23:59:59.999 EDT

    // The late-evening booking from the previous test must fall inside
    // this window — this is exactly what assertNoDuplicateServiceSameDay()
    // and getAvailableSlots() rely on to scope a "same local day" query.
    const lateEvening = salonWallTimeToUtc('2026-09-27', '23:00');
    expect(lateEvening.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(lateEvening.getTime()).toBeLessThanOrEqual(end.getTime());

    // And a booking on the *next* salon-local day must fall outside it.
    const nextDayMorning = salonWallTimeToUtc('2026-09-28', '09:00');
    expect(nextDayMorning.getTime()).toBeGreaterThan(end.getTime());
  });

  it('formats a stored instant as salon-local time regardless of this process\'s own timezone', () => {
    const instant = salonWallTimeToUtc('2026-09-27', '11:00');
    expect(formatSalonDate(instant)).toBe('Sunday, September 27, 2026');
    expect(formatSalonTime(instant)).toBe('11:00 AM');
    expect(toSalonDateTime(instant)).toEqual({
      date: 'Sunday, September 27, 2026',
      time: '11:00 AM',
    });
  });

  it('spans exactly one extra hour across the fall-back DST transition', () => {
    // Nov 1 -> Nov 2, 2026: America/Indiana/Indianapolis falls back from
    // EDT to EST overnight, so the same wall-clock time 24 hours later is
    // actually 25 real hours later. Getting this wrong is exactly what a
    // hardcoded UTC offset (rather than the IANA tzdb) would do.
    const before = salonWallTimeToUtc('2026-11-01', '00:30');
    const after = salonWallTimeToUtc('2026-11-02', '00:30');
    expect((after.getTime() - before.getTime()) / (60 * 60 * 1000)).toBe(25);
  });
});

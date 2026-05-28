/**
 * Feature: child-task-reminder, Property 1: Window guard
 *
 * **Validates: Requirements 1.1, 1.2, 7.1, 7.2, 7.3, 7.4, 7.5**
 *
 * Two complementary checks bind the SQL behaviour of
 * `public.executar_lembretes_pendentes()` (see
 * `supabase/migrations/20260603200000_lembretes_envios_and_cron.sql`) to a
 * pure-JS oracle so the spec's wall-clock guarantees are exercised by the
 * Vitest suite without a live Postgres instance:
 *
 * 1. **Guard helper property (fast-check, 200 iterations)** — A pure-JS
 *    helper mirrors the SQL guard
 *      `v_now_sp      := now() AT TIME ZONE 'America/Sao_Paulo';`
 *      `v_time_of_day := v_now_sp::time;`
 *      `IF v_time_of_day < TIME '18:00:00'`
 *      `   OR v_time_of_day >= TIME '20:00:00' THEN RETURN; END IF;`
 *    The property compares it against an independent SP projection that uses
 *    a fixed −03:00 offset (Brazil dropped DST in 2019). The two
 *    implementations must agree on the half-open window `[18:00, 20:00)` for
 *    every random UTC instant.
 *
 * 2. **Cron expression enumeration** — Walks every minute of a 24-hour UTC
 *    day (1440 minutes), applies the registered schedule `* 21,22 * * *`,
 *    and asserts every match's `America/Sao_Paulo` projection falls inside
 *    `[18:00, 20:00)`. The converse direction also runs (every SP minute in
 *    the window has a corresponding cron match) so we observe the union of
 *    all firing instants exactly equals the Reminder_Window.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

const REMINDER_WINDOW_START_HOUR = 18;
const REMINDER_WINDOW_END_HOUR = 20;
const SECONDS_PER_HOUR = 60 * 60;
const SP_OFFSET_MS = 3 * SECONDS_PER_HOUR * 1000; // BRT is UTC-3, no DST since 2019.

/**
 * Pure-JS mirror of the SQL window guard inside
 * `public.executar_lembretes_pendentes()`. Returns true iff the wall-clock
 * instant `now` projected to `America/Sao_Paulo` falls in the half-open
 * Reminder_Window `[18:00, 20:00)`.
 *
 * Uses `Intl.DateTimeFormat` with the IANA timezone — the same primitive
 * Postgres uses under the hood for `AT TIME ZONE 'America/Sao_Paulo'` —
 * so the helper tracks any future DST policy change without code edits.
 */
function isInsideReminderWindowSP(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) {
      throw new Error(`Intl.DateTimeFormat omitted ${type} part`);
    }
    return Number(found.value);
  };

  const totalSeconds = part('hour') * SECONDS_PER_HOUR + part('minute') * 60 + part('second');
  return (
    totalSeconds >= REMINDER_WINDOW_START_HOUR * SECONDS_PER_HOUR &&
    totalSeconds < REMINDER_WINDOW_END_HOUR * SECONDS_PER_HOUR
  );
}

/**
 * Independent SP wall-clock projection that intentionally avoids `Intl`.
 * Brazil dropped DST in 2019, so `America/Sao_Paulo` is fixed at UTC−3
 * for every Reminder_Day in this feature's lifetime. Acts as the oracle
 * the helper above is checked against.
 */
function projectToSPNoDst(now: Date): { hour: number; minute: number; second: number } {
  const sp = new Date(now.getTime() - SP_OFFSET_MS);
  return {
    hour: sp.getUTCHours(),
    minute: sp.getUTCMinutes(),
    second: sp.getUTCSeconds(),
  };
}

/**
 * Single-purpose matcher for the registered cron schedule `* 21,22 * * *`
 * (every minute of UTC hours 21 and 22). The full pg_cron expression
 * matches independently of day-of-month, month, and day-of-week, so for a
 * fixed UTC date the only relevant predicate is the hour field.
 */
function reminderCronMatches(utcDate: Date): boolean {
  const hour = utcDate.getUTCHours();
  return hour === 21 || hour === 22;
}

describe('Feature: child-task-reminder, Property 1a: SP-zone guard helper agrees with the no-DST oracle', () => {
  /**
   * Generates UTC instants from `2019-01-01` (after Brazil's last DST exit)
   * through `2099-12-31` so the −03:00 offset oracle is exact across the
   * full input space.
   */
  const postDstUtcDateArb = fc
    .date({
      min: new Date('2019-01-01T00:00:00Z'),
      max: new Date('2099-12-31T23:59:59Z'),
      noInvalidDate: true,
    })
    .map((d) => new Date(d.getTime() - (d.getTime() % 1000))); // second-precision

  it('returns true iff the SP-projected time-of-day is in [18:00, 20:00)', () => {
    fc.assert(
      fc.property(postDstUtcDateArb, (utcInstant) => {
        const sp = projectToSPNoDst(utcInstant);
        const totalSeconds = sp.hour * SECONDS_PER_HOUR + sp.minute * 60 + sp.second;
        const oracleSaysInside =
          totalSeconds >= REMINDER_WINDOW_START_HOUR * SECONDS_PER_HOUR &&
          totalSeconds < REMINDER_WINDOW_END_HOUR * SECONDS_PER_HOUR;

        expect(isInsideReminderWindowSP(utcInstant)).toBe(oracleSaysInside);
      }),
      { numRuns: 200 },
    );
  });

  it('rejects the exact lower-boundary instant 18:00:00 SP minus one second', () => {
    // 17:59:59 SP (one second before the window opens) must be rejected.
    const justBefore = new Date('2026-04-15T20:59:59Z'); // 17:59:59 SP
    expect(isInsideReminderWindowSP(justBefore)).toBe(false);
  });

  it('accepts the exact lower boundary 18:00:00 SP', () => {
    const lowerBoundary = new Date('2026-04-15T21:00:00Z'); // 18:00:00 SP
    expect(isInsideReminderWindowSP(lowerBoundary)).toBe(true);
  });

  it('accepts the largest in-window instant 19:59:59 SP', () => {
    const justInside = new Date('2026-04-15T22:59:59Z'); // 19:59:59 SP
    expect(isInsideReminderWindowSP(justInside)).toBe(true);
  });

  it('rejects the exact upper boundary 20:00:00 SP (half-open interval)', () => {
    const upperBoundary = new Date('2026-04-15T23:00:00Z'); // 20:00:00 SP
    expect(isInsideReminderWindowSP(upperBoundary)).toBe(false);
  });
});

describe('Feature: child-task-reminder, Property 1b: cron `* 21,22 * * *` covers exactly the Reminder_Window', () => {
  /**
   * Reference UTC day chosen well after Brazil's DST exit so the SP
   * offset is constant. The cron expression has no day-of-week,
   * day-of-month, or month predicates, so a single 24-hour walk is a
   * complete enumeration of one day's firing instants — and any other
   * day's firing instants are a translation of these by integer days,
   * which preserves both `getUTCHours()` and the SP wall-clock projection
   * given a fixed offset.
   */
  const REFERENCE_UTC_DAY = '2026-04-15';
  const MINUTES_PER_DAY = 24 * 60;

  function* walkUtcDayMinutes(): Generator<Date> {
    const startMs = new Date(`${REFERENCE_UTC_DAY}T00:00:00Z`).getTime();
    for (let i = 0; i < MINUTES_PER_DAY; i += 1) {
      yield new Date(startMs + i * 60 * 1000);
    }
  }

  it('every cron-matched minute projects into [18:00, 20:00) America/Sao_Paulo', () => {
    let matchCount = 0;
    for (const minute of walkUtcDayMinutes()) {
      if (!reminderCronMatches(minute)) continue;
      matchCount += 1;
      expect(
        isInsideReminderWindowSP(minute),
        `cron matched ${minute.toISOString()} but SP projection fell outside [18:00, 20:00)`,
      ).toBe(true);
    }
    // 60 minutes × 2 UTC hours = 120 firings per day.
    expect(matchCount).toBe(120);
  });

  it('every minute inside [18:00, 20:00) SP has a corresponding cron match', () => {
    let inWindowCount = 0;
    for (const minute of walkUtcDayMinutes()) {
      if (!isInsideReminderWindowSP(minute)) continue;
      inWindowCount += 1;
      expect(
        reminderCronMatches(minute),
        `SP minute ${minute.toISOString()} is in the window but the cron expression does not match`,
      ).toBe(true);
    }
    expect(inWindowCount).toBe(120);
  });

  it('no cron-matched minute equals or exceeds 20:00:00 SP and none precedes 18:00:00 SP', () => {
    for (const minute of walkUtcDayMinutes()) {
      if (!reminderCronMatches(minute)) continue;
      const sp = projectToSPNoDst(minute);
      const totalSeconds = sp.hour * SECONDS_PER_HOUR + sp.minute * 60 + sp.second;
      expect(totalSeconds).toBeGreaterThanOrEqual(REMINDER_WINDOW_START_HOUR * SECONDS_PER_HOUR);
      expect(totalSeconds).toBeLessThan(REMINDER_WINDOW_END_HOUR * SECONDS_PER_HOUR);
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayRange } from './date-utils';

describe('todayRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns from=today and to=tomorrow in YYYY-MM-DD format', () => {
    // Set to a known local time — the test TZ is America/Sao_Paulo (UTC-3)
    vi.setSystemTime(new Date('2026-04-18T15:00:00.000Z')); // 12:00 local
    const { from, to } = todayRange();
    expect(from).toBe('2026-04-18');
    expect(to).toBe('2026-04-19');
  });

  it('handles month boundary correctly', () => {
    vi.setSystemTime(new Date('2026-01-31T15:00:00.000Z')); // Jan 31 local
    const { from, to } = todayRange();
    expect(from).toBe('2026-01-31');
    expect(to).toBe('2026-02-01');
  });

  it('handles year boundary correctly', () => {
    vi.setSystemTime(new Date('2025-12-31T15:00:00.000Z')); // Dec 31 local
    const { from, to } = todayRange();
    expect(from).toBe('2025-12-31');
    expect(to).toBe('2026-01-01');
  });
});

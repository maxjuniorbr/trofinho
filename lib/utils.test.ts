import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, getGreeting, parseDate, toDateString } from './utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('utils', () => {
  it('formats dates in pt-BR', () => {
    expect(formatDate(new Date(2026, 2, 15))).toBe('15/03/2026');
    expect(formatDate('2026-03-15T12:00:00.000Z')).toBe('15/03/2026');
  });

  it('parses valid dates and rejects invalid overflow dates', () => {
    expect(parseDate('15/03/2026')).toEqual(new Date(2026, 2, 15));
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('2026-03-15')).toBeNull();
  });

  it('builds local YYYY-MM-DD strings', () => {
    expect(toDateString(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('returns the correct greeting for each time period', () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date(2026, 2, 15, 9, 0, 0));
    expect(getGreeting()).toBe('Bom dia');

    vi.setSystemTime(new Date(2026, 2, 15, 15, 0, 0));
    expect(getGreeting()).toBe('Boa tarde');

    vi.setSystemTime(new Date(2026, 2, 15, 20, 0, 0));
    expect(getGreeting()).toBe('Boa noite');
  });
});

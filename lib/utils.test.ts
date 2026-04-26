import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatDate,
  formatDateRelative,
  formatDateShort,
  getGreeting,
  parseDate,
  toDateString,
} from './utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('utils', () => {
  it('formats dates in pt-BR', () => {
    expect(formatDate(new Date(2026, 2, 15))).toBe('15/03/2026');
    expect(formatDate('2026-03-15T12:00:00.000Z')).toBe('15/03/2026');
  });

  it('returns empty string for null/undefined dates', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDateShort(null)).toBe('');
    expect(formatDateShort(undefined)).toBe('');
    expect(formatDateRelative(null)).toBe('');
    expect(formatDateRelative(undefined)).toBe('');
  });

  it('formats short dates as DD/MM', () => {
    expect(formatDateShort(new Date(2026, 2, 15))).toBe('15/03');
    expect(formatDateShort('2026-03-15')).toBe('15/03');
  });

  it('parses valid dates and rejects invalid overflow dates', () => {
    expect(parseDate('15/03/2026')).toEqual(new Date(2026, 2, 15));
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('2026-03-15')).toBeNull();
  });

  it('builds local YYYY-MM-DD strings', () => {
    expect(toDateString(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  describe('formatDateRelative', () => {
    const today = new Date(2026, 3, 18); // Apr 18, 2026

    it('returns "Hoje" for today', () => {
      expect(formatDateRelative(new Date(2026, 3, 18, 23, 30), today)).toBe('Hoje');
      expect(formatDateRelative('2026-04-18', today)).toBe('Hoje');
    });

    it('returns "Ontem" for yesterday', () => {
      expect(formatDateRelative('2026-04-17', today)).toBe('Ontem');
    });

    it('returns "Há N dias" for 2..7 days ago', () => {
      expect(formatDateRelative('2026-04-16', today)).toBe('Há 2 dias');
      expect(formatDateRelative('2026-04-11', today)).toBe('Há 7 dias');
    });

    it('returns weekday + DD/MM for older dates in same year', () => {
      // Apr 10 2026 is a Friday
      expect(formatDateRelative('2026-04-10', today)).toBe('Sex, 10/04');
    });

    it('returns full date for different year', () => {
      expect(formatDateRelative('2025-12-15', today)).toBe('15/12/2025');
    });
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

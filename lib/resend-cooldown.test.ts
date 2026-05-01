import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markSent, remainingCooldown, resetAllCooldowns } from './resend-cooldown';

describe('resend-cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00.000Z'));
    resetAllCooldowns();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 when no cooldown has been started', () => {
    expect(remainingCooldown('confirmation', 60)).toBe(0);
  });

  it('returns full cooldown immediately after markSent', () => {
    markSent('confirmation');
    expect(remainingCooldown('confirmation', 60)).toBe(60);
  });

  it('returns reduced cooldown after time passes', () => {
    markSent('confirmation');
    vi.advanceTimersByTime(30_000); // 30 seconds
    expect(remainingCooldown('confirmation', 60)).toBe(30);
  });

  it('returns 0 after cooldown expires', () => {
    markSent('confirmation');
    vi.advanceTimersByTime(61_000); // 61 seconds
    expect(remainingCooldown('confirmation', 60)).toBe(0);
  });

  it('tracks independent cooldowns per key', () => {
    markSent('confirmation');
    vi.advanceTimersByTime(20_000);
    markSent('recovery');
    expect(remainingCooldown('confirmation', 60)).toBe(40);
    expect(remainingCooldown('recovery', 60)).toBe(60);
  });

  it('resetAllCooldowns clears all tracked timestamps', () => {
    markSent('confirmation');
    markSent('recovery');
    resetAllCooldowns();
    expect(remainingCooldown('confirmation', 60)).toBe(0);
    expect(remainingCooldown('recovery', 60)).toBe(0);
  });
});

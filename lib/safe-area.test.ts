import { describe, expect, it } from 'vitest';
import { getSafeTopPadding, getSafeBottomPadding, getSafeHorizontalPadding } from './safe-area';

describe('getSafeTopPadding', () => {
  it('returns inset top when no base padding', () => {
    expect(getSafeTopPadding({ top: 44, bottom: 0 })).toBe(44);
  });

  it('adds base padding to inset top', () => {
    expect(getSafeTopPadding({ top: 44, bottom: 0 }, 16)).toBe(60);
  });
});

describe('getSafeBottomPadding', () => {
  it('returns inset bottom when no base padding', () => {
    expect(getSafeBottomPadding({ top: 0, bottom: 34 })).toBe(34);
  });

  it('adds base padding to inset bottom', () => {
    expect(getSafeBottomPadding({ top: 0, bottom: 34 }, 16)).toBe(50);
  });
});

describe('getSafeHorizontalPadding', () => {
  it('returns left and right padding from insets', () => {
    expect(getSafeHorizontalPadding({ left: 10, right: 10 })).toEqual({
      paddingLeft: 10,
      paddingRight: 10,
    });
  });

  it('adds base padding to horizontal insets', () => {
    expect(getSafeHorizontalPadding({ left: 10, right: 10 }, 8)).toEqual({
      paddingLeft: 18,
      paddingRight: 18,
    });
  });
});

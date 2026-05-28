import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  REMINDER_BODY_FALLBACK,
  REMINDER_BODY_PLURAL,
  REMINDER_BODY_SINGULAR,
  REMINDER_TITLE,
  buildReminderBody,
} from './copy-bank';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BANNED_SUBSTRINGS = [
  'culpa',
  'preguiça',
  'vergonha',
  'falhou',
  'falhar',
  'falha',
  'decepção',
] as const;

/**
 * True when the codepoint falls inside any of the three Unicode ranges the
 * spec calls out for the body emoji ban (req 3.3): pictographic supplement,
 * miscellaneous symbols + dingbats, and regional indicator symbols (flags).
 */
function isInForbiddenEmojiRange(codePoint: number): boolean {
  return (
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x2600 && codePoint <= 0x27bf) ||
    (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff)
  );
}

/**
 * Counts codepoints in `str` that either (a) match the Unicode property
 * `Emoji_Presentation = Yes`, or (b) fall in any of the three forbidden
 * ranges. A codepoint matching both is counted once.
 */
function countEmojiCodepoints(str: string): number {
  let count = 0;
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    const inRange = isInForbiddenEmojiRange(cp);
    const hasEmojiPresentation = /\p{Emoji_Presentation}/u.test(char);
    if (inRange || hasEmojiPresentation) {
      count += 1;
    }
  }
  return count;
}

function containsBannedSubstring(str: string): string | null {
  const lower = str.toLowerCase();
  for (const banned of BANNED_SUBSTRINGS) {
    if (lower.includes(banned)) return banned;
  }
  return null;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

/**
 * Feature: child-task-reminder, Property 5: Copy bank is total, plural-correct, and PII-free
 * Validates: Requirements 3.2, 3.3, 3.5, 3.6, 3.7
 *
 * For any positive integer pendingCount, the result of buildReminderBody:
 *  (i)   belongs to the closed set
 *        { REMINDER_BODY_SINGULAR,
 *          REMINDER_BODY_PLURAL.replace('{n}', String(pendingCount)),
 *          REMINDER_BODY_FALLBACK },
 *  (ii)  contains String(pendingCount) when pendingCount >= 2, and the
 *        literal '1' when pendingCount === 1,
 *  (iii) contains no codepoint with Emoji_Presentation = Yes and no
 *        codepoint in U+1F300..U+1FAFF, U+2600..U+27BF, U+1F1E6..U+1F1FF,
 *  (iv)  contains none of the substrings 'culpa', 'preguiça', 'vergonha',
 *        'falhou', 'falhar', 'falha', 'decepção'.
 */
describe('Property 5: Copy bank is total, plural-correct, and PII-free', () => {
  const pendingCountArb = fc.integer({ min: 1, max: 9999 });

  it('result is in the closed set of approved body strings', () => {
    fc.assert(
      fc.property(pendingCountArb, (pendingCount) => {
        const body = buildReminderBody(pendingCount);
        const allowed = new Set([
          REMINDER_BODY_SINGULAR,
          REMINDER_BODY_PLURAL.replace('{n}', String(pendingCount)),
          REMINDER_BODY_FALLBACK,
        ]);
        expect(allowed.has(body)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('contains the integer literal matching pendingCount', () => {
    fc.assert(
      fc.property(pendingCountArb, (pendingCount) => {
        const body = buildReminderBody(pendingCount);
        if (pendingCount === 1) {
          expect(body.includes('1')).toBe(true);
        } else {
          expect(body.includes(String(pendingCount))).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('contains no emoji codepoints in body output', () => {
    fc.assert(
      fc.property(pendingCountArb, (pendingCount) => {
        const body = buildReminderBody(pendingCount);
        expect(countEmojiCodepoints(body)).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  it('contains none of the banned substrings in body output', () => {
    fc.assert(
      fc.property(pendingCountArb, (pendingCount) => {
        const body = buildReminderBody(pendingCount);
        const hit = containsBannedSubstring(body);
        expect(hit).toBeNull();
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Constant-level invariants ───────────────────────────────────────────────

describe('Copy bank constants', () => {
  it('REMINDER_TITLE has at most 1 emoji codepoint (req 3.4)', () => {
    expect(countEmojiCodepoints(REMINDER_TITLE)).toBeLessThanOrEqual(1);
  });

  /**
   * Feature: child-task-reminder, additional Property: title carries exactly
   * one emoji codepoint (the server-side push template exception in
   * `ui-communication`). This is a stronger form of req 3.4 — instead of
   * "at most one", we pin "exactly one" so a future copy revision that
   * silently strips the emoji is caught here, and a future revision that
   * adds a second emoji is also caught.
   *
   * Validates: Requirements 3.4
   */
  it('REMINDER_TITLE has exactly 1 emoji codepoint (server-side push template exception)', () => {
    expect(countEmojiCodepoints(REMINDER_TITLE)).toBe(1);
  });

  it('REMINDER_TITLE contains none of the banned substrings (req 3.5)', () => {
    expect(containsBannedSubstring(REMINDER_TITLE)).toBeNull();
  });

  it('REMINDER_BODY_SINGULAR has 0 emoji codepoints (req 3.3)', () => {
    expect(countEmojiCodepoints(REMINDER_BODY_SINGULAR)).toBe(0);
  });

  it('REMINDER_BODY_SINGULAR contains none of the banned substrings (req 3.5)', () => {
    expect(containsBannedSubstring(REMINDER_BODY_SINGULAR)).toBeNull();
  });

  it('REMINDER_BODY_PLURAL has 0 emoji codepoints (req 3.3)', () => {
    expect(countEmojiCodepoints(REMINDER_BODY_PLURAL)).toBe(0);
  });

  it('REMINDER_BODY_PLURAL contains none of the banned substrings (req 3.5)', () => {
    expect(containsBannedSubstring(REMINDER_BODY_PLURAL)).toBeNull();
  });

  it('REMINDER_BODY_FALLBACK has 0 emoji codepoints (req 3.3)', () => {
    expect(countEmojiCodepoints(REMINDER_BODY_FALLBACK)).toBe(0);
  });

  it('REMINDER_BODY_FALLBACK contains none of the banned substrings (req 3.5)', () => {
    expect(containsBannedSubstring(REMINDER_BODY_FALLBACK)).toBeNull();
  });
});

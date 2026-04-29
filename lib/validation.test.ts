import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { isValidEmail, MAX_EMAIL_LENGTH } from './validation';

describe('validation', () => {
  it('accepts well-formed emails', () => {
    expect(isValidEmail('mail@example.com')).toBe(true);
    expect(isValidEmail('  first.last+tag@example.com  ')).toBe(true);
  });

  it('rejects malformed emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('test@.example.com')).toBe(false);
    expect(isValidEmail('test@example..com')).toBe(false);
    expect(isValidEmail('test@-example.com')).toBe(false);
    expect(isValidEmail(`a@${'b'.repeat(MAX_EMAIL_LENGTH)}.com`)).toBe(false);
  });
});

describe('isValidEmail property tests', () => {
  it('rejects strings without @', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('@')),
        (s) => {
          expect(isValidEmail(s)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts format user@domain.tld', () => {
    const localPart = fc.stringMatching(/^[a-z][a-z0-9.]{0,10}$/);
    const domain = fc.stringMatching(/^[a-z][a-z0-9]{1,8}\.[a-z]{2,4}$/);
    fc.assert(
      fc.property(localPart, domain, (local, dom) => {
        expect(isValidEmail(`${local}@${dom}`)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

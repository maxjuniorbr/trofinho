import { describe, expect, it } from 'vitest';
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

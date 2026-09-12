import { describe, expect, it } from 'vitest';
import { looksLikeInternationalNumber, normaliseNumber } from '@/lib/firebase-client';

describe('the phone number people type', () => {
  it('accepts international numbers, spaces and dashes and all', () => {
    expect(looksLikeInternationalNumber('+49 151 23456789')).toBe(true);
    expect(looksLikeInternationalNumber('+250-788-123-456')).toBe(true);
    expect(looksLikeInternationalNumber('+1 (415) 555 0132')).toBe(true);
  });

  it('refuses what Firebase would refuse', () => {
    expect(looksLikeInternationalNumber('0151 23456789')).toBe(false); // no country code
    expect(looksLikeInternationalNumber('+0151234567')).toBe(false); // country code cannot start with 0
    expect(looksLikeInternationalNumber('+49')).toBe(false); // far too short
    expect(looksLikeInternationalNumber('not a number')).toBe(false);
    expect(looksLikeInternationalNumber('')).toBe(false);
  });

  it('strips the punctuation before sending it on', () => {
    expect(normaliseNumber('+49 (151) 234-56789')).toBe('+4915123456789');
  });
});

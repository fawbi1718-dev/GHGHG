import { describe, it, expect } from 'vitest';
import { normalizeBarcode, normalizeSearchText } from '../../services/syncEngine';

describe('normalizeBarcode', () => {
  it('preserves leading zeroes and string type', () => {
    expect(normalizeBarcode('0012345')).toBe('0012345');
    expect(typeof normalizeBarcode(12345)).toBe('string');
  });

  it('trims whitespace and strips zero-width characters and quotes', () => {
    expect(normalizeBarcode('  "00\u200B123" ')).toBe('00123');
  });

  it('returns empty string for nullish input', () => {
    expect(normalizeBarcode(null)).toBe('');
    expect(normalizeBarcode(undefined)).toBe('');
  });
});

describe('normalizeSearchText (Arabic-aware)', () => {
  it('lowercases and trims', () => {
    expect(normalizeSearchText('  Panadol Extra ')).toBe('panadol extra');
  });

  it('normalizes alif variants and removes diacritics/tatweel', () => {
    const raw = 'أَحْمَـد';
    expect(normalizeSearchText(raw)).toBe('احمد');
  });

  it('normalizes teh marbuta and yeh', () => {
    expect(normalizeSearchText('صيدلية')).toBe(normalizeSearchText('صيدليه'));
    expect(normalizeSearchText('دواء ي')).toContain('ى');
  });
});

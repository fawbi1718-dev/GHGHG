import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyKey,
  withDerivedSearchFields,
  normalizeSearchText,
} from '../../services/syncEngine';

describe('normalizeCompanyKey (company identity stability)', () => {
  it('is case-insensitive', () => {
    expect(normalizeCompanyKey('Tamson Pharma')).toBe(normalizeCompanyKey('tamson pharma'));
  });

  it('strips corporate suffixes so variants collapse to one identity', () => {
    expect(normalizeCompanyKey('Tamson Pharmaceuticals Ltd.'))
      .toBe(normalizeCompanyKey('tamson co'));
  });

  it('ignores punctuation differences', () => {
    // Punctuation becomes separators; only word-level identity matters.
    expect(normalizeCompanyKey('A.B.C - Pharma, Inc.')).toBe(normalizeCompanyKey('a b c'));
  });

  it('returns empty key for blank input — callers apply their own fallback', () => {
    // getUniqueCompaniesLocal maps an empty key to its own display fallback;
    // the helper stays a pure normalizer.
    expect(normalizeCompanyKey('')).toBe('');
  });

  /**
   * Contract with searchLocalMeds company filtering: the filter compares this
   * key against keys produced by getUniqueCompaniesLocal — both must use the
   * exact same normalization or filtered searches silently return nothing.
   */
  it('matches the live per-row normalization used by the search path', () => {
    const raw = '  Ibn-Sina Pharmaceutical Industries, Ltd ';
    const viaHelper = normalizeCompanyKey(raw);
    // Legacy inline implementation (kept in sync by this test):
    const clean = String(raw).trim();
    let legacy = clean.toLowerCase();
    legacy = legacy.replace(/[.,\/#!$%\^&\*;:{}=\-_~()]/g, ' ');
    legacy = legacy.replace(/\b(pharma|pharmaceuticals|laboratories|laboratory|labs|ltd|inc|co|company|s\.?a\.?r\.?l\.?|llc|s\.?a\.?)\b/gi, ' ');
    legacy = legacy.replace(/\s+/g, ' ').trim();
    expect(viaHelper).toBe(legacy);
  });
});

describe('withDerivedSearchFields (precomputed ≡ live normalization)', () => {
  const item = {
    sako: '42',
    name: 'أَسِـبرين',
    nameEn: '  ASPIRIN ',
    company_name: 'Bayer  Labs, Ltd.',
    composition_key: 'Acidum  acetylsalicylicum',
    barcode: '"00598910001"',
  };

  it('precomputed fields equal normalizeSearchText(field) exactly', () => {
    const d = withDerivedSearchFields(item as any);
    expect(d._sn).toBe(normalizeSearchText(item.name));
    expect(d._se).toBe(normalizeSearchText(item.nameEn));
    expect(d._sc).toBe(normalizeSearchText(item.company_name));
    expect(d._sk).toBe(normalizeSearchText(item.composition_key));
    expect(d._sb).toBe(normalizeSearchText(item.barcode));
  });

  it('does not mutate the source record', () => {
    const clone = { ...item };
    withDerivedSearchFields(clone as any);
    expect(clone).toEqual(item);
  });

  it('handles missing fields without throwing', () => {
    expect(() => withDerivedSearchFields({} as any)).not.toThrow();
    const d = withDerivedSearchFields({} as any);
    expect(d._sn).toBe('');
  });
});

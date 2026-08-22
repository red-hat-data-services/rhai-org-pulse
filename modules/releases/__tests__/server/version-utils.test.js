import { describe, it, expect } from 'vitest';

const {
  stripZStream,
  normalizeVersionName,
  normalizeProductName,
  parseVersionComponents,
  extractProduct,
  isVersionEquivalent,
  isValidVersionParam
} = require('../../server/version-utils');

// ---------------------------------------------------------------------------
// stripZStream
// ---------------------------------------------------------------------------

describe('stripZStream', () => {
  it('removes terminal .z suffix', () => {
    expect(stripZStream('rhoai-3.5.z')).toBe('rhoai-3.5');
  });

  it('removes .z before another dot', () => {
    expect(stripZStream('rhoai-3.5.z.EA1')).toBe('rhoai-3.5.EA1');
  });

  it('is case-insensitive', () => {
    expect(stripZStream('RHOAI-3.5.Z')).toBe('RHOAI-3.5');
  });

  it('passes through null/empty', () => {
    expect(stripZStream(null)).toBeNull();
    expect(stripZStream('')).toBe('');
    expect(stripZStream(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeVersionName — basic transformations
// ---------------------------------------------------------------------------

describe('normalizeVersionName', () => {
  it('lowercases', () => {
    expect(normalizeVersionName('RHOAI-2.14')).toBe('rhoai 2 14');
  });

  it('strips terminal .z suffix', () => {
    expect(normalizeVersionName('rhoai-3.5.z')).toBe('rhoai 3 5');
  });

  it('strips .z before EA suffix', () => {
    expect(normalizeVersionName('rhoai-3.5.z.EA1')).toBe('rhoai 3 5 ea1');
  });

  it('normalizes dots and hyphens to spaces', () => {
    expect(normalizeVersionName('RHOAI-2.14')).toBe('rhoai 2 14');
    expect(normalizeVersionName('RHOAI 2.14')).toBe('rhoai 2 14');
    expect(normalizeVersionName('rhoai.2.14')).toBe('rhoai 2 14');
  });

  it('normalizes underscores to spaces', () => {
    expect(normalizeVersionName('rhoai_3_5')).toBe('rhoai 3 5');
    expect(normalizeVersionName('RHOAI_2.20.0')).toBe('rhoai 2 20 0');
  });

  it('normalizes EA variants to same form', () => {
    expect(normalizeVersionName('RHAII-3.5.EA1')).toBe('rhaii 3 5 ea1');
    expect(normalizeVersionName('RHAII-3.5 EA1')).toBe('rhaii 3 5 ea1');
    expect(normalizeVersionName('RHAII 3.5 EA1')).toBe('rhaii 3 5 ea1');
  });

  it('normalizes EA-1 to EA1 (hyphenated phase)', () => {
    expect(normalizeVersionName('RHELAI-3.4 EA-1')).toBe('rhelai 3 4 ea1');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeVersionName('rhoai  3.5')).toBe('rhoai 3 5');
  });

  it('trims whitespace', () => {
    expect(normalizeVersionName('  rhoai-3.5  ')).toBe('rhoai 3 5');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeVersionName('')).toBe('');
    expect(normalizeVersionName(null)).toBe('');
    expect(normalizeVersionName(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// normalizeVersionName — RHAISTRAT format (version-first)
// ---------------------------------------------------------------------------

describe('normalizeVersionName — RHAISTRAT format', () => {
  it('{ver} GA {product} RELEASE', () => {
    expect(normalizeVersionName('3.5 GA RHOAI RELEASE')).toBe('rhoai 3 5');
    expect(normalizeVersionName('3.5 GA RHAII RELEASE')).toBe('rhaii 3 5');
    expect(normalizeVersionName('3.5 GA RHELAI RELEASE')).toBe('rhelai 3 5');
    expect(normalizeVersionName('3.6 GA RHAII RELEASE')).toBe('rhaii 3 6');
  });

  it('{ver} EA {product} RELEASE', () => {
    expect(normalizeVersionName('3.5 EA1 RHOAI RELEASE')).toBe('rhoai 3 5 ea1');
    expect(normalizeVersionName('3.5 EA2 RHOAI RELEASE')).toBe('rhoai 3 5 ea2');
    expect(normalizeVersionName('3.5 EA1 RHAII RELEASE')).toBe('rhaii 3 5 ea1');
    expect(normalizeVersionName('3.6 EA1 RHOAI RELEASE')).toBe('rhoai 3 6 ea1');
    expect(normalizeVersionName('3.6 EA2 RHAII RELEASE')).toBe('rhaii 3 6 ea2');
  });

  it('{ver} {phase} {product} (no RELEASE)', () => {
    expect(normalizeVersionName('2.25.9 GA RHOAI')).toBe('rhoai 2 25 9');
    expect(normalizeVersionName('3.3.4 GA RHOAI')).toBe('rhoai 3 3 4');
  });

  it('{ver} {product} Release (no phase)', () => {
    expect(normalizeVersionName('2.25.8 RHAII Release')).toBe('rhaii 2 25 8');
    expect(normalizeVersionName('3.3.5 RHAII Release')).toBe('rhaii 3 3 5');
  });

  it('RHAISTRAT and RHOAIENG normalize to same form', () => {
    expect(normalizeVersionName('3.5 GA RHOAI RELEASE')).toBe(normalizeVersionName('rhoai-3.5'));
    expect(normalizeVersionName('3.5 EA1 RHOAI RELEASE')).toBe(normalizeVersionName('rhoai-3.5.EA1'));
    expect(normalizeVersionName('3.5 EA2 RHOAI RELEASE')).toBe(normalizeVersionName('rhoai-3.5.EA2'));
    expect(normalizeVersionName('3.6 EA1 RHOAI RELEASE')).toBe(normalizeVersionName('rhoai-3.6.EA1'));
    expect(normalizeVersionName('3.5 GA RHAII RELEASE')).toBe(normalizeVersionName('RHAII-3.5'));
  });
});

// ---------------------------------------------------------------------------
// normalizeVersionName — product-first formats
// ---------------------------------------------------------------------------

describe('normalizeVersionName — product-first format', () => {
  it('{product}-{ver}', () => {
    expect(normalizeVersionName('RHAII-3.5')).toBe('rhaii 3 5');
    expect(normalizeVersionName('RHAIIS-3.3')).toBe('rhaiis 3 3');
    expect(normalizeVersionName('rhoai-3.4')).toBe('rhoai 3 4');
  });

  it('{product}-{ver}.{phase}', () => {
    expect(normalizeVersionName('rhoai-3.4.EA1')).toBe('rhoai 3 4 ea1');
    expect(normalizeVersionName('rhoai-3.4.EA2')).toBe('rhoai 3 4 ea2');
  });

  it('{product}-{ver} {phase}', () => {
    expect(normalizeVersionName('RHAIIS-3.4 EA2')).toBe('rhaiis 3 4 ea2');
  });

  it('{PRODUCT} {ver}', () => {
    expect(normalizeVersionName('RHAIIS 3.0')).toBe('rhaiis 3 0');
  });

  it('{PRODUCT} {ver} GA — strips trailing GA', () => {
    expect(normalizeVersionName('RHAIIS 3.0 GA')).toBe('rhaiis 3 0');
    expect(normalizeVersionName('RHOAI 3.3.4 GA')).toBe('rhoai 3 3 4');
  });

  it('RHEL AI (multi-word product name)', () => {
    expect(normalizeVersionName('RHEL AI 2.22.0')).toBe('rhelai 2 22 0');
  });
});

// ---------------------------------------------------------------------------
// normalizeVersionName — special markers (no rearrangement)
// ---------------------------------------------------------------------------

describe('normalizeVersionName — special markers', () => {
  it('does not rearrange unknown patterns', () => {
    expect(normalizeVersionName('rhoai-3.3 code freeze')).toBe('rhoai 3 3 code freeze');
    expect(normalizeVersionName('rhai-Z-Stream')).toBe('rhai z stream');
  });
});

// ---------------------------------------------------------------------------
// normalizeProductName
// ---------------------------------------------------------------------------

describe('normalizeProductName', () => {
  it('maps RHAII → rhaiis', () => {
    expect(normalizeProductName('RHAII')).toBe('rhaiis');
    expect(normalizeProductName('rhaii')).toBe('rhaiis');
  });

  it('maps rhai → rhoai', () => {
    expect(normalizeProductName('rhai')).toBe('rhoai');
    expect(normalizeProductName('RHAI')).toBe('rhoai');
  });

  it('maps RHEL AI → rhelai', () => {
    expect(normalizeProductName('RHEL AI')).toBe('rhelai');
  });

  it('preserves already-canonical names', () => {
    expect(normalizeProductName('rhoai')).toBe('rhoai');
    expect(normalizeProductName('rhaiis')).toBe('rhaiis');
    expect(normalizeProductName('rhelai')).toBe('rhelai');
  });

  it('handles null/empty', () => {
    expect(normalizeProductName(null)).toBe('');
    expect(normalizeProductName('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// parseVersionComponents
// ---------------------------------------------------------------------------

describe('parseVersionComponents', () => {
  it('parses {product}-{ver}', () => {
    expect(parseVersionComponents('rhoai-3.5')).toEqual({
      product: 'rhoai', version: '3.5', phase: null
    });
  });

  it('parses {product}-{ver}.{phase}', () => {
    expect(parseVersionComponents('rhoai-3.5.EA1')).toEqual({
      product: 'rhoai', version: '3.5', phase: 'EA1'
    });
  });

  it('parses RHAISTRAT format', () => {
    expect(parseVersionComponents('3.5 EA1 RHOAI RELEASE')).toEqual({
      product: 'rhoai', version: '3.5', phase: 'EA1'
    });
  });

  it('parses GA as null phase', () => {
    expect(parseVersionComponents('3.5 GA RHOAI RELEASE')).toEqual({
      product: 'rhoai', version: '3.5', phase: null
    });
  });

  it('parses multi-segment versions', () => {
    expect(parseVersionComponents('rhoai-2.25.9')).toEqual({
      product: 'rhoai', version: '2.25.9', phase: null
    });
  });

  it('returns null for unrecognized patterns', () => {
    expect(parseVersionComponents('some random string')).toBeNull();
    expect(parseVersionComponents('')).toBeNull();
    expect(parseVersionComponents(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractProduct
// ---------------------------------------------------------------------------

describe('extractProduct', () => {
  it('extracts from dash-prefixed format', () => {
    expect(extractProduct('rhoai-3.5')).toBe('rhoai');
    expect(extractProduct('RHAII-3.5')).toBe('rhaii');
  });

  it('extracts from RHAISTRAT format', () => {
    expect(extractProduct('3.5 EA1 RHOAI RELEASE')).toBe('rhoai');
    expect(extractProduct('3.6 GA RHAII RELEASE')).toBe('rhaii');
  });

  it('extracts from space-separated format', () => {
    expect(extractProduct('RHAIIS 3.0 GA')).toBe('rhaiis');
  });

  it('returns null for unrecognized input', () => {
    expect(extractProduct('')).toBeNull();
    expect(extractProduct(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isVersionEquivalent
// ---------------------------------------------------------------------------

describe('isVersionEquivalent', () => {
  it('matches RHAISTRAT format against RHOAIENG format', () => {
    expect(isVersionEquivalent('3.5 GA RHOAI RELEASE', 'rhoai-3.5')).toBe(true);
    expect(isVersionEquivalent('3.5 EA1 RHOAI RELEASE', 'rhoai-3.5.EA1')).toBe(true);
  });

  it('matches different separator conventions', () => {
    expect(isVersionEquivalent('RHAII-3.5.EA1', 'RHAII-3.5 EA1')).toBe(true);
    expect(isVersionEquivalent('rhoai-3.5.EA2', 'rhoai-3.5 EA2')).toBe(true);
  });

  it('does not match different versions', () => {
    expect(isVersionEquivalent('rhoai-3.5', 'rhoai-3.6')).toBe(false);
  });

  it('returns false for empty strings', () => {
    expect(isVersionEquivalent('', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidVersionParam
// ---------------------------------------------------------------------------

describe('isValidVersionParam', () => {
  it('accepts dash-separated versions', () => {
    expect(isValidVersionParam('rhoai-3.5')).toBe(true);
    expect(isValidVersionParam('rhoai-3.5.EA1')).toBe(true);
  });

  it('accepts space-containing versions (RHAISTRAT format)', () => {
    expect(isValidVersionParam('3.5 GA RHOAI RELEASE')).toBe(true);
    expect(isValidVersionParam('3.5 EA1 RHOAI RELEASE')).toBe(true);
    expect(isValidVersionParam('RHAIIS-3.4 EA2')).toBe(true);
  });

  it('rejects path traversal', () => {
    expect(isValidVersionParam('../etc/passwd')).toBe(false);
    expect(isValidVersionParam('foo/bar')).toBe(false);
    expect(isValidVersionParam('foo\\bar')).toBe(false);
  });

  it('rejects reserved names', () => {
    expect(isValidVersionParam('__proto__')).toBe(false);
    expect(isValidVersionParam('constructor')).toBe(false);
    expect(isValidVersionParam('prototype')).toBe(false);
  });

  it('rejects empty/null', () => {
    expect(isValidVersionParam('')).toBe(false);
    expect(isValidVersionParam(null)).toBe(false);
    expect(isValidVersionParam(undefined)).toBe(false);
  });

  it('rejects overly long strings', () => {
    expect(isValidVersionParam('a'.repeat(81))).toBe(false);
  });
});

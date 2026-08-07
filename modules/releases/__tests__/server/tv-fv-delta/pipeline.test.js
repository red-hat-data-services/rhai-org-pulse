import { describe, it, expect } from 'vitest';

const {
  normVer,
  parseVersions,
  extractVersionNames,
  isZStream,
  parseReleaseName,
  compareReleases,
  compareReleasesTemporally,
  extractProduct,
  buildReleaseDatesMap,
  isReleaseFrozen,
  normalizeIssue,
  classifyFeatures,
  buildExport,
  normalizeLegacyTvFvCache,
  DEFAULT_RELEASES,
  jqlSafePattern,
} = require('../../../server/tv-fv-delta/routes');

// ---------------------------------------------------------------------------
// normVer
// ---------------------------------------------------------------------------

describe('normVer', () => {
  it('lowercases version strings', () => {
    expect(normVer('RHOAI-3.5')).toBe('rhoai 3 5');
  });

  it('normalises RHOAI_ prefix via shared normalizer', () => {
    expect(normVer('RHOAI_3_5')).toBe('rhoai 3 5');
  });

  it('trims whitespace', () => {
    expect(normVer('  rhoai-3.5  ')).toBe('rhoai 3 5');
  });

  it('returns null for empty, null, undefined, or "null"/"undefined" strings', () => {
    expect(normVer(null)).toBeNull();
    expect(normVer(undefined)).toBeNull();
    expect(normVer('')).toBeNull();
    expect(normVer('null')).toBeNull();
    expect(normVer('undefined')).toBeNull();
  });

  it('normalises EA versions', () => {
    expect(normVer('rhoai-3.5.ea1')).toBe('rhoai 3 5 ea1');
  });

  it('handles lowercase rhoai_ prefix', () => {
    expect(normVer('rhoai_3_5')).toBe('rhoai 3 5');
  });

  it('handles RHAISTRAT format', () => {
    expect(normVer('3.5 EA1 RHOAI RELEASE')).toBe('rhoai 3 5 ea1');
    expect(normVer('3.5 GA RHOAI RELEASE')).toBe('rhoai 3 5');
  });
});

// ---------------------------------------------------------------------------
// parseVersions
// ---------------------------------------------------------------------------

describe('parseVersions', () => {
  it('returns empty set for falsy input', () => {
    expect(parseVersions(null).size).toBe(0);
    expect(parseVersions('').size).toBe(0);
    expect(parseVersions(undefined).size).toBe(0);
  });

  it('parses comma-separated version strings', () => {
    const result = parseVersions('rhoai-3.5, rhoai-3.5.EA1');
    expect(result.size).toBe(2);
    expect(result.has('rhoai 3 5')).toBe(true);
    expect(result.has('rhoai 3 5 ea1')).toBe(true);
  });

  it('normalises each version', () => {
    const result = parseVersions('RHOAI_3_5');
    expect(result.has('rhoai 3 5')).toBe(true);
  });

  it('filters out null results from normalisation', () => {
    const result = parseVersions('rhoai-3.5, , null');
    expect(result.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// extractVersionNames
// ---------------------------------------------------------------------------

describe('extractVersionNames', () => {
  it('extracts names from fixVersions array', () => {
    const result = extractVersionNames([{ name: 'rhoai-3.5' }, { name: 'rhoai-3.5.EA1' }]);
    expect(result).toBe('rhoai-3.5, rhoai-3.5.EA1');
  });

  it('returns empty string for non-array input', () => {
    expect(extractVersionNames(null)).toBe('');
    expect(extractVersionNames(undefined)).toBe('');
    expect(extractVersionNames('string')).toBe('');
  });

  it('handles objects without name property', () => {
    expect(extractVersionNames([{}, { name: 'v1' }])).toBe('v1');
  });
});

// ---------------------------------------------------------------------------
// isZStream
// ---------------------------------------------------------------------------

describe('isZStream', () => {
  it('detects z-stream patch releases', () => {
    expect(isZStream('rhoai-3.4.1')).toBe(true);
    expect(isZStream('rhoai-3.5.2')).toBe(true);
    expect(isZStream('rhoai-2.16.3')).toBe(true);
    expect(isZStream('RHOAI-3.4.1')).toBe(true);
  });

  it('does not flag GA releases', () => {
    expect(isZStream('rhoai-3.5')).toBe(false);
    expect(isZStream('rhoai-3.4')).toBe(false);
  });

  it('does not flag EA releases', () => {
    expect(isZStream('rhoai-3.5.EA1')).toBe(false);
    expect(isZStream('rhoai-3.5.EA2')).toBe(false);
    expect(isZStream('rhoai-3.5.ea1')).toBe(false);
  });

  it('returns false for null/undefined/empty', () => {
    expect(isZStream(null)).toBe(false);
    expect(isZStream(undefined)).toBe(false);
    expect(isZStream('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseReleaseName
// ---------------------------------------------------------------------------

describe('parseReleaseName', () => {
  it('parses standard GA release', () => {
    const result = parseReleaseName('rhoai-3.5');
    expect(result).toEqual({
      product: 'rhoai',
      major: 3,
      minor: 5,
      milestone: 'GA',
      milestoneOrder: 99,
      raw: 'rhoai-3.5',
    });
  });

  it('parses EA1 milestone', () => {
    const result = parseReleaseName('rhoai-3.6.EA1');
    expect(result).toEqual({
      product: 'rhoai',
      major: 3,
      minor: 6,
      milestone: 'EA1',
      milestoneOrder: 1,
      raw: 'rhoai-3.6.EA1',
    });
  });

  it('parses EA2 milestone', () => {
    const result = parseReleaseName('rhelai-3.2.EA2');
    expect(result).toEqual({
      product: 'rhelai',
      major: 3,
      minor: 2,
      milestone: 'EA2',
      milestoneOrder: 2,
      raw: 'rhelai-3.2.EA2',
    });
  });

  it('is case insensitive', () => {
    const result = parseReleaseName('RHOAI-3.5');
    expect(result.product).toBe('rhoai');
    expect(result.major).toBe(3);
    expect(result.minor).toBe(5);
  });

  it('returns null for unparseable versions', () => {
    expect(parseReleaseName('some-random-version')).toBeNull();
    expect(parseReleaseName('v1.2.3')).toBeNull();
  });

  it('does not parse z-streams (major.minor.patch)', () => {
    expect(parseReleaseName('rhoai-3.5.1')).toBeNull();
  });

  it('handles all products', () => {
    expect(parseReleaseName('rhoai-3.5').product).toBe('rhoai');
    expect(parseReleaseName('rhelai-3.2').product).toBe('rhelai');
    expect(parseReleaseName('rhaii-3.6').product).toBe('rhaii');
  });

  it('parses Jira Target/Fix Version names', () => {
    expect(parseReleaseName('3.6 EA1 RHOAI RELEASE')).toEqual({
      product: 'rhoai',
      major: 3,
      minor: 6,
      milestone: 'EA1',
      milestoneOrder: 1,
      raw: '3.6 EA1 RHOAI RELEASE',
    });
    expect(parseReleaseName('3.6 GA RHOAI RELEASE')).toMatchObject({
      product: 'rhoai',
      milestone: 'GA',
      milestoneOrder: 99,
    });
    expect(parseReleaseName('3.5 EA2 RHAII RELEASE').product).toBe('rhaii');
    expect(parseReleaseName('3.6 GA RHELAI RELEASE').product).toBe('rhelai');
  });
});

describe('buildReleaseDatesMap', () => {
  it('indexes Product Pages dates under normVer so Jira release names resolve', () => {
    const map = buildReleaseDatesMap([
      {
        productName: 'rhoai',
        releaseNumber: 'rhoai-3.6.EA1',
        dueDate: '2026-09-17',
        planningFreezeDate: '2026-07-29',
      },
    ]);
    const key = normVer('3.6 EA1 RHOAI RELEASE');
    expect(key).toBe('rhoai 3 6 ea1');
    expect(map[key]).toEqual({
      dueDate: '2026-09-17',
      planningFreezeDate: '2026-07-29',
    });
    expect(map['rhoai-3.6.ea1']).toEqual(map[key]);
  });
});

describe('normalizeLegacyTvFvCache', () => {
  it('maps aligned/mismatched summary + buckets to 5-category fields', () => {
    const legacy = {
      metadata: { generated_at: '2026-07-27T00:00:00.000Z', releases: ['3.6 EA1 RHOAI RELEASE'] },
      executive_summary: [{
        release: '3.6 EA1 RHOAI RELEASE',
        total: 140,
        aligned: 49,
        aligned_jql: 'https://example/aligned',
        mismatched: 10,
        mismatched_jql: 'https://example/mismatch',
        tv_only: 72,
        fv_only: 9,
        alignment_pct: 35,
      }],
      releases: {
        '3.6 EA1 RHOAI RELEASE': {
          aligned: [{ key: 'A-1' }],
          mismatched: [{ key: 'M-1' }],
          tv_only: [{ key: 'T-1' }],
          fv_only: [{ key: 'F-1' }],
        },
      },
      component_breakdown: [{
        component: 'Serving', total: 10, aligned: 4, mismatched: 1, tv_only: 4, fv_only: 1, alignment_pct: 40,
      }],
    };

    const normalized = normalizeLegacyTvFvCache(legacy);
    expect(normalized).not.toBe(legacy);
    expect(normalized.executive_summary[0].aligned_on_time).toBe(49);
    expect(normalized.executive_summary[0].aligned_late).toBe(0);
    expect(normalized.executive_summary[0].misaligned).toBe(10);
    expect(normalized.executive_summary[0].aligned_on_time_jql).toBe('https://example/aligned');
    expect(normalized.executive_summary[0].alignment_pct).toBe(35);
    expect(normalized.releases['3.6 EA1 RHOAI RELEASE'].aligned_on_time).toEqual([{ key: 'A-1' }]);
    expect(normalized.releases['3.6 EA1 RHOAI RELEASE'].aligned_late).toEqual([]);
    expect(normalized.releases['3.6 EA1 RHOAI RELEASE'].misaligned).toEqual([{ key: 'M-1' }]);
    expect(normalized.component_breakdown[0].aligned_on_time).toBe(4);
    expect(normalized.component_breakdown[0].misaligned).toBe(1);
    expect(normalized.metadata.legacy_migrated).toBe(true);
  });

  it('leaves already-migrated payloads unchanged by reference', () => {
    const current = {
      metadata: { generated_at: '2026-07-27T00:00:00.000Z' },
      executive_summary: [{
        release: 'x', total: 2, aligned_on_time: 1, aligned_late: 0, tv_only: 0, fv_only: 0, misaligned: 1, alignment_pct: 50,
      }],
      releases: {
        x: { aligned_on_time: [], aligned_late: [], tv_only: [], fv_only: [], misaligned: [] },
      },
    };
    expect(normalizeLegacyTvFvCache(current)).toBe(current);
  });
});

// ---------------------------------------------------------------------------
// compareReleases
// ---------------------------------------------------------------------------

describe('compareReleases', () => {
  it('orders same product by minor version (later version has lower number)', () => {
    expect(compareReleases('rhoai-3.6', 'rhoai-3.5')).toBeLessThan(0); // 3.6 before 3.5
    expect(compareReleases('rhoai-3.5', 'rhoai-3.6')).toBeGreaterThan(0);
  });

  it('orders same product/version by milestone (EA1 < EA2 < GA)', () => {
    expect(compareReleases('rhoai-3.6.EA1', 'rhoai-3.6.EA2')).toBeLessThan(0);
    expect(compareReleases('rhoai-3.6.EA2', 'rhoai-3.6')).toBeLessThan(0); // EA2 before GA
    expect(compareReleases('rhoai-3.6.EA1', 'rhoai-3.6')).toBeLessThan(0); // EA1 before GA
  });

  it('orders different products alphabetically', () => {
    expect(compareReleases('rhelai-3.5', 'rhoai-3.5')).toBeLessThan(0); // rhelai < rhoai
    expect(compareReleases('rhaii-3.5', 'rhoai-3.5')).toBeLessThan(0); // rhaii < rhoai
  });

  it('sorts unparseable releases last, alphabetically', () => {
    expect(compareReleases('unparseable-a', 'unparseable-b')).toBeLessThan(0);
    expect(compareReleases('rhoai-3.5', 'unparseable')).toBeLessThan(0); // parseable before unparseable
  });
});

// ---------------------------------------------------------------------------
// compareReleasesTemporally
// ---------------------------------------------------------------------------

describe('compareReleasesTemporally', () => {
  it('returns positive when first arg is temporally later (higher minor)', () => {
    expect(compareReleasesTemporally('rhoai-3.6', 'rhoai-3.5')).toBeGreaterThan(0);
  });

  it('returns negative when first arg is temporally earlier (lower minor)', () => {
    expect(compareReleasesTemporally('rhoai-3.5', 'rhoai-3.6')).toBeLessThan(0);
  });

  it('returns 0 for same release', () => {
    expect(compareReleasesTemporally('rhoai-3.5', 'rhoai-3.5')).toBe(0);
  });

  it('EA1 before EA2 before GA (same minor)', () => {
    expect(compareReleasesTemporally('rhoai-3.6.EA1', 'rhoai-3.6.EA2')).toBeLessThan(0);
    expect(compareReleasesTemporally('rhoai-3.6.EA2', 'rhoai-3.6.EA1')).toBeGreaterThan(0);
    expect(compareReleasesTemporally('rhoai-3.6.EA1', 'rhoai-3.6')).toBeLessThan(0); // EA1 before GA
    expect(compareReleasesTemporally('rhoai-3.6.EA2', 'rhoai-3.6')).toBeLessThan(0); // EA2 before GA
    expect(compareReleasesTemporally('rhoai-3.6', 'rhoai-3.6.EA1')).toBeGreaterThan(0); // GA after EA1
  });

  it('returns null for cross-product comparison', () => {
    expect(compareReleasesTemporally('rhoai-3.5', 'rhelai-3.5')).toBeNull();
  });

  it('returns null when either release is unparseable', () => {
    expect(compareReleasesTemporally('rhoai-3.5', 'unparseable')).toBeNull();
    expect(compareReleasesTemporally('unparseable', 'rhoai-3.5')).toBeNull();
    expect(compareReleasesTemporally('rhoai-3.5.1', 'rhoai-3.5')).toBeNull(); // z-stream
  });

  it('handles major version differences', () => {
    expect(compareReleasesTemporally('rhoai-4.0', 'rhoai-3.5')).toBeGreaterThan(0);
    expect(compareReleasesTemporally('rhoai-2.5', 'rhoai-3.5')).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// extractProduct
// ---------------------------------------------------------------------------

describe('extractProduct', () => {
  it('extracts product from valid release names', () => {
    expect(extractProduct('rhoai-3.5')).toBe('rhoai');
    expect(extractProduct('rhelai-3.2')).toBe('rhelai');
    expect(extractProduct('rhaii-3.6.EA1')).toBe('rhaii');
  });

  it('is case insensitive', () => {
    expect(extractProduct('RHOAI-3.5')).toBe('rhoai');
  });

  it('returns null for unparseable names', () => {
    expect(extractProduct('unparseable')).toBeNull();
    expect(extractProduct('v1.2.3')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isReleaseFrozen
// ---------------------------------------------------------------------------

describe('isReleaseFrozen', () => {
  it('returns true when planning freeze is in the past', () => {
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: '2026-06-01', dueDate: '2026-08-01' },
    };
    expect(isReleaseFrozen('rhoai-3.5', releaseDates)).toBe(true);
  });

  it('returns false when planning freeze is in the future', () => {
    const releaseDates = {
      'rhoai-3.6': { planningFreezeDate: '2026-09-01', dueDate: '2026-10-01' },
    };
    expect(isReleaseFrozen('rhoai-3.6', releaseDates)).toBe(false);
  });

  it('falls back to GA date when planning freeze is missing', () => {
    const releaseDates = {
      'rhoai-3.5': { dueDate: '2026-06-01' }, // GA in past
    };
    expect(isReleaseFrozen('rhoai-3.5', releaseDates)).toBe(true);
  });

  it('returns false when GA is in future (and no planning freeze)', () => {
    const releaseDates = {
      'rhoai-3.6': { dueDate: '2026-09-01' }, // GA in future
    };
    expect(isReleaseFrozen('rhoai-3.6', releaseDates)).toBe(false);
  });

  it('returns false when no dates are available (conservative)', () => {
    const releaseDates = {
      'rhoai-3.5': {},
    };
    expect(isReleaseFrozen('rhoai-3.5', releaseDates)).toBe(false);
  });

  it('returns false when release not in releaseDates map', () => {
    const releaseDates = {};
    expect(isReleaseFrozen('rhoai-3.5', releaseDates)).toBe(false);
  });

  it('uses normalized key lookup', () => {
    const releaseDates = {
      'rhoai 3 5': { planningFreezeDate: '2026-06-01' },
    };
    expect(isReleaseFrozen('RHOAI-3.5', releaseDates)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeIssue
// ---------------------------------------------------------------------------

describe('normalizeIssue', () => {
  const JIRA_BROWSE = 'https://redhat.atlassian.net/browse';

  function makeIssue(overrides = {}) {
    return {
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Test feature',
        status: { name: 'In Progress' },
        fixVersions: [{ name: 'rhoai-3.5' }],
        components: [{ name: 'Dashboard' }],
        assignee: { displayName: 'Jane Doe' },
        customfield_10855: [{ name: 'rhoai-3.5' }], // Target Version
        customfield_10712: { value: 'Green' }, // Color Status
        customfield_10469: { displayName: 'John PM' }, // Product Manager
        ...overrides,
      },
    };
  }

  it('extracts key, url, and summary', () => {
    const result = normalizeIssue(makeIssue());
    expect(result.key).toBe('RHAISTRAT-100');
    expect(result.url).toBe(JIRA_BROWSE + '/RHAISTRAT-100');
    expect(result.summary).toBe('Test feature');
  });

  it('truncates long summaries to 120 chars', () => {
    const result = normalizeIssue(makeIssue({ summary: 'A'.repeat(200) }));
    expect(result.summary.length).toBe(120);
  });

  it('extracts target version from array of objects', () => {
    const result = normalizeIssue(makeIssue());
    expect(result.target_version).toBe('rhoai-3.5');
    expect(result.tv_set.has('rhoai 3 5')).toBe(true);
  });

  it('extracts target version from string', () => {
    const result = normalizeIssue(makeIssue({ customfield_10855: 'rhoai-3.5' }));
    expect(result.target_version).toBe('rhoai-3.5');
  });

  it('extracts target version from object with value', () => {
    const result = normalizeIssue(makeIssue({ customfield_10855: { value: 'rhoai-3.5' } }));
    expect(result.target_version).toBe('rhoai-3.5');
  });

  it('extracts fix versions', () => {
    const result = normalizeIssue(makeIssue());
    expect(result.fix_versions).toBe('rhoai-3.5');
    expect(result.fv_set.has('rhoai 3 5')).toBe(true);
  });

  it('extracts components', () => {
    const result = normalizeIssue(makeIssue());
    expect(result.components).toEqual(['Dashboard']);
    expect(result.component).toBe('Dashboard');
  });

  it('handles missing fields gracefully', () => {
    const result = normalizeIssue({ key: 'X-1', fields: {} });
    expect(result.target_version).toBe('');
    expect(result.fix_versions).toBe('');
    expect(result.status).toBe('');
    expect(result.assignee).toBe('');
    expect(result.color_status).toBe('');
    expect(result.product_manager).toBe('');
    expect(result.components).toEqual([]);
  });

  it('handles color status as string', () => {
    const result = normalizeIssue(makeIssue({ customfield_10712: 'Red' }));
    expect(result.color_status).toBe('Red');
  });

  it('handles product manager as string', () => {
    const result = normalizeIssue(makeIssue({ customfield_10469: 'Jane PM' }));
    expect(result.product_manager).toBe('Jane PM');
  });
});

// ---------------------------------------------------------------------------
// classifyFeatures — ALL spec examples
// ---------------------------------------------------------------------------

describe('classifyFeatures', () => {
  function makeFeat(tv, fv) {
    return {
      key: 'X-1',
      url: '',
      summary: 'test',
      status: '',
      target_version: tv,
      fix_versions: fv,
      tv_set: parseVersions(tv),
      fv_set: parseVersions(fv),
      color_status: '',
      product_manager: '',
      assignee: '',
      components: [],
      component: '',
    };
  }

  // Example A: TV=rhoai-3.5, FV=rhoai-3.5 → aligned_on_time
  it('Example A: TV==FV → aligned_on_time', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Example B: TV=rhoai-3.6, FV=rhoai-3.5 → aligned_on_time (ahead)
  it('Example B: FV before TV → aligned_on_time', () => {
    const feats = [makeFeat('rhoai-3.6', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.6'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Example B2: TV=[rhoai-3.6, rhoai-3.7], FV=rhoai-3.5 → aligned_on_time (ahead of all)
  it('Example B2: FV before all TVs → aligned_on_time', () => {
    const feats = [makeFeat('rhoai-3.6, rhoai-3.7', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.6'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Example C: TV=rhoai-3.5, FV=rhoai-3.6, 3.5 frozen → aligned_late
  it('Example C: FV after frozen TV → aligned_late', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.6')];
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: '2026-06-01' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  // Example D: TV=rhoai-3.5, FV=rhoai-3.6, 3.5 NOT frozen → misaligned
  it('Example D: FV after unfrozen TV → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.6')];
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: '2026-09-01' }, // future
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Example E: TV=[rhoai-3.5, rhoai-3.6], FV=rhoai-3.6 → aligned_on_time (FV matches TV)
  it('Example E: FV matches one of multiple TVs → aligned_on_time', () => {
    const feats = [makeFeat('rhoai-3.5, rhoai-3.6', 'rhoai-3.6')];
    const result = classifyFeatures(feats, ['rhoai-3.6'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Example F: TV=[rhoai-3.5, rhoai-3.6], FV=rhoai-3.7, 3.5 frozen, 3.6 NOT frozen → misaligned
  it('Example F: FV after mixed freeze state TVs, any unfrozen → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5, rhoai-3.6', 'rhoai-3.7')];
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: '2026-06-01' },
      'rhoai-3.6': { planningFreezeDate: '2026-09-01' }, // future
    };
    // Classify against rhoai-3.5 (a TV that the feature targets)
    const result2 = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result2).toHaveLength(1);
    expect(result2[0].category).toBe('misaligned'); // 3.5 frozen but FV after 3.6 which isn't
  });

  // Example G: TV=[rhoai-3.5, rhoai-3.6], FV=rhoai-3.7, both frozen → aligned_late
  it('Example G: FV after all frozen TVs → aligned_late', () => {
    const feats = [makeFeat('rhoai-3.5, rhoai-3.6', 'rhoai-3.7')];
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: '2026-06-01' },
      'rhoai-3.6': { planningFreezeDate: '2026-06-15' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  // Example H: TV=rhoai-3.5, FV=rhelai-3.2 → misaligned (cross-product)
  it('Example H: Cross-product TV/FV → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhelai-3.2')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Example I: TV=rhoai-3.5, FV=rhoai-3.5.1 → test z-stream behavior
  it('Example I: Z-stream FV (unparseable) → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.5.1')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    // rhoai-3.5.1 won't parse, so it won't match normalized version
    // This means FV is set but doesn't match → compare temporally
    // But since 3.5.1 doesn't parse, it won't be in the comparison
    // The feat will have fv_set with normalized value from normVer
    // Let me check what normVer does with z-stream
    // Actually, the issue is that the FV won't match the release, so it will be treated as misaligned
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Example J: TV=rhoai-3.5, FV=rhoai-3.6, no dates → misaligned (conservative)
  it('Example J: FV after TV, no dates → misaligned (conservative)', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.6')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Example K: TV=rhoai-3.5, FV=rhoai-3.6, no freeze but GA past → aligned_late
  it('Example K: FV after TV, no freeze but GA in past → aligned_late', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.6')];
    const releaseDates = {
      'rhoai-3.5': { dueDate: '2026-06-01' }, // GA in past
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  // Example L: TV=[rhoai-3.5, rhelai-3.2], FV=rhoai-3.6
  it('Example L: Cross-product multi-TV, compare FV only against same product', () => {
    const feats = [makeFeat('rhoai-3.5, rhelai-3.2', 'rhoai-3.6')];
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: '2026-06-01' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late'); // rhoai-3.5 frozen
  });

  // Example M: TV=rhelai-3.2, FV=rhoai-3.6 → misaligned (all TVs different product)
  it('Example M: All TVs different product from FV → misaligned', () => {
    const feats = [makeFeat('rhelai-3.2', 'rhoai-3.6')];
    const result = classifyFeatures(feats, ['rhoai-3.6'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // TV-only
  it('TV-only: TV set, no FV → tv_only', () => {
    const feats = [makeFeat('rhoai-3.5', '')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('tv_only');
  });

  // FV-only
  it('FV-only: no TV, FV set → fv_only', () => {
    const feats = [makeFeat('', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('fv_only');
  });

  // Neither TV nor FV match release
  it('Neither TV nor FV match release → skipped (not in output)', () => {
    const feats = [makeFeat('rhoai-3.4', 'rhoai-3.4')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(0);
  });

  it('creates one classification per release match', () => {
    const feats = [makeFeat('rhoai-3.5, rhoai-3.5.EA1', 'rhoai-3.5, rhoai-3.5.EA1')];
    const result = classifyFeatures(feats, ['rhoai-3.5', 'rhoai-3.5.EA1'], {});
    expect(result).toHaveLength(2);
    expect(result.every(r => r.category === 'aligned_on_time')).toBe(true);
  });

  it('handles case-insensitive matching via normVer', () => {
    const feats = [makeFeat('RHOAI-3.5', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // ── Additional edge cases ──

  // Z-stream FV against GA TV — z-stream is unparseable → misaligned
  it('z-stream FV rhoai-3.5.1 against GA TV rhoai-3.5 → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.5.1')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Z-stream TV against GA FV — z-stream TV is unparseable → misaligned
  it('z-stream TV rhoai-3.5.1 against GA FV rhoai-3.5 → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5.1', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Unparseable FV (random string) → misaligned
  it('completely unparseable FV → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5', 'some-random-version')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Unparseable TV with valid FV match → misaligned
  it('unparseable TV with valid FV → misaligned', () => {
    const feats = [makeFeat('some-random-version', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // EA milestone: TV=EA1, FV=EA2 (same release family) → FV after TV
  it('EA1 TV, EA2 FV same family, EA1 not frozen → misaligned', () => {
    const feats = [makeFeat('rhoai-3.6.EA1', 'rhoai-3.6.EA2')];
    const result = classifyFeatures(feats, ['rhoai-3.6.EA1'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  it('EA1 TV, EA2 FV same family, EA1 frozen → aligned_late', () => {
    const feats = [makeFeat('rhoai-3.6.EA1', 'rhoai-3.6.EA2')];
    const releaseDates = {
      'rhoai-3.6.EA1': { planningFreezeDate: '2026-06-01' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.6.EA1'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  // EA to GA: TV=EA1, FV=GA (same product/version) → FV after EA1
  it('EA1 TV, GA FV (same minor version), EA1 not frozen → misaligned', () => {
    const feats = [makeFeat('rhoai-3.6.EA1', 'rhoai-3.6')];
    const result = classifyFeatures(feats, ['rhoai-3.6.EA1'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  it('EA1 TV, GA FV (same minor version), EA1 frozen → aligned_late', () => {
    const feats = [makeFeat('rhoai-3.6.EA1', 'rhoai-3.6')];
    const releaseDates = {
      'rhoai-3.6.EA1': { planningFreezeDate: '2026-06-01' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.6.EA1'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  // GA to EA: TV=GA, FV=EA1 (same product/version) → FV before TV (ahead)
  it('GA TV, EA1 FV (same minor version) → aligned_on_time (ahead)', () => {
    const feats = [makeFeat('rhoai-3.6', 'rhoai-3.6.EA1')];
    const result = classifyFeatures(feats, ['rhoai-3.6'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Multiple FVs: one matches TV, should be aligned
  it('multiple FVs where one matches TV → aligned_on_time', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.5, rhoai-3.6')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // All three products
  it('rhaii product parses and classifies correctly', () => {
    const feats = [makeFeat('rhaii-3.5', 'rhaii-3.5')];
    const result = classifyFeatures(feats, ['rhaii-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  it('rhelai product parses and classifies correctly', () => {
    const feats = [makeFeat('rhelai-3.2', 'rhelai-3.2')];
    const result = classifyFeatures(feats, ['rhelai-3.2'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Cross-product: TV=rhoai, FV=rhaii → misaligned
  it('cross-product rhoai TV / rhaii FV → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhaii-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Cross-product multi-TV: only same-product TVs compared (spec rule 4)
  it('cross-product multi-TV: ignores cross-product TVs, checks same-product TV freeze', () => {
    // TV=[rhoai-3.5, rhelai-3.2], FV=rhoai-3.6
    // Only compare against rhoai-3.5 (same product as FV)
    // rhoai-3.5 NOT frozen → misaligned
    const feats = [makeFeat('rhoai-3.5, rhelai-3.2', 'rhoai-3.6')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Planning freeze boundary: freeze date = today (edge)
  it('planning freeze exactly today → frozen (boundary)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.6')];
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: today },
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  // GA date fallback with future GA → not frozen (conservative)
  it('no planning freeze, GA in future → not frozen → misaligned', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.6')];
    const releaseDates = {
      'rhoai-3.5': { dueDate: '2027-06-01' }, // far future
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Both planning freeze and GA: planning freeze takes precedence
  it('planning freeze in past overrides GA in future', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.6')];
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: '2026-06-01', dueDate: '2027-12-01' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  // Major version difference: TV=rhoai-2.5, FV=rhoai-3.5
  it('FV with higher major version than TV → FV after TV', () => {
    const feats = [makeFeat('rhoai-2.5', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-2.5'], {});
    expect(result).toHaveLength(1);
    // No freeze dates → misaligned (conservative)
    expect(result[0].category).toBe('misaligned');
  });

  it('FV with lower major version than TV → FV before TV (ahead)', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-2.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Feature with multiple TVs all frozen and FV after all → aligned_late
  it('three TVs all frozen, FV after all → aligned_late', () => {
    const feats = [makeFeat('rhoai-3.4, rhoai-3.5, rhoai-3.6', 'rhoai-3.7')];
    const releaseDates = {
      'rhoai-3.4': { planningFreezeDate: '2026-01-01' },
      'rhoai-3.5': { planningFreezeDate: '2026-03-01' },
      'rhoai-3.6': { planningFreezeDate: '2026-06-01' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  // Feature with multiple TVs, one not frozen → misaligned
  it('three TVs, last one not frozen → misaligned', () => {
    const feats = [makeFeat('rhoai-3.4, rhoai-3.5, rhoai-3.6', 'rhoai-3.7')];
    const releaseDates = {
      'rhoai-3.4': { planningFreezeDate: '2026-01-01' },
      'rhoai-3.5': { planningFreezeDate: '2026-03-01' },
      'rhoai-3.6': { planningFreezeDate: '2026-12-01' }, // future
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  // Feature with TV matching FV (exact match via normVer despite case diff)
  it('case-insensitive TV/FV match → aligned_on_time', () => {
    const feats = [makeFeat('RHOAI_3_5', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Feature with RHAISTRAT-style version names
  it('RHAISTRAT version naming (3.5 GA RHOAI RELEASE) → aligns via normVer', () => {
    const feats = [makeFeat('3.5 GA RHOAI RELEASE', '3.5 GA RHOAI RELEASE')];
    const result = classifyFeatures(feats, ['3.5 GA RHOAI RELEASE'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  // Feature with TV and FV both empty → skipped
  it('both TV and FV empty → not classified', () => {
    const feats = [makeFeat('', '')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(0);
  });

  // Deduplication: same feature key, different releases
  it('same feature appears under two releases with correct categories', () => {
    const feats = [makeFeat('rhoai-3.5, rhoai-3.6', 'rhoai-3.6')];
    const result = classifyFeatures(feats, ['rhoai-3.5', 'rhoai-3.6'], {});
    expect(result).toHaveLength(2);
    const on35 = result.find(r => r.release === 'rhoai-3.5');
    const on36 = result.find(r => r.release === 'rhoai-3.6');
    // On 3.5: TV matches, FV doesn't → FV=3.6 matches TV=3.6 → aligned_on_time (FV matches one of the TVs)
    // Actually: TV has 3.5 and 3.6, FV has 3.6. For release 3.5: tvMatch=true, fvMatch=false.
    // Compare FV=3.6 against all TVs=[3.5, 3.6]. FV matches TV=3.6 → but we're in the temporal
    // branch because fvMatch is false for this release. FV=3.6 is after TV=3.5, 3.5 not frozen → misaligned
    // BUT FV=3.6 matches TV=3.6 (cmp=0) → no action (cmp not < 0 and not > 0)
    // The worst from the loop is the unfrozen check on 3.5
    expect(on35.category).toBe('misaligned');
    // On 3.6: tvMatch=true, fvMatch=true → aligned_on_time
    expect(on36.category).toBe('aligned_on_time');
  });
});

// ---------------------------------------------------------------------------
// classifyFeatures — Case 3 (FV matches, TV doesn't) edge cases
// ---------------------------------------------------------------------------

describe('classifyFeatures — Case 3 edge cases', () => {
  function makeFeat(tv, fv) {
    return {
      key: 'X-1',
      url: '',
      summary: 'test',
      status: '',
      target_version: tv,
      fix_versions: fv,
      tv_set: parseVersions(tv),
      fv_set: parseVersions(fv),
      color_status: '',
      product_manager: '',
      assignee: '',
      components: [],
      component: '',
    };
  }

  it('FV matches release, TV is earlier → FV slipped (no freeze = misaligned)', () => {
    // TV=3.4, FV=3.5 → feature targeted for 3.4 but committed to 3.5 (slipped)
    const feats = [makeFeat('rhoai-3.4', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned'); // no freeze dates → conservative
  });

  it('FV matches release, TV is earlier, TV frozen → aligned_late', () => {
    const feats = [makeFeat('rhoai-3.4', 'rhoai-3.5')];
    const releaseDates = {
      'rhoai-3.4': { planningFreezeDate: '2026-01-01' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.5'], releaseDates);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_late');
  });

  it('FV matches release, TV is later → FV ahead of schedule → aligned_on_time', () => {
    // TV=3.6, FV=3.5 → feature targeted for 3.6 but committed to 3.5 (ahead!)
    const feats = [makeFeat('rhoai-3.6', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  it('FV matches release, TV is from different product → misaligned', () => {
    const feats = [makeFeat('rhelai-3.2', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });

  it('FV matches release, multiple TVs, all same product ahead → aligned_on_time', () => {
    const feats = [makeFeat('rhoai-3.6, rhoai-3.7', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned_on_time');
  });

  it('FV matches release, unparseable TV → misaligned', () => {
    const feats = [makeFeat('some-random-thing', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('misaligned');
  });
});

// ---------------------------------------------------------------------------
// buildExport
// ---------------------------------------------------------------------------

describe('buildExport', () => {
  it('produces executive_summary with 5-category structure', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'aligned_late', key: 'X-2', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'tv_only', key: 'X-3', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');

    expect(result.metadata.releases).toEqual(['rhoai-3.5']);
    expect(result.metadata.total_features).toBe(3);
    expect(result.executive_summary).toHaveLength(1);

    const summary = result.executive_summary[0];
    expect(summary.release).toBe('rhoai-3.5');
    expect(summary.total).toBe(3);
    expect(summary.aligned_on_time).toBe(1);
    expect(summary.aligned_late).toBe(1);
    expect(summary.tv_only).toBe(1);
    expect(summary.fv_only).toBe(0);
    expect(summary.misaligned).toBe(0);
  });

  it('computes alignment_pct as (on_time + late) / total', () => {
    const classifications = [
      { release: 'v1', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'v1', category: 'aligned_late', key: 'X-2', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'v1', category: 'tv_only', key: 'X-3', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'v1', category: 'misaligned', key: 'X-4', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['v1'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    expect(result.executive_summary[0].alignment_pct).toBe(50); // (1+1)/4 = 50%
  });

  it('sets JQL to null for aligned_late and misaligned', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_late', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'misaligned', key: 'X-2', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const summary = result.executive_summary[0];
    expect(summary.aligned_late_jql).toBeNull();
    expect(summary.misaligned_jql).toBeNull();
  });

  it('generates JQL for aligned_on_time, tv_only, fv_only', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'tv_only', key: 'X-2', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'fv_only', key: 'X-3', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const summary = result.executive_summary[0];
    expect(summary.aligned_on_time_jql).toBeTruthy();
    expect(summary.tv_only_jql).toBeTruthy();
    expect(summary.fv_only_jql).toBeTruthy();
    expect(summary.total_jql).toBeTruthy();
  });

  it('includes resolution filter in base JQL', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const jql = decodeURIComponent(result.executive_summary[0].total_jql);
    expect(jql).toContain('resolution = Unresolved OR resolution IN ("Done", "Done-Errata")');
  });

  it('component breakdown has 5 categories', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'aligned_late', key: 'X-2', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'tv_only', key: 'X-3', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'fv_only', key: 'X-4', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'misaligned', key: 'X-5', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', ['Dashboard'], 'RHAISTRAT');
    const comp = result.component_breakdown.find(c => c.component === 'Dashboard');
    expect(comp.aligned_on_time).toBe(1);
    expect(comp.aligned_late).toBe(1);
    expect(comp.tv_only).toBe(1);
    expect(comp.fv_only).toBe(1);
    expect(comp.misaligned).toBe(1);
    expect(comp.total).toBe(5);
  });

  it('CATEGORY_PRIORITY uses correct ordering for dedup', () => {
    // When a feature appears in multiple releases, worst category wins
    // misaligned > tv_only > fv_only > aligned_late > aligned_on_time
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.6', category: 'misaligned', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5', 'rhoai-3.6'], '2026-01-01T00:00:00Z', ['Dashboard'], 'RHAISTRAT');
    const comp = result.component_breakdown.find(c => c.component === 'Dashboard');
    // Worst is misaligned (priority 4), so that should win
    expect(comp.misaligned).toBe(1);
    expect(comp.aligned_on_time).toBe(0);
    expect(comp.total).toBe(1); // deduped
  });

  it('includes ga_date and planning_freeze from releaseDates', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const releaseDates = {
      'rhoai-3.5': { dueDate: '2026-08-20', planningFreezeDate: '2026-06-24' },
    };
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT', releaseDates);
    const summary = result.executive_summary[0];
    expect(summary.ga_date).toBe('2026-08-20');
    expect(summary.planning_freeze).toBe('2026-06-24');
  });

  it('sets ga_date and planning_freeze to null when releaseDates is not provided', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const summary = result.executive_summary[0];
    expect(summary.ga_date).toBeNull();
    expect(summary.planning_freeze).toBeNull();
  });

  it('falls back to normVer lookup when release key does not match directly', () => {
    const classifications = [
      { release: 'RHOAI-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const releaseDates = {
      'rhoai 3 5': { dueDate: '2026-08-20', planningFreezeDate: '2026-06-24' },
    };
    const result = buildExport(classifications, ['RHOAI-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT', releaseDates);
    const summary = result.executive_summary[0];
    expect(summary.ga_date).toBe('2026-08-20');
    expect(summary.planning_freeze).toBe('2026-06-24');
  });

  it('handles partial releaseDates (only ga_date, no planning_freeze)', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const releaseDates = {
      'rhoai-3.5': { dueDate: '2026-08-20' },
    };
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT', releaseDates);
    const summary = result.executive_summary[0];
    expect(summary.ga_date).toBe('2026-08-20');
    expect(summary.planning_freeze).toBeNull();
  });

  it('generates correct JQL links for tv_only (fixVersion is EMPTY, not OR)', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'tv_only', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const jql = decodeURIComponent(result.executive_summary[0].tv_only_jql);
    // Must NOT contain "OR fixVersion not in" — that was the bug
    expect(jql).not.toContain('OR fixVersion not in');
    expect(jql).toContain('fixVersion is EMPTY');
  });

  it('generates correct JQL links for fv_only (Target Version is EMPTY, not OR)', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'fv_only', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const jql = decodeURIComponent(result.executive_summary[0].fv_only_jql);
    expect(jql).not.toContain('OR "Target Version" not in');
    expect(jql).toContain('"Target Version" is EMPTY');
  });

  it('buckets features into per-release category lists', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned_on_time', key: 'X-1', url: '', summary: 's', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'misaligned', key: 'X-2', url: '', summary: 's', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    expect(result.releases['rhoai-3.5'].aligned_on_time).toHaveLength(1);
    expect(result.releases['rhoai-3.5'].misaligned).toHaveLength(1);
    expect(result.releases['rhoai-3.5'].tv_only).toHaveLength(0);
  });

  it('handles empty classifications gracefully', () => {
    const result = buildExport([], ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    expect(result.executive_summary[0].total).toBe(0);
    expect(result.executive_summary[0].alignment_pct).toBe(0);
    expect(result.releases['rhoai-3.5']).toBeDefined();
  });

  it('aligned_on_time_jql includes earlier same-product releases in fixVersion clause (Case 2: ahead of schedule)', () => {
    const releases = ['3.6 EA1 RHOAI RELEASE', '3.5 GA RHOAI RELEASE', '3.5 EA2 RHOAI RELEASE'];
    const classifications = [
      { release: '3.6 EA1 RHOAI RELEASE', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, releases, '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const jql = decodeURIComponent(result.executive_summary[0].aligned_on_time_jql);
    // Must include the earlier RHOAI releases as valid fix versions
    expect(jql).toContain('"3.5 GA RHOAI RELEASE"');
    expect(jql).toContain('"3.5 EA2 RHOAI RELEASE"');
    // Must still require TV = the target release
    expect(jql).toContain('"Target Version" in ("3.6 EA1 RHOAI RELEASE")');
  });

  it('aligned_on_time_jql includes later same-product releases in Target Version clause (Case 3: FV ahead)', () => {
    const releases = ['3.6 EA1 RHOAI RELEASE', '3.6 EA2 RHOAI RELEASE', '3.6 GA RHOAI RELEASE'];
    const classifications = [
      { release: '3.6 EA1 RHOAI RELEASE', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, releases, '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const jql = decodeURIComponent(result.executive_summary[0].aligned_on_time_jql);
    // Case 3 clause: FV = EA1, TV = later release
    expect(jql).toContain('fixVersion in ("3.6 EA1 RHOAI RELEASE")');
    expect(jql).toContain('"3.6 EA2 RHOAI RELEASE"');
    expect(jql).toContain('"3.6 GA RHOAI RELEASE"');
  });

  it('aligned_on_time_jql does not bleed cross-product releases into fixVersion or Target Version clauses', () => {
    const releases = ['3.6 EA1 RHOAI RELEASE', '3.6 EA1 RHAII RELEASE', '3.5 GA RHOAI RELEASE'];
    const classifications = [
      { release: '3.6 EA1 RHOAI RELEASE', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, releases, '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const jql = decodeURIComponent(result.executive_summary[0].aligned_on_time_jql);
    // RHAII release must not appear — different product
    expect(jql).not.toContain('RHAII');
    // Earlier RHOAI release must appear
    expect(jql).toContain('"3.5 GA RHOAI RELEASE"');
  });

  it('aligned_on_time_jql falls back to exact-match when release is unparseable (no earlier/later computed)', () => {
    const releases = ['unparseable-version', 'rhoai-3.5'];
    const classifications = [
      { release: 'unparseable-version', category: 'aligned_on_time', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, releases, '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const jql = decodeURIComponent(result.executive_summary[0].aligned_on_time_jql);
    // Just the release itself, no compound OR clause (compound uses ') OR (' pattern)
    expect(jql).toContain('"unparseable-version"');
    expect(jql).not.toContain(') OR (');
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_RELEASES
// ---------------------------------------------------------------------------

describe('DEFAULT_RELEASES', () => {
  it('contains the 18 product-family versions for 3.5 and 3.6', () => {
    expect(DEFAULT_RELEASES).toHaveLength(18);
    expect(DEFAULT_RELEASES).toContain('3.6 GA RHOAI RELEASE');
    expect(DEFAULT_RELEASES).toContain('3.6 EA1 RHAII RELEASE');
    expect(DEFAULT_RELEASES).toContain('3.5 EA2 RHELAI RELEASE');
    expect(DEFAULT_RELEASES[0]).toBe('3.6 GA RHOAI RELEASE');
    expect(DEFAULT_RELEASES[17]).toBe('3.5 EA1 RHELAI RELEASE');
  });
});

// ---------------------------------------------------------------------------
// jqlSafePattern — version name validation
// ---------------------------------------------------------------------------

describe('jqlSafePattern', () => {
  it('accepts standard rhoai version names', () => {
    expect(jqlSafePattern.test('rhoai-3.5')).toBe(true);
    expect(jqlSafePattern.test('rhoai-3.5.EA1')).toBe(true);
    expect(jqlSafePattern.test('rhoai-3.5.EA2')).toBe(true);
    expect(jqlSafePattern.test('rhelai-3.5')).toBe(true);
  });

  it('accepts version names with spaces (e.g. RHAII-3.5 EA1)', () => {
    expect(jqlSafePattern.test('RHAII-3.5 EA1')).toBe(true);
    expect(jqlSafePattern.test('RHAII-3.5 EA2')).toBe(true);
    expect(jqlSafePattern.test('Some Product 2.0')).toBe(true);
  });

  it('accepts underscores', () => {
    expect(jqlSafePattern.test('RHOAI_3_5')).toBe(true);
  });

  it('rejects JQL injection attempts', () => {
    expect(jqlSafePattern.test('rhoai-3.5" OR 1=1--')).toBe(false);
    expect(jqlSafePattern.test('rhoai-3.5; DROP TABLE')).toBe(false);
    expect(jqlSafePattern.test('rhoai-3.5\' OR')).toBe(false);
    expect(jqlSafePattern.test('rhoai-3.5)')).toBe(false);
    expect(jqlSafePattern.test('(rhoai-3.5')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(jqlSafePattern.test('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration-style tests
// ---------------------------------------------------------------------------

describe('Integration tests', () => {
  function makeFeat(key, tv, fv) {
    return {
      key: key,
      url: '',
      summary: 'test',
      status: '',
      target_version: tv,
      fix_versions: fv,
      tv_set: parseVersions(tv),
      fv_set: parseVersions(fv),
      color_status: '',
      product_manager: '',
      assignee: '',
      components: [],
      component: '',
    };
  }

  it('multiple features across multiple releases', () => {
    const feats = [
      makeFeat('X-1', 'rhoai-3.5', 'rhoai-3.5'),
      makeFeat('X-2', 'rhoai-3.5', 'rhoai-3.6'),
      makeFeat('X-3', 'rhoai-3.6', 'rhoai-3.6'),
    ];
    const releaseDates = {
      'rhoai-3.5': { planningFreezeDate: '2026-06-01' },
    };
    const result = classifyFeatures(feats, ['rhoai-3.5', 'rhoai-3.6'], releaseDates);
    // X-1: aligned_on_time on 3.5 (TV=FV=3.5)
    // X-2: aligned_late on 3.5 (TV=3.5 frozen, FV=3.6)
    // X-2: aligned_late on 3.6 (FV=3.6, TV=3.5 frozen → late)
    // X-3: aligned_on_time on 3.6 (TV=FV=3.6)
    expect(result).toHaveLength(4);
    const x1 = result.find(r => r.key === 'X-1');
    const x2_on35 = result.find(r => r.key === 'X-2' && r.release === 'rhoai-3.5');
    const x2_on36 = result.find(r => r.key === 'X-2' && r.release === 'rhoai-3.6');
    const x3 = result.find(r => r.key === 'X-3');
    expect(x1.category).toBe('aligned_on_time');
    expect(x2_on35.category).toBe('aligned_late');
    expect(x2_on36.category).toBe('aligned_late');
    expect(x3.category).toBe('aligned_on_time');
  });

  it('features appearing in multiple release rows', () => {
    const feats = [
      makeFeat('X-1', 'rhoai-3.5, rhoai-3.6', 'rhoai-3.5, rhoai-3.6'),
    ];
    const result = classifyFeatures(feats, ['rhoai-3.5', 'rhoai-3.6'], {});
    expect(result).toHaveLength(2); // one for 3.5, one for 3.6
    expect(result.every(r => r.category === 'aligned_on_time')).toBe(true);
  });

  it('empty feature set', () => {
    const result = classifyFeatures([], ['rhoai-3.5'], {});
    expect(result).toHaveLength(0);
  });

  it('all features aligned', () => {
    const feats = [
      makeFeat('X-1', 'rhoai-3.5', 'rhoai-3.5'),
      makeFeat('X-2', 'rhoai-3.5', 'rhoai-3.5'),
    ];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {});
    expect(result.every(r => r.category === 'aligned_on_time')).toBe(true);
  });

  it('all features misaligned', () => {
    const feats = [
      makeFeat('X-1', 'rhoai-3.5', 'rhoai-3.6'),
      makeFeat('X-2', 'rhoai-3.5', 'rhoai-3.7'),
    ];
    const result = classifyFeatures(feats, ['rhoai-3.5'], {}); // no freeze dates
    expect(result.every(r => r.category === 'misaligned')).toBe(true);
  });
});

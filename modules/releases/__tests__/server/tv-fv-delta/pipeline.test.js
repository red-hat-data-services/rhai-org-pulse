import { describe, it, expect } from 'vitest';

const {
  normVer,
  parseVersions,
  extractVersionNames,
  isZStream,
  normalizeIssue,
  classifyFeatures,
  buildExport,
  DEFAULT_RELEASES,
  jqlSafePattern,
} = require('../../../server/tv-fv-delta/routes');

// ---------------------------------------------------------------------------
// normVer
// ---------------------------------------------------------------------------

describe('normVer', () => {
  it('lowercases version strings', () => {
    expect(normVer('RHOAI-3.5')).toBe('rhoai-3.5');
  });

  it('normalises RHOAI_ prefix to rhoai- format', () => {
    expect(normVer('RHOAI_3_5')).toBe('rhoai-3.5');
  });

  it('strips .0 from RHOAI_ prefixed versions', () => {
    expect(normVer('RHOAI_3.0_5')).toBe('rhoai-3.5');
  });

  it('trims whitespace', () => {
    expect(normVer('  rhoai-3.5  ')).toBe('rhoai-3.5');
  });

  it('returns null for empty, null, undefined, or "null"/"undefined" strings', () => {
    expect(normVer(null)).toBeNull();
    expect(normVer(undefined)).toBeNull();
    expect(normVer('')).toBeNull();
    expect(normVer('null')).toBeNull();
    expect(normVer('undefined')).toBeNull();
  });

  it('leaves already-lowercase versions unchanged', () => {
    expect(normVer('rhoai-3.5.ea1')).toBe('rhoai-3.5.ea1');
  });

  it('does not strip .0 from double-digit major versions (RHOAI_10.0_5)', () => {
    expect(normVer('RHOAI_10.0_5')).toBe('rhoai-10.5');
  });

  it('handles lowercase rhoai_ prefix', () => {
    expect(normVer('rhoai_3_5')).toBe('rhoai-3.5');
  });

  it('handles mixed case rhoai_ prefix', () => {
    expect(normVer('Rhoai_3_5')).toBe('rhoai-3.5');
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
    expect(result.has('rhoai-3.5')).toBe(true);
    expect(result.has('rhoai-3.5.ea1')).toBe(true);
  });

  it('normalises each version', () => {
    const result = parseVersions('RHOAI_3_5');
    expect(result.has('rhoai-3.5')).toBe(true);
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
    expect(result.tv_set.has('rhoai-3.5')).toBe(true);
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
    expect(result.fv_set.has('rhoai-3.5')).toBe(true);
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
// classifyFeatures
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

  it('classifies aligned features (TV == FV)', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned');
  });

  it('classifies tv_only (TV set, no FV at all)', () => {
    const feats = [makeFeat('rhoai-3.5', '')];
    const result = classifyFeatures(feats, ['rhoai-3.5']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('tv_only');
  });

  it('classifies fv_only (FV set, no TV at all)', () => {
    const feats = [makeFeat('', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('fv_only');
  });

  it('classifies mismatched (TV set, FV set to different release)', () => {
    const feats = [makeFeat('rhoai-3.5', 'rhoai-3.5.EA1')];
    const result = classifyFeatures(feats, ['rhoai-3.5']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('mismatched');
  });

  it('classifies mismatched (FV set, TV set to different release)', () => {
    const feats = [makeFeat('rhoai-3.5.EA1', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('mismatched');
  });

  it('skips features with no match to any release', () => {
    const feats = [makeFeat('rhoai-3.4', 'rhoai-3.4')];
    const result = classifyFeatures(feats, ['rhoai-3.5']);
    expect(result).toHaveLength(0);
  });

  it('creates one classification per release match', () => {
    const feats = [makeFeat('rhoai-3.5, rhoai-3.5.EA1', 'rhoai-3.5, rhoai-3.5.EA1')];
    const result = classifyFeatures(feats, ['rhoai-3.5', 'rhoai-3.5.EA1']);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.category === 'aligned')).toBe(true);
  });

  it('handles case-insensitive matching via normVer', () => {
    const feats = [makeFeat('RHOAI-3.5', 'rhoai-3.5')];
    const result = classifyFeatures(feats, ['rhoai-3.5']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned');
  });
});

// ---------------------------------------------------------------------------
// buildExport
// ---------------------------------------------------------------------------

describe('buildExport', () => {
  it('produces executive_summary with correct structure', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'tv_only', key: 'X-2', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');

    expect(result.metadata.releases).toEqual(['rhoai-3.5']);
    expect(result.metadata.total_features).toBe(2);
    expect(result.executive_summary).toHaveLength(1);

    const summary = result.executive_summary[0];
    expect(summary.release).toBe('rhoai-3.5');
    expect(summary.total).toBe(2);
    expect(summary.aligned).toBe(1);
    expect(summary.tv_only).toBe(1);
    expect(summary.alignment_pct).toBe(50);
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
      { release: 'rhoai-3.5', category: 'aligned', key: 'X-1', url: '', summary: 's', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'mismatched', key: 'X-2', url: '', summary: 's', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    expect(result.releases['rhoai-3.5'].aligned).toHaveLength(1);
    expect(result.releases['rhoai-3.5'].mismatched).toHaveLength(1);
    expect(result.releases['rhoai-3.5'].tv_only).toHaveLength(0);
  });

  it('builds component breakdown from classifications', () => {
    const classifications = [
      { release: 'rhoai-3.5', category: 'aligned', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
      { release: 'rhoai-3.5', category: 'tv_only', key: 'X-2', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: ['Dashboard'], component: 'Dashboard', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['rhoai-3.5'], '2026-01-01T00:00:00Z', ['Dashboard', 'Notebooks'], 'RHAISTRAT');
    expect(result.component_breakdown).toHaveLength(2);

    const dash = result.component_breakdown.find(c => c.component === 'Dashboard');
    expect(dash.total).toBe(2);
    expect(dash.aligned).toBe(1);
    expect(dash.tv_only).toBe(1);

    const nb = result.component_breakdown.find(c => c.component === 'Notebooks');
    expect(nb.total).toBe(0);
  });

  it('computes alignment_pct correctly', () => {
    const classifications = [
      { release: 'v1', category: 'aligned', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'v1', category: 'aligned', key: 'X-2', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
      { release: 'v1', category: 'tv_only', key: 'X-3', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['v1'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    expect(result.executive_summary[0].alignment_pct).toBe(66.7);
  });

  it('handles empty classifications gracefully', () => {
    const result = buildExport([], ['rhoai-3.5'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    expect(result.executive_summary[0].total).toBe(0);
    expect(result.executive_summary[0].alignment_pct).toBe(0);
    expect(result.releases['rhoai-3.5']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_RELEASES
// ---------------------------------------------------------------------------

describe('DEFAULT_RELEASES', () => {
  it('contains EA1, EA2, and GA in that order', () => {
    expect(DEFAULT_RELEASES).toEqual(['rhoai-3.5.EA1', 'rhoai-3.5.EA2', 'rhoai-3.5']);
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
// RHAII version handling (space-separated milestone names)
// ---------------------------------------------------------------------------

describe('RHAII version handling', () => {
  it('normVer lowercases RHAII versions with spaces', () => {
    expect(normVer('RHAII-3.5 EA1')).toBe('rhaii-3.5 ea1');
    expect(normVer('RHAII-3.5 EA2')).toBe('rhaii-3.5 ea2');
  });

  it('parseVersions handles RHAII versions', () => {
    const result = parseVersions('RHAII-3.5 EA1');
    expect(result.size).toBe(1);
    expect(result.has('rhaii-3.5 ea1')).toBe(true);
  });

  it('classifyFeatures matches RHAII releases correctly', () => {
    const feat = {
      key: 'RHAISTRAT-200',
      url: '',
      summary: 'RHAII feature',
      status: 'In Progress',
      target_version: 'RHAII-3.5 EA1',
      fix_versions: 'RHAII-3.5 EA1',
      tv_set: parseVersions('RHAII-3.5 EA1'),
      fv_set: parseVersions('RHAII-3.5 EA1'),
      color_status: '',
      product_manager: '',
      assignee: '',
      components: [],
      component: '',
    };
    const result = classifyFeatures([feat], ['RHAII-3.5 EA1']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('aligned');
  });

  it('classifyFeatures detects tv_only for RHAII releases', () => {
    const feat = {
      key: 'RHAISTRAT-201',
      url: '',
      summary: 'RHAII feature no FV',
      status: 'New',
      target_version: 'RHAII-3.5 EA1',
      fix_versions: '',
      tv_set: parseVersions('RHAII-3.5 EA1'),
      fv_set: parseVersions(''),
      color_status: '',
      product_manager: '',
      assignee: '',
      components: [],
      component: '',
    };
    const result = classifyFeatures([feat], ['RHAII-3.5 EA1']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('tv_only');
  });

  it('buildExport generates valid JQL links for RHAII releases with spaces', () => {
    const classifications = [
      { release: 'RHAII-3.5 EA1', category: 'aligned', key: 'X-1', url: '', summary: '', status: '', color_status: '', product_manager: '', assignee: '', team: '', components: [], component: '', target_version: '', fix_versions: '' },
    ];
    const result = buildExport(classifications, ['RHAII-3.5 EA1'], '2026-01-01T00:00:00Z', [], 'RHAISTRAT');
    const summary = result.executive_summary[0];
    expect(summary.release).toBe('RHAII-3.5 EA1');
    expect(summary.total).toBe(1);
    // JQL links should contain the quoted release name
    const totalJql = decodeURIComponent(summary.total_jql);
    expect(totalJql).toContain('"RHAII-3.5 EA1"');
  });
});

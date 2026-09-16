import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../shared/server/google-sheets', () => ({
  createGoogleSheetsClient: vi.fn(),
}));

import {
  parseArrayField,
  mapRow,
  ENTRY_COLUMN_MAP,
  PILLAR_COLUMN_MAP,
  PIPE_DELIMITED_FIELDS,
  getPillarColor,
  normalizePillar,
  mergePillarMetadata,
  normalizeShowcaseData,
} from '../../server/showcase/sheets-sync.js';

describe('parseArrayField', () => {
  it('splits pipe-delimited values', () => {
    expect(parseArrayField('agents|kubernetes|orchestration')).toEqual([
      'agents', 'kubernetes', 'orchestration',
    ]);
  });

  it('trims whitespace', () => {
    expect(parseArrayField(' agents | kubernetes ')).toEqual(['agents', 'kubernetes']);
  });

  it('returns empty array for empty string', () => {
    expect(parseArrayField('')).toEqual([]);
  });

  it('returns empty array for null/undefined', () => {
    expect(parseArrayField(null)).toEqual([]);
    expect(parseArrayField(undefined)).toEqual([]);
  });

  it('filters out empty segments', () => {
    expect(parseArrayField('a||b|')).toEqual(['a', 'b']);
  });
});

describe('mapRow', () => {
  it('maps entry columns from snake_case headers to camelCase keys', () => {
    const headers = ['slug', 'title', 'short_summary', 'sort_order', 'capability_tags'];
    const row = ['test-slug', 'Test Title', 'A summary', '5', 'agents|kubernetes'];
    const result = mapRow(headers, row, ENTRY_COLUMN_MAP);

    expect(result.slug).toBe('test-slug');
    expect(result.title).toBe('Test Title');
    expect(result.shortSummary).toBe('A summary');
    expect(result.sortOrder).toBe(5);
    expect(result.capabilityTags).toEqual(['agents', 'kubernetes']);
  });

  it('maps pillar columns', () => {
    const headers = ['pillar_key', 'title', 'short_title', 'summary', 'sort_order', 'visual_url', 'color'];
    const row = ['agentic-ai', 'Agentic AI', 'Agentic', 'Agent things', '3', 'https://example.com/img.png', '#22c55e'];
    const result = mapRow(headers, row, PILLAR_COLUMN_MAP);

    expect(result.pillarKey).toBe('agentic-ai');
    expect(result.title).toBe('Agentic AI');
    expect(result.shortTitle).toBe('Agentic');
    expect(result.sortOrder).toBe(3);
    expect(result.visualUrl).toBe('https://example.com/img.png');
    expect(result.color).toBe('#22c55e');
  });

  it('handles missing columns with empty defaults', () => {
    const headers = ['slug', 'title'];
    const row = ['test'];
    const result = mapRow(headers, row, ENTRY_COLUMN_MAP);

    expect(result.slug).toBe('test');
    expect(result.title).toBe('');
  });

  it('ignores unknown headers', () => {
    const headers = ['slug', 'unknown_column', 'title'];
    const row = ['test', 'ignored', 'Test Title'];
    const result = mapRow(headers, row, ENTRY_COLUMN_MAP);

    expect(result.slug).toBe('test');
    expect(result.title).toBe('Test Title');
    expect(result.unknown_column).toBeUndefined();
  });

  it('defaults sortOrder to 999 for non-numeric values', () => {
    const headers = ['slug', 'sort_order'];
    const row = ['test', 'not-a-number'];
    const result = mapRow(headers, row, ENTRY_COLUMN_MAP);

    expect(result.sortOrder).toBe(999);
  });

  it('handles numeric cell values', () => {
    const headers = ['slug', 'sort_order'];
    const row = ['test', 3];
    const result = mapRow(headers, row, ENTRY_COLUMN_MAP);

    expect(result.sortOrder).toBe(3);
  });
});

describe('constants', () => {
  it('ENTRY_COLUMN_MAP covers expected fields', () => {
    expect(ENTRY_COLUMN_MAP.slug).toBe('slug');
    expect(ENTRY_COLUMN_MAP.strategy_pillar_key).toBe('strategyPillarKey');
    expect(ENTRY_COLUMN_MAP.customer_need_tags).toBe('customerNeedTags');
  });

  it('PIPE_DELIMITED_FIELDS includes tag fields', () => {
    expect(PIPE_DELIMITED_FIELDS.has('capabilityTags')).toBe(true);
    expect(PIPE_DELIMITED_FIELDS.has('customerNeedTags')).toBe(true);
    expect(PIPE_DELIMITED_FIELDS.has('githubUrl')).toBe(true);
  });
});

describe('pillar metadata', () => {
  it('fills optional display metadata while preserving explicit values', () => {
    expect(normalizePillar({ pillarKey: 'data-science-engineering' })).toMatchObject({
      pillarKey: 'data-science-engineering',
      title: 'Data Science Engineering',
      shortTitle: 'Data Science Engineering',
      color: '#06b6d4',
    });

    expect(normalizePillar({
      pillarKey: 'custom-pillar',
      title: 'Custom Pillar',
      shortTitle: 'Custom',
      color: '#ABCDEF',
    })).toMatchObject({
      title: 'Custom Pillar',
      shortTitle: 'Custom',
      color: '#abcdef',
    });
  });

  it('uses a deterministic fallback color for unknown keys', () => {
    expect(getPillarColor('new-pillar')).toBe(getPillarColor('new-pillar'));
    expect(getPillarColor('new-pillar')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('uses the unsigned hash index shared with the client fallback', () => {
    // new-pillar hashes to a negative signed 32-bit value. The unsigned
    // conversion selects the second palette colour, not Math.abs(hash).
    expect(getPillarColor('new-pillar')).toBe('#a855f7');
  });

  it('merges referenced keys missing from sheet metadata', () => {
    const result = mergePillarMetadata(
      [{ pillarKey: 'model-inference', title: 'Model Inference', sortOrder: 1 }],
      ['model-inference', 'data-science-engineering'],
    );

    expect(result.map(p => p.pillarKey)).toEqual(['model-inference', 'data-science-engineering']);
    expect(result[1]).toMatchObject({
      title: 'Data Science Engineering',
      shortTitle: 'Data Science Engineering',
      color: '#06b6d4',
    });
  });

  it('adds metadata for showcase entries whose pillar row is not refreshed yet', () => {
    const result = normalizeShowcaseData({
      entries: [{ slug: 'new', strategyPillarKey: 'future-pillar' }],
      pillars: [],
    });

    expect(result.pillars).toHaveLength(1);
    expect(result.pillars[0].pillarKey).toBe('future-pillar');
  });
});

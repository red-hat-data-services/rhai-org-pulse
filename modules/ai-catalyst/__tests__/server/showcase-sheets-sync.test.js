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
    const headers = ['pillar_key', 'title', 'summary', 'sort_order', 'visual_url'];
    const row = ['agentic-ai', 'Agentic AI', 'Agent things', '3', 'https://example.com/img.png'];
    const result = mapRow(headers, row, PILLAR_COLUMN_MAP);

    expect(result.pillarKey).toBe('agentic-ai');
    expect(result.title).toBe('Agentic AI');
    expect(result.sortOrder).toBe(3);
    expect(result.visualUrl).toBe('https://example.com/img.png');
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

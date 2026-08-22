import { describe, it, expect } from 'vitest';
import { validateSnapshot } from '../../server/decomposer/validation.js';

function makeValid() {
  return {
    schema_version: '1.0',
    generated_at: '2026-07-24T00:00:00Z',
    runs: [{ run_id: 'r1', started: '2026-07-01T00:00:00Z' }],
    strategies: { 'RHAISTRAT-1': { strat_id: 'RHAISTRAT-1' } },
    aggregates: { unique_strategies: 1 }
  };
}

describe('validateSnapshot', () => {
  it('accepts a well-formed data.json', () => {
    const r = validateSnapshot(makeValid());
    expect(r.valid).toBe(true);
    expect(r.data).toBeDefined();
  });

  it('tolerates extra dashboard-only fields', () => {
    const doc = { ...makeValid(), epic_bodies: { E1: 'md' }, signal_names: ['x'] };
    expect(validateSnapshot(doc).valid).toBe(true);
  });

  it('rejects a non-object body', () => {
    expect(validateSnapshot(null).valid).toBe(false);
    expect(validateSnapshot([]).valid).toBe(false);
    expect(validateSnapshot('nope').valid).toBe(false);
  });

  it('rejects when runs is not an array', () => {
    const doc = { ...makeValid(), runs: {} };
    const r = validateSnapshot(doc);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('runs');
  });

  it('rejects when strategies is not an object map', () => {
    const doc = { ...makeValid(), strategies: [] };
    const r = validateSnapshot(doc);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('strategies');
  });

  it('rejects when aggregates is missing', () => {
    const doc = { ...makeValid() };
    delete doc.aggregates;
    const r = validateSnapshot(doc);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('aggregates');
  });

  it('rejects an invalid generated_at', () => {
    const doc = { ...makeValid(), generated_at: 'not-a-date' };
    const r = validateSnapshot(doc);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('generated_at');
  });

  it('allows a missing generated_at', () => {
    const doc = { ...makeValid() };
    delete doc.generated_at;
    expect(validateSnapshot(doc).valid).toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  projectSnapshot,
  readDecomposer,
  emptySnapshot,
  slimRun,
  slimStrategy
} from '../../server/decomposer/storage.js';

function makeDoc() {
  return {
    schema_version: '1.0',
    generated_at: '2026-07-24T00:00:00Z',
    source: { data_dir: '/x', pipeline_id: '', commit_sha: '' },
    signal_names: ['change_specificity'],
    investigation_signal_names: ['question_specificity'],
    counts: { runs: 1, strategies: 1 },
    runs: [
      {
        run_id: '2026-07-22T18-49-17Z',
        started: '2026-07-22T18:49:17Z',
        completed: '2026-07-22T19:00:00Z',
        duration_minutes: 10.7,
        batch_size: 50,
        total: 2,
        passed: 2,
        failed: 0,
        errors: 0,
        avg_score: 14,
        score_max: 14,
        submitted_epics: 9,
        results: [{ strat_id: 'RHAISTRAT-1', status: 'passed', epic_count: 4, score: 14 }]
      }
    ],
    strategies: {
      'RHAISTRAT-1': {
        strat_id: 'RHAISTRAT-1',
        title: 'Test Strategy',
        priority: 'Major',
        labels: ['epic-decomposer-auto-created'],
        epic_count: 2,
        critical_path_length: 3,
        revised: true,
        mermaid_dag: 'graph TD\n  E001 --> E002',
        review: { score: 14, pass: true, recommendation: 'accept', issues: [], error: null },
        epics: [
          {
            epic_id: 'RHAISTRAT-1-E001',
            title: 'Epic one',
            type: 'Implementation',
            implementation_type: 'standard',
            priority: 'P0',
            component: 'MLflow',
            team: 'Team A',
            dependencies: [],
            ai_implementability: 'High',
            ai_implementability_score: 2,
            ai_signals: { change_specificity: 1 },
            investigation_signals: {},
            jira_key: 'RHAI-137',
            branch: null
          }
        ],
        run_history: [{ run_id: '2026-07-22T18-49-17Z', score: 14, status: 'passed', epic_count: 2 }]
      }
    },
    aggregates: { unique_strategies: 1, total_epics: 2, pass_rate: 100 },
    epic_bodies: { 'RHAISTRAT-1-E001': '# lots of markdown' }
  };
}

describe('projectSnapshot', () => {
  it('keeps the envelope + aggregates and camelCases meta fields', () => {
    const snap = projectSnapshot(makeDoc());
    expect(snap.schemaVersion).toBe('1.0');
    expect(snap.generatedAt).toBe('2026-07-24T00:00:00Z');
    expect(snap.signalNames).toEqual(['change_specificity']);
    expect(snap.investigationSignalNames).toEqual(['question_specificity']);
    expect(snap.counts).toEqual({ runs: 1, strategies: 1 });
    expect(snap.aggregates).toEqual({ unique_strategies: 1, total_epics: 2, pass_rate: 100 });
  });

  it('converts strategies map to a slim array and drops epic_bodies', () => {
    const snap = projectSnapshot(makeDoc());
    expect(Array.isArray(snap.strategies)).toBe(true);
    expect(snap.strategies).toHaveLength(1);
    expect(snap).not.toHaveProperty('epic_bodies');
    const s = snap.strategies[0];
    expect(s.strat_id).toBe('RHAISTRAT-1');
    // DAG + slim epics kept for the expandable row
    expect(s.mermaid_dag).toContain('graph TD');
    expect(s.epics[0].jira_key).toBe('RHAI-137');
    // heavy per-epic signal maps are dropped from the subset
    expect(s.epics[0]).not.toHaveProperty('ai_signals');
    expect(s.epics[0]).not.toHaveProperty('team');
    // labels are dropped from the slim strategy
    expect(s).not.toHaveProperty('labels');
  });

  it('slims runs by dropping per-strategy results', () => {
    const snap = projectSnapshot(makeDoc());
    expect(snap.runs[0].submitted_epics).toBe(9);
    expect(snap.runs[0]).not.toHaveProperty('results');
  });

  it('tolerates a doc with no strategies/runs', () => {
    const snap = projectSnapshot({ aggregates: {} });
    expect(snap.strategies).toEqual([]);
    expect(snap.runs).toEqual([]);
  });
});

describe('readDecomposer', () => {
  it('returns an empty snapshot when storage is null', async () => {
    const read = vi.fn().mockResolvedValue(null);
    const data = await readDecomposer(read);
    expect(data).toEqual(emptySnapshot());
  });

  it('returns an empty snapshot when runs is missing/malformed', async () => {
    const read = vi.fn().mockResolvedValue({ foo: 'bar' });
    const data = await readDecomposer(read);
    expect(data.runs).toEqual([]);
  });

  it('returns stored data when valid', async () => {
    const stored = { lastSyncedAt: 'x', runs: [{ run_id: 'r' }], strategies: [], aggregates: {} };
    const read = vi.fn().mockResolvedValue(stored);
    const data = await readDecomposer(read);
    expect(data).toBe(stored);
  });
});

describe('slim helpers', () => {
  it('slimRun keeps run-level totals only', () => {
    const r = slimRun(makeDoc().runs[0]);
    expect(r).toHaveProperty('submitted_epics', 9);
    expect(r).not.toHaveProperty('results');
    expect(r).not.toHaveProperty('batch_size');
  });

  it('slimStrategy keeps review verdict fields', () => {
    const s = slimStrategy(makeDoc().strategies['RHAISTRAT-1']);
    expect(s.review).toEqual({ score: 14, pass: true, recommendation: 'accept' });
    expect(s.review).not.toHaveProperty('issues');
  });
});

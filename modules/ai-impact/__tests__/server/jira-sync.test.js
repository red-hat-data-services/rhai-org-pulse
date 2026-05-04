import { describe, it, expect, vi } from 'vitest';

// Mock shared/server/jira to avoid credential check at require time
vi.mock('../../../../shared/server/jira', () => ({
  jiraRequest: vi.fn(),
  fetchAllJqlResults: vi.fn()
}));

import { applyJiraFields, syncFeatureData, extractSignOffInfo } from '../../server/features/jira-sync.js';

function makeEntry(overrides = {}) {
  return {
    latest: {
      key: 'RHAISTRAT-100',
      title: 'Original Title',
      sourceRfe: 'RHAIRFE-1',
      priority: 'Major',
      status: 'Refined',
      size: 'L',
      recommendation: 'approve',
      needsAttention: false,
      humanReviewStatus: 'awaiting-review',
      scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2, total: 8 },
      reviewers: { feasibility: 'approve', testability: 'approve', scope: 'approve', architecture: 'approve' },
      labels: ['strat-creator-auto-created'],
      reviewedAt: '2026-04-19T12:00:00Z',
      ...overrides
    },
    history: []
  };
}

function makeJiraIssue(key, overrides = {}) {
  return {
    key,
    fields: {
      summary: 'Updated Title',
      status: { name: 'In Progress' },
      priority: { name: 'Critical' },
      labels: ['strat-creator-auto-created', 'strat-creator-human-sign-off'],
      ...overrides
    }
  };
}

describe('applyJiraFields', () => {
  it('returns unchanged when nothing differs', () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry()
      }
    };
    const issue = {
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Original Title',
        status: { name: 'Refined' },
        priority: { name: 'Major' },
        labels: ['strat-creator-auto-created']
      }
    };
    expect(applyJiraFields(data, issue)).toBe('unchanged');
  });

  it('returns updated when title/status/priority change but not humanReviewStatus', () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry()
      }
    };
    const issue = {
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'New Title',
        status: { name: 'In Progress' },
        priority: { name: 'Critical' },
        labels: ['strat-creator-auto-created']
      }
    };
    const result = applyJiraFields(data, issue);
    expect(result).toBe('updated');
    expect(data.features['RHAISTRAT-100'].latest.title).toBe('New Title');
    expect(data.features['RHAISTRAT-100'].latest.status).toBe('In Progress');
    expect(data.features['RHAISTRAT-100'].latest.priority).toBe('Critical');
    // No history entry created
    expect(data.features['RHAISTRAT-100'].history).toHaveLength(0);
  });

  it('returns status_changed and creates history when humanReviewStatus changes', () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry()
      }
    };
    const issue = makeJiraIssue('RHAISTRAT-100');
    const result = applyJiraFields(data, issue);
    expect(result).toBe('status_changed');
    expect(data.features['RHAISTRAT-100'].latest.humanReviewStatus).toBe('approved');
    expect(data.features['RHAISTRAT-100'].latest.labels).toContain('strat-creator-human-sign-off');
    // History should have the previous state
    expect(data.features['RHAISTRAT-100'].history).toHaveLength(1);
    expect(data.features['RHAISTRAT-100'].history[0].humanReviewStatus).toBe('awaiting-review');
  });

  it('returns unchanged for unknown feature key', () => {
    const data = { features: {} };
    const issue = makeJiraIssue('RHAISTRAT-999');
    expect(applyJiraFields(data, issue)).toBe('unchanged');
  });

  it('maps unknown Jira priority to Undefined', () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry()
      }
    };
    const issue = {
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Original Title',
        status: { name: 'Refined' },
        priority: { name: 'Trivial' },
        labels: ['strat-creator-auto-created']
      }
    };
    applyJiraFields(data, issue);
    expect(data.features['RHAISTRAT-100'].latest.priority).toBe('Undefined');
  });

  it('stores approvedBy/approvedAt from changelog when sign-off label is added', () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry()
      }
    };
    const issue = {
      ...makeJiraIssue('RHAISTRAT-100'),
      changelog: {
        histories: [{
          created: '2026-04-20T10:00:00.000+0000',
          author: { displayName: 'Jane Smith' },
          items: [{
            field: 'labels',
            fromString: 'strat-creator-auto-created',
            toString: 'strat-creator-auto-created strat-creator-human-sign-off'
          }]
        }]
      }
    };
    applyJiraFields(data, issue);
    const latest = data.features['RHAISTRAT-100'].latest;
    expect(latest.approvedBy).toBe('Jane Smith');
    expect(latest.approvedAt).toBe('2026-04-20T10:00:00.000+0000');
  });

  it('clears approval info when sign-off label is removed', () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry({
          approvedBy: 'Jane Smith',
          approvedAt: '2026-04-20T10:00:00.000+0000',
          humanReviewStatus: 'approved',
          labels: ['strat-creator-auto-created', 'strat-creator-human-sign-off']
        })
      }
    };
    const issue = {
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Original Title',
        status: { name: 'Refined' },
        priority: { name: 'Major' },
        labels: ['strat-creator-auto-created']
      }
    };
    applyJiraFields(data, issue);
    const latest = data.features['RHAISTRAT-100'].latest;
    expect(latest.humanReviewStatus).toBe('awaiting-review');
    expect(latest.approvedBy).toBeUndefined();
    expect(latest.approvedAt).toBeUndefined();
  });

  it('preserves scores and recommendation when updating from Jira', () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry()
      }
    };
    const issue = makeJiraIssue('RHAISTRAT-100');
    applyJiraFields(data, issue);
    const latest = data.features['RHAISTRAT-100'].latest;
    expect(latest.scores.total).toBe(8);
    expect(latest.recommendation).toBe('approve');
    expect(latest.reviewedAt).toBe('2026-04-19T12:00:00Z');
  });

  it('caps history at MAX_HISTORY', () => {
    const entry = makeEntry();
    // Fill history to capacity
    entry.history = Array.from({ length: 20 }, (_, i) => ({
      scores: { feasibility: 1, testability: 1, scope: 1, architecture: 1, total: 4 },
      recommendation: 'revise',
      needsAttention: false,
      humanReviewStatus: 'awaiting-review',
      reviewedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`
    }));
    const data = { features: { 'RHAISTRAT-100': entry } };
    const issue = makeJiraIssue('RHAISTRAT-100');
    applyJiraFields(data, issue);
    expect(data.features['RHAISTRAT-100'].history).toHaveLength(20);
  });
});

describe('extractSignOffInfo', () => {
  it('returns null when changelog is missing', () => {
    expect(extractSignOffInfo(null)).toBeNull();
    expect(extractSignOffInfo({})).toBeNull();
    expect(extractSignOffInfo({ histories: [] })).toBeNull();
  });

  it('extracts author and date when sign-off label is added', () => {
    const changelog = {
      histories: [{
        created: '2026-04-20T10:00:00.000+0000',
        author: { displayName: 'Jane Smith' },
        items: [{
          field: 'labels',
          fromString: 'strat-creator-auto-created',
          toString: 'strat-creator-auto-created strat-creator-human-sign-off'
        }]
      }]
    };
    const result = extractSignOffInfo(changelog);
    expect(result).toEqual({
      approvedBy: 'Jane Smith',
      approvedAt: '2026-04-20T10:00:00.000+0000'
    });
  });

  it('returns the latest sign-off when label is toggled multiple times', () => {
    const changelog = {
      histories: [
        {
          created: '2026-04-18T08:00:00.000+0000',
          author: { displayName: 'Alice' },
          items: [{
            field: 'labels',
            fromString: 'strat-creator-auto-created',
            toString: 'strat-creator-auto-created strat-creator-human-sign-off'
          }]
        },
        {
          created: '2026-04-19T08:00:00.000+0000',
          author: { displayName: 'Bob' },
          items: [{
            field: 'labels',
            fromString: 'strat-creator-auto-created strat-creator-human-sign-off',
            toString: 'strat-creator-auto-created'
          }]
        },
        {
          created: '2026-04-20T08:00:00.000+0000',
          author: { displayName: 'Charlie' },
          items: [{
            field: 'labels',
            fromString: 'strat-creator-auto-created',
            toString: 'strat-creator-auto-created strat-creator-human-sign-off'
          }]
        }
      ]
    };
    const result = extractSignOffInfo(changelog);
    expect(result.approvedBy).toBe('Charlie');
    expect(result.approvedAt).toBe('2026-04-20T08:00:00.000+0000');
  });

  it('ignores non-label changelog entries', () => {
    const changelog = {
      histories: [{
        created: '2026-04-20T10:00:00.000+0000',
        author: { displayName: 'Jane' },
        items: [{
          field: 'status',
          fromString: 'New',
          toString: 'In Progress'
        }]
      }]
    };
    expect(extractSignOffInfo(changelog)).toBeNull();
  });
});

describe('syncFeatureData', () => {
  it('returns zero counts when no features exist', async () => {
    const mockFetch = vi.fn();
    const data = { features: {} };
    const result = await syncFeatureData(data, mockFetch);
    expect(result.synced).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches features in batches and applies updates', async () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry()
      }
    };

    const mockFetch = vi.fn().mockResolvedValue([
      makeJiraIssue('RHAISTRAT-100')
    ]);

    const result = await syncFeatureData(data, mockFetch);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.synced).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.statusChanged).toBe(1);
    expect(result.notFound).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('counts features not found in Jira', async () => {
    const data = {
      features: {
        'RHAISTRAT-100': makeEntry()
      }
    };

    const mockFetch = vi.fn().mockResolvedValue([]);

    const result = await syncFeatureData(data, mockFetch);
    expect(result.synced).toBe(0);
    expect(result.notFound).toBe(1);
  });

  it('handles batch errors gracefully and continues', async () => {
    // Create enough features to trigger multiple batches (>50)
    const features = {};
    for (let i = 0; i < 60; i++) {
      features[`RHAISTRAT-${i}`] = makeEntry({ key: `RHAISTRAT-${i}` });
    }
    const data = { features };

    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Jira unavailable'))
      .mockRejectedValueOnce(new Error('Jira unavailable'));

    const result = await syncFeatureData(data, mockFetch);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('Batch 1/2 failed');
    expect(result.errors[1]).toContain('Batch 2/2 failed');
  });
});

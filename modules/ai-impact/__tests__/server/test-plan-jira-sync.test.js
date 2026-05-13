import { describe, it, expect, vi } from 'vitest';

// Mock shared/server/jira to avoid credential check at require time
vi.mock('../../../../shared/server/jira', () => ({
  jiraRequest: vi.fn(),
  fetchAllJqlResults: vi.fn()
}));

import { applyJiraFields, syncTestPlanData, extractSignOffInfo } from '../../server/test-plans/jira-sync.js';

function makeEntry(overrides = {}) {
  return {
    latest: {
      key: 'RHAISTRAT-1168',
      feature: 'GPU Observability',
      sourceKey: 'RHAISTRAT-1168',
      score: 8,
      verdict: 'Ready',
      scores: { specificity: 2, grounding: 2, scope_fidelity: 2, actionability: 1, consistency: 1 },
      autoRevised: false,
      beforeScore: null,
      beforeScores: null,
      criterionNotes: {},
      feedback: 'Good plan.',
      error: null,
      components: ['dashboard'],
      testCaseCount: 24,
      reviewedAt: '2026-05-10T12:00:00Z',
      ...overrides
    },
    history: []
  };
}

function makeJiraIssue(key, overrides = {}) {
  return {
    key,
    fields: {
      summary: 'Updated GPU Dashboard Test Plan',
      status: { name: 'In Progress' },
      priority: { name: 'Critical' },
      labels: ['test-plan-auto-created', 'test-plan-rubric-pass', 'test-plan-human-sign-off'],
      ...overrides
    }
  };
}

describe('applyJiraFields', () => {
  it('returns unchanged when nothing differs', () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry({
          jiraTitle: 'GPU Observability',
          jiraStatus: 'Refined',
          jiraPriority: 'Major',
          labels: ['test-plan-auto-created']
        })
      }
    };
    const issue = {
      key: 'RHAISTRAT-1168',
      fields: {
        summary: 'GPU Observability',
        status: { name: 'Refined' },
        priority: { name: 'Major' },
        labels: ['test-plan-auto-created']
      }
    };
    expect(applyJiraFields(data, issue)).toBe('unchanged');
  });

  it('returns updated when jiraTitle/jiraStatus/jiraPriority change but not humanReviewStatus', () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry({
          jiraTitle: 'Old Title',
          jiraStatus: 'New',
          jiraPriority: 'Minor',
          labels: ['test-plan-auto-created'],
          humanReviewStatus: 'awaiting-review'
        })
      }
    };
    const issue = {
      key: 'RHAISTRAT-1168',
      fields: {
        summary: 'New Title',
        status: { name: 'In Progress' },
        priority: { name: 'Critical' },
        labels: ['test-plan-auto-created']
      }
    };
    const result = applyJiraFields(data, issue);
    expect(result).toBe('updated');
    expect(data.testPlans['RHAISTRAT-1168'].latest.jiraTitle).toBe('New Title');
    expect(data.testPlans['RHAISTRAT-1168'].latest.jiraStatus).toBe('In Progress');
    expect(data.testPlans['RHAISTRAT-1168'].latest.jiraPriority).toBe('Critical');
    // No history entry created
    expect(data.testPlans['RHAISTRAT-1168'].history).toHaveLength(0);
  });

  it('returns status_changed and creates history when humanReviewStatus changes', () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry({
          labels: ['test-plan-auto-created'],
          humanReviewStatus: 'awaiting-review'
        })
      }
    };
    const issue = makeJiraIssue('RHAISTRAT-1168');
    const result = applyJiraFields(data, issue);
    expect(result).toBe('status_changed');
    expect(data.testPlans['RHAISTRAT-1168'].latest.humanReviewStatus).toBe('approved');
    expect(data.testPlans['RHAISTRAT-1168'].latest.labels).toContain('test-plan-human-sign-off');
    // History should have the previous state
    expect(data.testPlans['RHAISTRAT-1168'].history).toHaveLength(1);
  });

  it('derives needs-review from rubric-fail label', () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry({
          labels: ['test-plan-auto-created'],
          humanReviewStatus: 'awaiting-review'
        })
      }
    };
    const issue = {
      key: 'RHAISTRAT-1168',
      fields: {
        summary: 'Test Plan Title',
        status: { name: 'In Progress' },
        priority: { name: 'Major' },
        labels: ['test-plan-auto-created', 'test-plan-rubric-fail']
      }
    };
    const result = applyJiraFields(data, issue);
    expect(result).toBe('status_changed');
    expect(data.testPlans['RHAISTRAT-1168'].latest.humanReviewStatus).toBe('needs-review');
  });

  it('returns unchanged for unknown test plan key', () => {
    const data = { testPlans: {} };
    const issue = makeJiraIssue('RHAISTRAT-999');
    expect(applyJiraFields(data, issue)).toBe('unchanged');
  });

  it('stores approvedBy/approvedAt from changelog when sign-off label is added', () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry({
          labels: ['test-plan-auto-created'],
          humanReviewStatus: 'awaiting-review'
        })
      }
    };
    const issue = {
      ...makeJiraIssue('RHAISTRAT-1168'),
      changelog: {
        histories: [{
          created: '2026-05-10T14:30:00.000+0000',
          author: { displayName: 'Alice Nguyen' },
          items: [{
            field: 'labels',
            fromString: 'test-plan-auto-created test-plan-rubric-pass',
            toString: 'test-plan-auto-created test-plan-rubric-pass test-plan-human-sign-off'
          }]
        }]
      }
    };
    applyJiraFields(data, issue);
    const latest = data.testPlans['RHAISTRAT-1168'].latest;
    expect(latest.approvedBy).toBe('Alice Nguyen');
    expect(latest.approvedAt).toBe('2026-05-10T14:30:00.000+0000');
  });

  it('clears approval info when sign-off label is removed', () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry({
          approvedBy: 'Alice Nguyen',
          approvedAt: '2026-05-10T14:30:00.000+0000',
          humanReviewStatus: 'approved',
          labels: ['test-plan-auto-created', 'test-plan-rubric-pass', 'test-plan-human-sign-off']
        })
      }
    };
    const issue = {
      key: 'RHAISTRAT-1168',
      fields: {
        summary: 'GPU Observability',
        status: { name: 'In Progress' },
        priority: { name: 'Critical' },
        labels: ['test-plan-auto-created', 'test-plan-rubric-pass']
      }
    };
    applyJiraFields(data, issue);
    const latest = data.testPlans['RHAISTRAT-1168'].latest;
    expect(latest.humanReviewStatus).toBe('awaiting-review');
    expect(latest.approvedBy).toBeUndefined();
    expect(latest.approvedAt).toBeUndefined();
  });

  it('preserves scores and verdict when updating from Jira', () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry({
          labels: ['test-plan-auto-created'],
          humanReviewStatus: 'awaiting-review'
        })
      }
    };
    const issue = makeJiraIssue('RHAISTRAT-1168');
    applyJiraFields(data, issue);
    const latest = data.testPlans['RHAISTRAT-1168'].latest;
    expect(latest.score).toBe(8);
    expect(latest.verdict).toBe('Ready');
    expect(latest.reviewedAt).toBe('2026-05-10T12:00:00Z');
  });

  it('caps history at MAX_HISTORY', () => {
    const entry = makeEntry({
      labels: ['test-plan-auto-created'],
      humanReviewStatus: 'awaiting-review'
    });
    // Fill history to capacity
    entry.history = Array.from({ length: 20 }, (_, i) => ({
      scores: { specificity: 1, grounding: 1, scope_fidelity: 1, actionability: 1, consistency: 1 },
      score: 5,
      verdict: 'Revise',
      autoRevised: false,
      reviewedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`
    }));
    const data = { testPlans: { 'RHAISTRAT-1168': entry } };
    const issue = makeJiraIssue('RHAISTRAT-1168');
    applyJiraFields(data, issue);
    expect(data.testPlans['RHAISTRAT-1168'].history).toHaveLength(20);
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
        created: '2026-05-10T14:30:00.000+0000',
        author: { displayName: 'Alice Nguyen' },
        items: [{
          field: 'labels',
          fromString: 'test-plan-auto-created',
          toString: 'test-plan-auto-created test-plan-human-sign-off'
        }]
      }]
    };
    const result = extractSignOffInfo(changelog);
    expect(result).toEqual({
      approvedBy: 'Alice Nguyen',
      approvedAt: '2026-05-10T14:30:00.000+0000'
    });
  });

  it('returns the latest sign-off when label is toggled multiple times', () => {
    const changelog = {
      histories: [
        {
          created: '2026-05-08T08:00:00.000+0000',
          author: { displayName: 'Alice' },
          items: [{
            field: 'labels',
            fromString: 'test-plan-auto-created',
            toString: 'test-plan-auto-created test-plan-human-sign-off'
          }]
        },
        {
          created: '2026-05-09T08:00:00.000+0000',
          author: { displayName: 'Bob' },
          items: [{
            field: 'labels',
            fromString: 'test-plan-auto-created test-plan-human-sign-off',
            toString: 'test-plan-auto-created'
          }]
        },
        {
          created: '2026-05-10T08:00:00.000+0000',
          author: { displayName: 'Charlie' },
          items: [{
            field: 'labels',
            fromString: 'test-plan-auto-created',
            toString: 'test-plan-auto-created test-plan-human-sign-off'
          }]
        }
      ]
    };
    const result = extractSignOffInfo(changelog);
    expect(result.approvedBy).toBe('Charlie');
    expect(result.approvedAt).toBe('2026-05-10T08:00:00.000+0000');
  });

  it('ignores non-label changelog entries', () => {
    const changelog = {
      histories: [{
        created: '2026-05-10T10:00:00.000+0000',
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

describe('syncTestPlanData', () => {
  it('returns zero counts when no test plans exist', async () => {
    const mockFetch = vi.fn();
    const data = { testPlans: {} };
    const result = await syncTestPlanData(data, mockFetch);
    expect(result.synced).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches test plans in batches and applies updates', async () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry({
          labels: ['test-plan-auto-created'],
          humanReviewStatus: 'awaiting-review'
        })
      }
    };

    const mockFetch = vi.fn().mockResolvedValue([
      makeJiraIssue('RHAISTRAT-1168')
    ]);

    const result = await syncTestPlanData(data, mockFetch);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.synced).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.statusChanged).toBe(1);
    expect(result.notFound).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('counts test plans not found in Jira', async () => {
    const data = {
      testPlans: {
        'RHAISTRAT-1168': makeEntry()
      }
    };

    const mockFetch = vi.fn().mockResolvedValue([]);

    const result = await syncTestPlanData(data, mockFetch);
    expect(result.synced).toBe(0);
    expect(result.notFound).toBe(1);
  });

  it('handles batch errors gracefully and continues', async () => {
    const testPlans = {};
    for (let i = 0; i < 60; i++) {
      testPlans[`RHAISTRAT-${i}`] = makeEntry({ key: `RHAISTRAT-${i}` });
    }
    const data = { testPlans };

    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Jira unavailable'))
      .mockRejectedValueOnce(new Error('Jira unavailable'));

    const result = await syncTestPlanData(data, mockFetch);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('Batch 1/2 failed');
    expect(result.errors[1]).toContain('Batch 2/2 failed');
  });
});

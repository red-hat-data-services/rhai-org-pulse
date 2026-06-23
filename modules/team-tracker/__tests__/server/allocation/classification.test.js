// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildSprintSummary,
  buildTeamSummary,
  buildOrgSummary,
  emptyBuckets,
  getLatestSprintEndDate,
  determineStaleness,
  STALE_THRESHOLD_MS
} from '../../../server/allocation/classification.js';

// Classification tests now live in platform/allocation-strategy tests.
// The classifyIssue function is no longer exported from classification.js.

const TEST_CATEGORIES = [
  { key: 'tech-debt-quality', name: 'Tech Debt & Quality', color: 'amber', target: 40 },
  { key: 'new-features', name: 'New Features', color: 'blue', target: 40 },
  { key: 'learning-enablement', name: 'Learning & Enablement', color: 'green', target: 20 }
];

describe('emptyBuckets', () => {
  it('creates buckets from categories plus uncategorized', () => {
    const buckets = emptyBuckets(TEST_CATEGORIES);
    expect(Object.keys(buckets)).toEqual([
      'tech-debt-quality', 'new-features', 'learning-enablement', 'uncategorized'
    ]);
    for (const key of Object.keys(buckets)) {
      expect(buckets[key]).toEqual({ points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 });
    }
  });

  it('returns only uncategorized when no categories', () => {
    const buckets = emptyBuckets([]);
    expect(Object.keys(buckets)).toEqual(['uncategorized']);
  });
});

describe('buildSprintSummary', () => {
  it('returns zeroed summary for empty issues array', () => {
    const summary = buildSprintSummary([], 'points', TEST_CATEGORIES);
    expect(summary.totalPoints).toBe(0);
    expect(summary.estimatedIssueCount).toBe(0);
    expect(summary.unestimatedIssueCount).toBe(0);
    expect(summary.buckets['tech-debt-quality'].points).toBe(0);
    expect(summary.buckets['new-features'].points).toBe(0);
    expect(summary.buckets['learning-enablement'].points).toBe(0);
    expect(summary.buckets['uncategorized'].points).toBe(0);
  });

  it('sums points into correct buckets', () => {
    const issues = [
      { bucket: 'tech-debt-quality', storyPoints: 3, completed: false },
      { bucket: 'tech-debt-quality', storyPoints: 5, completed: true },
      { bucket: 'new-features', storyPoints: 8, completed: false },
      { bucket: 'uncategorized', storyPoints: 2, completed: true }
    ];

    const summary = buildSprintSummary(issues, 'points', TEST_CATEGORIES);
    expect(summary.totalPoints).toBe(18);
    expect(summary.estimatedIssueCount).toBe(4);
    expect(summary.unestimatedIssueCount).toBe(0);
    expect(summary.buckets['tech-debt-quality'].points).toBe(8);
    expect(summary.buckets['tech-debt-quality'].completedPoints).toBe(5);
    expect(summary.buckets['new-features'].points).toBe(8);
    expect(summary.buckets['uncategorized'].points).toBe(2);
  });

  it('tracks unestimated issues', () => {
    const issues = [
      { bucket: 'new-features', storyPoints: 5, completed: false },
      { bucket: 'new-features', storyPoints: null, completed: false },
      { bucket: 'tech-debt-quality', storyPoints: undefined, completed: false }
    ];

    const summary = buildSprintSummary(issues, 'points', TEST_CATEGORIES);
    expect(summary.estimatedIssueCount).toBe(1);
    expect(summary.unestimatedIssueCount).toBe(2);
    expect(summary.totalPoints).toBe(5);
  });

  it('tracks completed points separately', () => {
    const issues = [
      { bucket: 'new-features', storyPoints: 5, completed: true },
      { bucket: 'new-features', storyPoints: 3, completed: false }
    ];

    const summary = buildSprintSummary(issues, 'points', TEST_CATEGORIES);
    expect(summary.buckets['new-features'].completedPoints).toBe(5);
    expect(summary.buckets['new-features'].points).toBe(8);
  });

  it('counts issueCount per bucket', () => {
    const issues = [
      { bucket: 'tech-debt-quality', storyPoints: 1, completed: false },
      { bucket: 'tech-debt-quality', storyPoints: 2, completed: false },
      { bucket: 'new-features', storyPoints: 3, completed: false }
    ];

    const summary = buildSprintSummary(issues, 'points', TEST_CATEGORIES);
    expect(summary.buckets['tech-debt-quality'].issueCount).toBe(2);
    expect(summary.buckets['new-features'].issueCount).toBe(1);
  });

  it('ignores issues with unknown bucket', () => {
    const issues = [
      { bucket: 'unknown-bucket', storyPoints: 10, completed: false }
    ];

    const summary = buildSprintSummary(issues, 'points', TEST_CATEGORIES);
    expect(summary.totalPoints).toBe(0);
  });

  it('calculates based on issue counts when mode is "counts"', () => {
    const issues = [
      { bucket: 'tech-debt-quality', storyPoints: 10, completed: false },
      { bucket: 'tech-debt-quality', storyPoints: 5, completed: true },
      { bucket: 'new-features', storyPoints: 20, completed: false },
      { bucket: 'uncategorized', storyPoints: null, completed: false }
    ];

    const summary = buildSprintSummary(issues, 'counts', TEST_CATEGORIES);

    expect(summary.totalCount).toBe(4);
    expect(summary.estimatedIssueCount).toBe(3);
    expect(summary.unestimatedIssueCount).toBe(1);

    expect(summary.buckets['tech-debt-quality'].count).toBe(2);
    expect(summary.buckets['new-features'].count).toBe(1);
    expect(summary.buckets['uncategorized'].count).toBe(1);

    expect(summary.totalPoints).toBe(35);
    expect(summary.buckets['tech-debt-quality'].points).toBe(15);
  });

  it('defaults to "points" mode when no mode specified', () => {
    const issues = [
      { bucket: 'new-features', storyPoints: 5, completed: false },
      { bucket: 'new-features', storyPoints: 3, completed: false }
    ];

    const summaryDefault = buildSprintSummary(issues, undefined, TEST_CATEGORIES);
    const summaryExplicit = buildSprintSummary(issues, 'points', TEST_CATEGORIES);

    expect(summaryDefault).toEqual(summaryExplicit);
  });
});

describe('getLatestSprintEndDate', () => {
  it('returns null for empty array', () => {
    expect(getLatestSprintEndDate([])).toBeNull();
  });

  it('returns null when no sprints have dates', () => {
    expect(getLatestSprintEndDate([
      { completeDate: null, endDate: null }
    ])).toBeNull();
  });

  it('prefers completeDate over endDate', () => {
    const sprints = [
      { completeDate: '2025-03-15T00:00:00Z', endDate: '2025-03-10T00:00:00Z' }
    ];
    expect(getLatestSprintEndDate(sprints)).toBe('2025-03-15T00:00:00Z');
  });

  it('falls back to endDate when completeDate is null', () => {
    const sprints = [
      { completeDate: null, endDate: '2025-03-10T00:00:00Z' }
    ];
    expect(getLatestSprintEndDate(sprints)).toBe('2025-03-10T00:00:00Z');
  });

  it('returns the latest date among multiple sprints', () => {
    const sprints = [
      { completeDate: '2025-01-01T00:00:00Z', endDate: null },
      { completeDate: '2025-06-01T00:00:00Z', endDate: null },
      { completeDate: '2025-03-01T00:00:00Z', endDate: null }
    ];
    expect(getLatestSprintEndDate(sprints)).toBe('2025-06-01T00:00:00Z');
  });

  it('skips invalid dates', () => {
    const sprints = [
      { completeDate: 'not-a-date', endDate: null },
      { completeDate: '2025-05-01T00:00:00Z', endDate: null }
    ];
    expect(getLatestSprintEndDate(sprints)).toBe('2025-05-01T00:00:00Z');
  });
});

describe('determineStaleness', () => {
  const now = new Date('2025-06-01T00:00:00Z');

  it('marks board with no sprints as stale', () => {
    const result = determineStaleness([], now);
    expect(result.stale).toBe(true);
    expect(result.lastSprintEndDate).toBeNull();
  });

  it('marks null sprints as stale', () => {
    const result = determineStaleness(null, now);
    expect(result.stale).toBe(true);
    expect(result.lastSprintEndDate).toBeNull();
  });

  it('marks board with active sprint as not stale', () => {
    const sprints = [
      { state: 'active', completeDate: null, endDate: '2025-06-15T00:00:00Z' }
    ];
    const result = determineStaleness(sprints, now);
    expect(result.stale).toBe(false);
  });

  it('marks board with future sprint as not stale', () => {
    const sprints = [
      { state: 'future', completeDate: null, endDate: '2025-07-01T00:00:00Z' }
    ];
    const result = determineStaleness(sprints, now);
    expect(result.stale).toBe(false);
  });

  it('marks board as stale when last sprint ended >90 days ago', () => {
    const sprints = [
      { state: 'closed', completeDate: '2025-01-01T00:00:00Z', endDate: null }
    ];
    const result = determineStaleness(sprints, now);
    expect(result.stale).toBe(true);
    expect(result.lastSprintEndDate).toBe('2025-01-01T00:00:00Z');
  });

  it('marks board as not stale when last sprint ended <90 days ago', () => {
    const sprints = [
      { state: 'closed', completeDate: '2025-05-01T00:00:00Z', endDate: null }
    ];
    const result = determineStaleness(sprints, now);
    expect(result.stale).toBe(false);
    expect(result.lastSprintEndDate).toBe('2025-05-01T00:00:00Z');
  });

  it('marks board as stale when closed sprints have no dates', () => {
    const sprints = [
      { state: 'closed', completeDate: null, endDate: null }
    ];
    const result = determineStaleness(sprints, now);
    expect(result.stale).toBe(true);
    expect(result.lastSprintEndDate).toBeNull();
  });
});

describe('STALE_THRESHOLD_MS', () => {
  it('is 90 days in milliseconds', () => {
    expect(STALE_THRESHOLD_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe('buildTeamSummary', () => {
  function makeBoardSummary(overrides = {}) {
    return {
      totalPoints: 10,
      estimatedIssueCount: 5,
      unestimatedIssueCount: 1,
      buckets: {
        'tech-debt-quality': { points: 4, issueCount: 2, completedPoints: 3 },
        'new-features': { points: 4, issueCount: 2, completedPoints: 2 },
        'learning-enablement': { points: 1, issueCount: 1, completedPoints: 0 },
        'uncategorized': { points: 1, issueCount: 0, completedPoints: 0 }
      },
      ...overrides
    };
  }

  it('returns zeroed summary for empty array', () => {
    const result = buildTeamSummary([], TEST_CATEGORIES);
    expect(result.totalPoints).toBe(0);
    expect(result.boardCount).toBe(0);
    expect(result.buckets['tech-debt-quality'].points).toBe(0);
  });

  it('aggregates points across boards', () => {
    const summaries = [
      makeBoardSummary({ totalPoints: 10 }),
      makeBoardSummary({ totalPoints: 20 })
    ];
    summaries[1].buckets['tech-debt-quality'].points = 8;
    summaries[1].buckets['new-features'].points = 8;
    summaries[1].buckets['learning-enablement'].points = 2;
    summaries[1].buckets['uncategorized'].points = 2;

    const result = buildTeamSummary(summaries, TEST_CATEGORIES);
    expect(result.totalPoints).toBe(30);
    expect(result.boardCount).toBe(2);
    expect(result.buckets['tech-debt-quality'].points).toBe(12);
    expect(result.buckets['new-features'].points).toBe(12);
    expect(result.buckets['learning-enablement'].points).toBe(3);
    expect(result.buckets['uncategorized'].points).toBe(3);
  });

  it('aggregates issue counts and completed points', () => {
    const summaries = [makeBoardSummary(), makeBoardSummary()];

    const result = buildTeamSummary(summaries, TEST_CATEGORIES);
    expect(result.estimatedIssueCount).toBe(10);
    expect(result.unestimatedIssueCount).toBe(2);
    expect(result.buckets['tech-debt-quality'].completedPoints).toBe(6);
    expect(result.buckets['tech-debt-quality'].issueCount).toBe(4);
  });

  it('works with a single board', () => {
    const result = buildTeamSummary([makeBoardSummary()], TEST_CATEGORIES);
    expect(result.totalPoints).toBe(10);
    expect(result.boardCount).toBe(1);
  });

  it('calculates weighted percentages when boards have mixed calculation modes', () => {
    const summaries = [
      {
        totalPoints: 10,
        totalCount: 0,
        calculationMode: 'points',
        estimatedIssueCount: 5,
        unestimatedIssueCount: 0,
        buckets: {
          'tech-debt-quality': { points: 4, count: 0, issueCount: 2, completedPoints: 0 },
          'new-features': { points: 4, count: 0, issueCount: 2, completedPoints: 0 },
          'learning-enablement': { points: 2, count: 0, issueCount: 1, completedPoints: 0 },
          'uncategorized': { points: 0, count: 0, issueCount: 0, completedPoints: 0 }
        }
      },
      {
        totalPoints: 0,
        totalCount: 5,
        calculationMode: 'counts',
        estimatedIssueCount: 5,
        unestimatedIssueCount: 0,
        buckets: {
          'tech-debt-quality': { points: 0, count: 3, issueCount: 3, completedPoints: 0 },
          'new-features': { points: 0, count: 1, issueCount: 1, completedPoints: 0 },
          'learning-enablement': { points: 0, count: 1, issueCount: 1, completedPoints: 0 },
          'uncategorized': { points: 0, count: 0, issueCount: 0, completedPoints: 0 }
        }
      }
    ];

    const result = buildTeamSummary(summaries, TEST_CATEGORIES);

    expect(result.percentages['tech-debt-quality']).toBeCloseTo(46.67, 1);
    expect(result.percentages['new-features']).toBeCloseTo(33.33, 1);
    expect(result.totalPoints).toBe(10);
    expect(result.totalCount).toBe(5);
  });
});

describe('buildOrgSummary', () => {
  function makeTeamSummary(overrides = {}) {
    return {
      totalPoints: 20,
      boardCount: 3,
      estimatedIssueCount: 10,
      unestimatedIssueCount: 2,
      buckets: {
        'tech-debt-quality': { points: 8, issueCount: 4, completedPoints: 6 },
        'new-features': { points: 8, issueCount: 4, completedPoints: 4 },
        'learning-enablement': { points: 2, issueCount: 2, completedPoints: 0 },
        'uncategorized': { points: 2, issueCount: 0, completedPoints: 0 }
      },
      ...overrides
    };
  }

  it('returns zeroed summary for empty array', () => {
    const result = buildOrgSummary([], TEST_CATEGORIES);
    expect(result.totalPoints).toBe(0);
    expect(result.teamCount).toBe(0);
    expect(result.boardCount).toBe(0);
  });

  it('aggregates across teams', () => {
    const teams = [
      makeTeamSummary({ totalPoints: 20, boardCount: 3 }),
      makeTeamSummary({ totalPoints: 30, boardCount: 5 })
    ];
    teams[1].buckets['tech-debt-quality'].points = 12;
    teams[1].buckets['new-features'].points = 12;
    teams[1].buckets['learning-enablement'].points = 3;
    teams[1].buckets['uncategorized'].points = 3;

    const result = buildOrgSummary(teams, TEST_CATEGORIES);
    expect(result.totalPoints).toBe(50);
    expect(result.teamCount).toBe(2);
    expect(result.boardCount).toBe(8);
    expect(result.buckets['tech-debt-quality'].points).toBe(20);
    expect(result.buckets['new-features'].points).toBe(20);
  });

  it('sums estimatedIssueCount and unestimatedIssueCount', () => {
    const teams = [makeTeamSummary(), makeTeamSummary()];

    const result = buildOrgSummary(teams, TEST_CATEGORIES);
    expect(result.estimatedIssueCount).toBe(20);
    expect(result.unestimatedIssueCount).toBe(4);
  });
});

import { describe, it, expect } from 'vitest'

const {
  classifyIssue,
  processIssue,
  extractTerminalAt,
  extractPipelineHistory,
  computeEffortScore,
  computePriorityBreakdown,
  computeMedianTimeToFix,
  getLastWeekBounds,
  getWindowBounds,
  computeAutofixMetrics,
  buildTrendData
} = require('../../server/jira/autofix-fetcher')

describe('classifyIssue', () => {
  it('returns autofix-merged for jira-autofix-merged', () => {
    expect(classifyIssue(['jira-autofix-merged', 'jira-autofix'])).toBe('autofix-merged')
  })

  it('returns autofix-rejected for jira-autofix-rejected', () => {
    expect(classifyIssue(['jira-autofix-rejected'])).toBe('autofix-rejected')
  })

  it('returns autofix-max-retries for jira-autofix-max-retries', () => {
    expect(classifyIssue(['jira-autofix-max-retries'])).toBe('autofix-max-retries')
  })

  it('returns autofix-ci-failing for jira-autofix-ci-failing', () => {
    expect(classifyIssue(['jira-autofix-ci-failing'])).toBe('autofix-ci-failing')
  })

  it('returns autofix-review when jira-autofix-review is present', () => {
    expect(classifyIssue(['jira-autofix-review'])).toBe('autofix-review')
  })

  it('returns autofix-pending when jira-autofix-pending is present', () => {
    expect(classifyIssue(['jira-autofix-pending'])).toBe('autofix-pending')
  })

  it('returns autofix-blocked for jira-autofix-blocked', () => {
    expect(classifyIssue(['jira-autofix-blocked'])).toBe('autofix-blocked')
  })

  it('returns autofix-ready when only jira-autofix is present', () => {
    expect(classifyIssue(['jira-autofix'])).toBe('autofix-ready')
  })

  it('returns triage-not-fixable for jira-triage-not-fixable', () => {
    expect(classifyIssue(['jira-triage-not-fixable'])).toBe('triage-not-fixable')
  })

  it('returns triage-stale for jira-triage-stale', () => {
    expect(classifyIssue(['jira-triage-stale'])).toBe('triage-stale')
  })

  it('returns triage-missing-info for jira-triage-missing-info', () => {
    expect(classifyIssue(['jira-triage-missing-info'])).toBe('triage-missing-info')
  })

  it('returns triage-pending for jira-triage-pending', () => {
    expect(classifyIssue(['jira-triage-pending'])).toBe('triage-pending')
  })

  it('returns triage-external for jira-triage-external', () => {
    expect(classifyIssue(['jira-triage-external'])).toBe('triage-external')
  })

  it('returns triage-security-review for jira-triage-security-review', () => {
    expect(classifyIssue(['jira-triage-security-review'])).toBe('triage-security-review')
  })

  it('prioritizes triage-security-review over other triage states', () => {
    expect(classifyIssue(['jira-triage-not-fixable', 'jira-triage-security-review'])).toBe('triage-security-review')
  })

  it('returns unknown when no pipeline labels present', () => {
    expect(classifyIssue(['some-other-label'])).toBe('unknown')
  })

  it('prioritizes autofix-merged over other labels', () => {
    expect(classifyIssue(['jira-autofix-merged', 'jira-autofix-review', 'jira-autofix'])).toBe('autofix-merged')
  })

  it('prioritizes autofix-blocked over autofix-pending when both present', () => {
    expect(classifyIssue(['jira-autofix', 'jira-autofix-pending', 'jira-autofix-blocked'])).toBe('autofix-blocked')
  })
})

describe('processIssue', () => {
  it('extracts fields from a Jira issue', () => {
    const issue = {
      key: 'AIPCC-123',
      fields: {
        summary: 'Fix the thing',
        status: { name: 'In Progress' },
        priority: { name: 'Major' },
        created: '2026-04-16T10:00:00.000Z',
        updated: '2026-04-17T10:00:00.000Z',
        labels: ['jira-autofix-review'],
        components: [{ name: 'Model Server' }],
        assignee: { displayName: 'Jane Doe' }
      }
    }

    const result = processIssue(issue)
    expect(result.key).toBe('AIPCC-123')
    expect(result.summary).toBe('Fix the thing')
    expect(result.status).toBe('In Progress')
    expect(result.components).toEqual(['Model Server'])
    expect(result.assignee).toBe('Jane Doe')
    expect(result.pipelineState).toBe('autofix-review')
    expect(result.terminalAt).toBeNull()
  })

  it('handles missing optional fields', () => {
    const issue = {
      key: 'AIPCC-999',
      fields: {
        summary: 'Minimal issue',
        status: null,
        priority: null,
        created: '2026-04-16T10:00:00.000Z',
        updated: null,
        labels: ['jira-triage-pending'],
        components: [],
        assignee: null
      }
    }

    const result = processIssue(issue)
    expect(result.status).toBe('Unknown')
    expect(result.priority).toBe('None')
    expect(result.components).toEqual([])
    expect(result.assignee).toBeNull()
    expect(result.pipelineState).toBe('triage-pending')
  })
})

describe('computeAutofixMetrics', () => {
  const now = new Date()
  const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const issues = [
    { created: recent, pipelineState: 'autofix-merged', components: ['A'] },
    { created: recent, pipelineState: 'autofix-review', components: ['A'] },
    { created: recent, pipelineState: 'autofix-rejected', components: ['A'] },
    { created: recent, pipelineState: 'triage-missing-info', components: ['B'] },
    { created: recent, pipelineState: 'triage-not-fixable', components: ['B'] },
    { created: recent, pipelineState: 'triage-external', components: ['B'] },
    { created: recent, pipelineState: 'triage-security-review', components: ['B'] },
    { created: old, pipelineState: 'autofix-merged', components: ['A'] }
  ]

  it('computes metrics for a last7 rolling window', () => {
    const m = computeAutofixMetrics(issues, 'last7')
    expect(m.windowTotal).toBe(7)
    expect(m.triageVerdicts.ready).toBe(3)
    expect(m.triageVerdicts.missingInfo).toBe(1)
    expect(m.triageVerdicts.notFixable).toBe(1)
    expect(m.triageVerdicts.external).toBe(1)
    expect(m.triageVerdicts.securityReview).toBe(1)
    expect(m.autofixStates.merged).toBe(1)
    expect(m.autofixStates.review).toBe(1)
    expect(m.autofixStates.rejected).toBe(1)
    expect(m.totalIssues).toBe(8)
  })

  it('computes success rate from terminal states (merged / (merged + rejected + maxRetries))', () => {
    const m = computeAutofixMetrics(issues, 'last7')
    // merged=1, rejected=1, maxRetries=0 → terminal=2, successRate = 1/2 = 50%
    expect(m.successRate).toBe(50)
  })

  it('returns zero success rate when no terminal autofix issues in window', () => {
    const m = computeAutofixMetrics([], 'last7')
    expect(m.successRate).toBe(0)
  })
})

describe('buildTrendData', () => {
  it('returns weekly data points with breakdown fields', () => {
    const issues = [
      { created: new Date().toISOString(), pipelineState: 'autofix-merged', components: [] }
    ]
    const trend = buildTrendData(issues, 'last7')
    expect(trend).toHaveLength(4)
    expect(trend[0]).toHaveProperty('date')
    expect(trend[0]).toHaveProperty('triaged')
    expect(trend[0]).toHaveProperty('autofixed')
    expect(trend[0]).toHaveProperty('merged')
    expect(trend[0]).toHaveProperty('review')
    expect(trend[0]).toHaveProperty('ciFailing')
    expect(trend[0]).toHaveProperty('blocked')
    expect(trend[0]).toHaveProperty('maxRetries')
    expect(trend[0]).toHaveProperty('missingInfo')
    expect(trend[0]).toHaveProperty('stale')
    expect(trend[0]).toHaveProperty('external')
    expect(trend[0]).toHaveProperty('securityReview')
  })

  it('returns 13 points for last90 window', () => {
    const trend = buildTrendData([], 'last90')
    expect(trend).toHaveLength(13)
  })

  it('counts waiting-on-humans breakdowns correctly', () => {
    const now = new Date()
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: recent, pipelineState: 'autofix-review', components: [] },
      { created: recent, pipelineState: 'autofix-review', components: [] },
      { created: recent, pipelineState: 'autofix-ci-failing', components: [] },
      { created: recent, pipelineState: 'autofix-blocked', components: [] },
      { created: recent, pipelineState: 'autofix-max-retries', components: [] },
      { created: recent, pipelineState: 'autofix-merged', components: [] },
      { created: recent, pipelineState: 'triage-missing-info', components: [] },
      { created: recent, pipelineState: 'triage-stale', components: [] },
      { created: recent, pipelineState: 'triage-external', components: [] },
      { created: recent, pipelineState: 'triage-security-review', components: [] }
    ]
    const trend = buildTrendData(issues, 'last7')
    const lastPoint = trend[trend.length - 1]
    expect(lastPoint.review).toBe(2)
    expect(lastPoint.ciFailing).toBe(1)
    expect(lastPoint.blocked).toBe(1)
    expect(lastPoint.maxRetries).toBe(1)
    expect(lastPoint.merged).toBe(1)
    expect(lastPoint.missingInfo).toBe(1)
    expect(lastPoint.stale).toBe(1)
    expect(lastPoint.external).toBe(1)
    expect(lastPoint.securityReview).toBe(1)
  })

  it('returns 4 points for lastWeek window', () => {
    const trend = buildTrendData([], 'lastWeek')
    expect(trend).toHaveLength(4)
  })

  it('uses terminalAt for merged issues in lastWeek window', () => {
    const { start, end } = getLastWeekBounds()
    const midLastWeek = new Date(start + (end - start) / 2).toISOString()
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: threeMonthsAgo, terminalAt: midLastWeek, pipelineState: 'autofix-merged' },
      { created: midLastWeek, terminalAt: null, pipelineState: 'autofix-review' }
    ]
    const trend = buildTrendData(issues, 'lastWeek')
    const lastBucket = trend[trend.length - 1]
    expect(lastBucket.merged).toBe(1)
    expect(lastBucket.review).toBe(1)
  })

  it('does not use terminalAt for rolling time windows', () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: old, terminalAt: recent, pipelineState: 'autofix-merged' }
    ]
    const trend = buildTrendData(issues, 'last7')
    const lastBucket = trend[trend.length - 1]
    expect(lastBucket.merged).toBe(0)
  })
})

describe('extractTerminalAt', () => {
  it('returns timestamp when terminal label appears in changelog', () => {
    const changelog = {
      histories: [
        {
          created: '2026-06-18T15:11:11.202+0000',
          items: [
            { field: 'labels', toString: 'jira-autofix jira-autofix-merged' }
          ]
        }
      ]
    }
    expect(extractTerminalAt(changelog, 'autofix-merged')).toBe('2026-06-18T15:11:11.202Z')
  })

  it('returns the latest timestamp when label was added multiple times', () => {
    const changelog = {
      histories: [
        {
          created: '2026-04-21T17:30:05.162+0000',
          items: [
            { field: 'labels', toString: 'jira-autofix jira-autofix-merged' }
          ]
        },
        {
          created: '2026-06-11T15:05:41.099+0000',
          items: [
            { field: 'labels', toString: 'jira-autofix jira-autofix-merged' }
          ]
        }
      ]
    }
    expect(extractTerminalAt(changelog, 'autofix-merged')).toBe('2026-06-11T15:05:41.099Z')
  })

  it('returns null when label is not found in changelog', () => {
    const changelog = {
      histories: [
        {
          created: '2026-06-18T15:11:11.202+0000',
          items: [
            { field: 'labels', toString: 'jira-autofix jira-autofix-review' }
          ]
        }
      ]
    }
    expect(extractTerminalAt(changelog, 'autofix-merged')).toBeNull()
  })

  it('returns null for empty changelog', () => {
    expect(extractTerminalAt(null, 'autofix-merged')).toBeNull()
    expect(extractTerminalAt({}, 'autofix-merged')).toBeNull()
  })

  it('ignores non-label changelog entries', () => {
    const changelog = {
      histories: [
        {
          created: '2026-06-18T15:11:11.202+0000',
          items: [
            { field: 'status', toString: 'Closed' }
          ]
        }
      ]
    }
    expect(extractTerminalAt(changelog, 'autofix-merged')).toBeNull()
  })
})

describe('computeAutofixMetrics with lastWeek', () => {
  it('uses terminalAt for terminal issues in lastWeek window', () => {
    const { start, end } = getLastWeekBounds()
    const midLastWeek = new Date(start + (end - start) / 2).toISOString()
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: threeMonthsAgo, terminalAt: midLastWeek, pipelineState: 'autofix-merged' },
      { created: midLastWeek, terminalAt: null, pipelineState: 'autofix-review' },
      { created: threeMonthsAgo, terminalAt: null, pipelineState: 'autofix-merged' }
    ]
    const m = computeAutofixMetrics(issues, 'lastWeek')
    expect(m.autofixStates.merged).toBe(1)
    expect(m.autofixStates.review).toBe(1)
    expect(m.windowTotal).toBe(2)
  })

  it('does not include terminal issues outside lastWeek window', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: twoWeeksAgo, terminalAt: twoWeeksAgo, pipelineState: 'autofix-merged' }
    ]
    const m = computeAutofixMetrics(issues, 'lastWeek')
    expect(m.autofixStates.merged).toBe(0)
  })
})

describe('getLastWeekBounds', () => {
  it('returns Monday-to-Monday boundaries', () => {
    const { start, end } = getLastWeekBounds()
    const startDate = new Date(start)
    const endDate = new Date(end)
    expect(startDate.getUTCDay()).toBe(1)
    expect(endDate.getUTCDay()).toBe(1)
    expect(end - start).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('end is before now', () => {
    const { end } = getLastWeekBounds()
    expect(end).toBeLessThanOrEqual(Date.now())
  })
})

describe('extractPipelineHistory', () => {
  it('counts CI failure label additions', () => {
    const changelog = {
      histories: [
        { created: '2026-06-10T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-ci-failing' }] },
        { created: '2026-06-11T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-review' }] },
        { created: '2026-06-12T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-ci-failing' }] },
        { created: '2026-06-13T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-merged' }] }
      ]
    }
    const h = extractPipelineHistory(changelog, 'autofix-merged')
    expect(h.ciFailureCount).toBe(2)
    expect(h.terminalAt).toBe('2026-06-13T10:00:00.000Z')
  })

  it('counts review round label additions', () => {
    const changelog = {
      histories: [
        { created: '2026-06-10T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-review' }] },
        { created: '2026-06-11T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-ci-failing' }] },
        { created: '2026-06-12T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-review' }] },
        { created: '2026-06-13T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-review' }] },
        { created: '2026-06-14T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-merged' }] }
      ]
    }
    const h = extractPipelineHistory(changelog, 'autofix-merged')
    expect(h.reviewRoundCount).toBe(3)
  })

  it('detects blocked state', () => {
    const changelog = {
      histories: [
        { created: '2026-06-10T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-blocked' }] },
        { created: '2026-06-12T10:00:00.000Z', items: [{ field: 'labels', toString: 'jira-autofix-merged' }] }
      ]
    }
    const h = extractPipelineHistory(changelog, 'autofix-merged')
    expect(h.wasBlocked).toBe(true)
  })

  it('returns defaults for empty changelog', () => {
    const h = extractPipelineHistory(null, 'autofix-merged')
    expect(h.terminalAt).toBeNull()
    expect(h.ciFailureCount).toBe(0)
    expect(h.reviewRoundCount).toBe(0)
    expect(h.wasBlocked).toBe(false)
  })

  it('handles multiple label changes in a single history entry', () => {
    const changelog = {
      histories: [
        {
          created: '2026-06-10T10:00:00.000Z',
          items: [
            { field: 'labels', toString: 'jira-autofix-review' },
            { field: 'labels', toString: 'jira-autofix-ci-failing' }
          ]
        }
      ]
    }
    const h = extractPipelineHistory(changelog, 'autofix-merged')
    expect(h.reviewRoundCount).toBe(1)
    expect(h.ciFailureCount).toBe(1)
  })
})

describe('computeEffortScore', () => {
  it('returns base score of 1 for a simple merged issue', () => {
    const issue = { pipelineState: 'autofix-merged', created: '2026-06-10T00:00:00Z', terminalAt: '2026-06-11T00:00:00Z', priority: 'Normal' }
    const { effortScore, effortTier } = computeEffortScore(issue)
    expect(effortScore).toBe(1)
    expect(effortTier).toBe('Quick Win')
  })

  it('adds 1 point for CI failures', () => {
    const issue = { pipelineState: 'autofix-merged', ciFailureCount: 2, created: '2026-06-10T00:00:00Z', terminalAt: '2026-06-11T00:00:00Z', priority: 'Normal' }
    const { effortScore } = computeEffortScore(issue)
    expect(effortScore).toBe(2)
  })

  it('adds 1 point per extra review round beyond the first', () => {
    const issue = { pipelineState: 'autofix-merged', reviewRoundCount: 3, created: '2026-06-10T00:00:00Z', terminalAt: '2026-06-11T00:00:00Z', priority: 'Normal' }
    const { effortScore } = computeEffortScore(issue)
    expect(effortScore).toBe(3)
  })

  it('adds 2 points for blocked state', () => {
    const issue = { pipelineState: 'autofix-merged', wasBlocked: true, created: '2026-06-10T00:00:00Z', terminalAt: '2026-06-11T00:00:00Z', priority: 'Normal' }
    const { effortScore } = computeEffortScore(issue)
    expect(effortScore).toBe(3)
  })

  it('adds 1 point for time-to-fix over 7 days', () => {
    const issue = { pipelineState: 'autofix-merged', created: '2026-06-01T00:00:00Z', terminalAt: '2026-06-10T00:00:00Z', priority: 'Normal' }
    const { effortScore } = computeEffortScore(issue)
    expect(effortScore).toBe(2)
  })

  it('adds 2 points for Blocker or Critical priority', () => {
    const issue = { pipelineState: 'autofix-merged', created: '2026-06-10T00:00:00Z', terminalAt: '2026-06-11T00:00:00Z', priority: 'Blocker' }
    const { effortScore, effortTier } = computeEffortScore(issue)
    expect(effortScore).toBe(3)
    expect(effortTier).toBe('Standard Fix')
  })

  it('maps tier boundaries correctly', () => {
    const base = { pipelineState: 'autofix-merged', created: '2026-06-10T00:00:00Z', terminalAt: '2026-06-11T00:00:00Z', priority: 'Normal' }

    expect(computeEffortScore({ ...base }).effortTier).toBe('Quick Win')
    expect(computeEffortScore({ ...base, ciFailureCount: 1 }).effortTier).toBe('Quick Win')
    expect(computeEffortScore({ ...base, wasBlocked: true }).effortTier).toBe('Standard Fix')
    expect(computeEffortScore({ ...base, wasBlocked: true, ciFailureCount: 1 }).effortTier).toBe('Standard Fix')
    expect(computeEffortScore({ ...base, wasBlocked: true, ciFailureCount: 1, reviewRoundCount: 3 }).effortTier).toBe('Complex Fix')
  })

  it('returns null for non-merged issues', () => {
    const issue = { pipelineState: 'autofix-review', priority: 'Major' }
    const { effortScore, effortTier } = computeEffortScore(issue)
    expect(effortScore).toBeNull()
    expect(effortTier).toBeNull()
  })
})

describe('computePriorityBreakdown', () => {
  it('counts issues by priority', () => {
    const issues = [
      { priority: 'Blocker' },
      { priority: 'Major' },
      { priority: 'Major' },
      { priority: 'Undefined' }
    ]
    const result = computePriorityBreakdown(issues)
    expect(result).toEqual({ Blocker: 1, Major: 2, Undefined: 1 })
  })

  it('returns empty object for empty array', () => {
    expect(computePriorityBreakdown([])).toEqual({})
  })
})

describe('computeMedianTimeToFix', () => {
  it('returns median for odd number of merged issues', () => {
    const issues = [
      { pipelineState: 'autofix-merged', created: '2026-06-01T00:00:00Z', terminalAt: '2026-06-02T00:00:00Z' },
      { pipelineState: 'autofix-merged', created: '2026-06-01T00:00:00Z', terminalAt: '2026-06-04T00:00:00Z' },
      { pipelineState: 'autofix-merged', created: '2026-06-01T00:00:00Z', terminalAt: '2026-06-11T00:00:00Z' }
    ]
    expect(computeMedianTimeToFix(issues)).toBe(3)
  })

  it('returns median for even number of merged issues', () => {
    const issues = [
      { pipelineState: 'autofix-merged', created: '2026-06-01T00:00:00Z', terminalAt: '2026-06-03T00:00:00Z' },
      { pipelineState: 'autofix-merged', created: '2026-06-01T00:00:00Z', terminalAt: '2026-06-05T00:00:00Z' }
    ]
    expect(computeMedianTimeToFix(issues)).toBe(3)
  })

  it('returns null when no merged issues', () => {
    const issues = [
      { pipelineState: 'autofix-review', created: '2026-06-01T00:00:00Z', terminalAt: null }
    ]
    expect(computeMedianTimeToFix(issues)).toBeNull()
  })

  it('skips non-merged issues', () => {
    const issues = [
      { pipelineState: 'autofix-rejected', created: '2026-06-01T00:00:00Z', terminalAt: '2026-06-02T00:00:00Z' },
      { pipelineState: 'autofix-merged', created: '2026-06-01T00:00:00Z', terminalAt: '2026-06-06T00:00:00Z' }
    ]
    expect(computeMedianTimeToFix(issues)).toBe(5)
  })
})

describe('getWindowBounds', () => {
  it('returns calendar week bounds for week', () => {
    const { start, end, useTerminalDate } = getWindowBounds('week')
    const startDate = new Date(start)
    expect(startDate.getUTCDay()).toBe(1)
    expect(end).toBeLessThanOrEqual(Date.now() + 1000)
    expect(end).toBeGreaterThan(start)
    expect(useTerminalDate).toBe(false)
  })

  it('returns rolling 7-day bounds for last7', () => {
    const { start, end, useTerminalDate } = getWindowBounds('last7')
    const diff = end - start
    expect(Math.abs(diff - 7 * 24 * 60 * 60 * 1000)).toBeLessThan(1000)
    expect(useTerminalDate).toBe(false)
  })

  it('returns calendar month bounds for month', () => {
    const { start, end, useTerminalDate } = getWindowBounds('month')
    const startDate = new Date(start)
    expect(startDate.getUTCDate()).toBe(1)
    expect(end).toBeLessThanOrEqual(Date.now() + 1000)
    expect(useTerminalDate).toBe(false)
  })

  it('returns previous calendar month bounds for lastMonth', () => {
    const { start, end, useTerminalDate } = getWindowBounds('lastMonth')
    const startDate = new Date(start)
    const endDate = new Date(end)
    expect(startDate.getUTCDate()).toBe(1)
    expect(endDate.getUTCDate()).toBe(1)
    expect(endDate.getUTCMonth()).toBe(new Date().getUTCMonth())
    expect(useTerminalDate).toBe(true)
  })

  it('returns rolling 30-day bounds for last30', () => {
    const { start, end, useTerminalDate } = getWindowBounds('last30')
    const diff = end - start
    expect(Math.abs(diff - 30 * 24 * 60 * 60 * 1000)).toBeLessThan(1000)
    expect(useTerminalDate).toBe(false)
  })

  it('returns rolling 90-day bounds for last90', () => {
    const { start, end, useTerminalDate } = getWindowBounds('last90')
    const diff = end - start
    expect(Math.abs(diff - 90 * 24 * 60 * 60 * 1000)).toBeLessThan(1000)
    expect(useTerminalDate).toBe(false)
  })

  it('uses terminalDate for lastWeek', () => {
    const { useTerminalDate } = getWindowBounds('lastWeek')
    expect(useTerminalDate).toBe(true)
  })
})

describe('computeAutofixMetrics with lastMonth', () => {
  it('uses terminalAt for terminal issues in lastMonth window', () => {
    const { start, end } = getWindowBounds('lastMonth')
    const midLastMonth = new Date(start + (end - start) / 2).toISOString()
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: sixMonthsAgo, terminalAt: midLastMonth, pipelineState: 'autofix-merged' },
      { created: midLastMonth, terminalAt: null, pipelineState: 'autofix-review' },
      { created: sixMonthsAgo, terminalAt: null, pipelineState: 'autofix-merged' }
    ]
    const m = computeAutofixMetrics(issues, 'lastMonth')
    expect(m.autofixStates.merged).toBe(1)
    expect(m.autofixStates.review).toBe(1)
    expect(m.windowTotal).toBe(2)
  })
})

describe('buildTrendData with new windows', () => {
  it('returns 4 points for last7 window', () => {
    const trend = buildTrendData([], 'last7')
    expect(trend).toHaveLength(4)
  })

  it('returns 8 points for last30 window', () => {
    const trend = buildTrendData([], 'last30')
    expect(trend).toHaveLength(8)
  })

  it('returns 8 points for lastMonth window', () => {
    const trend = buildTrendData([], 'lastMonth')
    expect(trend).toHaveLength(8)
  })

  it('returns 8 points for calendar month window', () => {
    const trend = buildTrendData([], 'month')
    expect(trend).toHaveLength(8)
  })

  it('returns 4 points for calendar week window', () => {
    const trend = buildTrendData([], 'week')
    expect(trend).toHaveLength(4)
  })

  it('uses terminalAt for lastMonth window', () => {
    const { start, end } = getWindowBounds('lastMonth')
    const midLastMonth = new Date(start + (end - start) / 2).toISOString()
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: sixMonthsAgo, terminalAt: midLastMonth, pipelineState: 'autofix-merged' }
    ]
    const trend = buildTrendData(issues, 'lastMonth')
    const totalMerged = trend.reduce((s, p) => s + p.merged, 0)
    expect(totalMerged).toBe(1)
  })
})

describe('computeAutofixMetrics new fields', () => {
  const now = new Date()
  const recent = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const mergedAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()

  it('includes priorityBreakdown in metrics', () => {
    const issues = [
      { created: recent, pipelineState: 'autofix-merged', priority: 'Blocker', terminalAt: mergedAt, effortScore: 3, effortTier: 'Standard Fix' },
      { created: recent, pipelineState: 'triage-missing-info', priority: 'Major' }
    ]
    const m = computeAutofixMetrics(issues, 'last7')
    expect(m.priorityBreakdown).toEqual({ Blocker: 1, Major: 1 })
  })

  it('includes medianTimeToFixDays for merged issues', () => {
    const created = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created, pipelineState: 'autofix-merged', priority: 'Major', terminalAt: mergedAt, effortScore: 1, effortTier: 'Quick Win' }
    ]
    const m = computeAutofixMetrics(issues, 'last7')
    expect(m.medianTimeToFixDays).toBeGreaterThan(0)
  })

  it('includes effortBreakdown and totalImpactScore', () => {
    const issues = [
      { created: recent, pipelineState: 'autofix-merged', priority: 'Major', terminalAt: mergedAt, effortScore: 1, effortTier: 'Quick Win' },
      { created: recent, pipelineState: 'autofix-merged', priority: 'Blocker', terminalAt: mergedAt, effortScore: 4, effortTier: 'Standard Fix' },
      { created: recent, pipelineState: 'autofix-merged', priority: 'Critical', terminalAt: mergedAt, effortScore: 6, effortTier: 'Complex Fix' }
    ]
    const m = computeAutofixMetrics(issues, 'last7')
    expect(m.effortBreakdown).toEqual({ quickWin: 1, standardFix: 1, complexFix: 1 })
    expect(m.totalImpactScore).toBe(11)
  })
})

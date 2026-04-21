import { describe, it, expect } from 'vitest'

const {
  classifyIssue,
  processIssue,
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

  it('returns autofix-researched for jira-autofix-researched', () => {
    expect(classifyIssue(['jira-autofix-researched'])).toBe('autofix-researched')
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

  it('returns unknown when no pipeline labels present', () => {
    expect(classifyIssue(['some-other-label'])).toBe('unknown')
  })

  it('prioritizes autofix-merged over other labels', () => {
    expect(classifyIssue(['jira-autofix-merged', 'jira-autofix-review', 'jira-autofix'])).toBe('autofix-merged')
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
    { created: old, pipelineState: 'autofix-merged', components: ['A'] }
  ]

  it('computes metrics for a week window', () => {
    const m = computeAutofixMetrics(issues, 'week')
    expect(m.windowTotal).toBe(5)
    expect(m.triageVerdicts.ready).toBe(3)
    expect(m.triageVerdicts.missingInfo).toBe(1)
    expect(m.triageVerdicts.notFixable).toBe(1)
    expect(m.autofixStates.merged).toBe(1)
    expect(m.autofixStates.review).toBe(1)
    expect(m.autofixStates.rejected).toBe(1)
    expect(m.totalIssues).toBe(6)
  })

  it('computes success rate from terminal states (merged / (merged + rejected + maxRetries))', () => {
    const m = computeAutofixMetrics(issues, 'week')
    // merged=1, rejected=1, maxRetries=0 → terminal=2, successRate = 1/2 = 50%
    expect(m.successRate).toBe(50)
  })

  it('returns zero success rate when no terminal autofix issues in window', () => {
    const m = computeAutofixMetrics([], 'week')
    expect(m.successRate).toBe(0)
  })
})

describe('buildTrendData', () => {
  it('returns weekly data points with merged field', () => {
    const issues = [
      { created: new Date().toISOString(), pipelineState: 'autofix-merged', components: [] }
    ]
    const trend = buildTrendData(issues, 'week')
    expect(trend).toHaveLength(4)
    expect(trend[0]).toHaveProperty('date')
    expect(trend[0]).toHaveProperty('triaged')
    expect(trend[0]).toHaveProperty('autofixed')
    expect(trend[0]).toHaveProperty('merged')
  })

  it('returns 13 points for 3months window', () => {
    const trend = buildTrendData([], '3months')
    expect(trend).toHaveLength(13)
  })
})

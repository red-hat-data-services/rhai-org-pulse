import { describe, it, expect } from 'vitest'

const {
  classifyIssue,
  processIssue,
  computeAutofixMetrics,
  buildTrendData
} = require('../../server/jira/autofix-fetcher')

describe('classifyIssue', () => {
  it('returns autofix-done when jira-autofix-done is present', () => {
    expect(classifyIssue(['jira-autofix-done', 'jira-autofix'])).toBe('autofix-done')
  })

  it('returns autofix-review when jira-autofix-review is present', () => {
    expect(classifyIssue(['jira-autofix-review'])).toBe('autofix-review')
  })

  it('returns autofix-pending when jira-autofix-pending is present', () => {
    expect(classifyIssue(['jira-autofix-pending'])).toBe('autofix-pending')
  })

  it('returns autofix-needs-info when jira-autofix-needs-info is present', () => {
    expect(classifyIssue(['jira-autofix-needs-info'])).toBe('autofix-needs-info')
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

  it('returns triage-needs-info for jira-triage-needs-info', () => {
    expect(classifyIssue(['jira-triage-needs-info'])).toBe('triage-needs-info')
  })

  it('returns triage-pending for jira-triage-pending', () => {
    expect(classifyIssue(['jira-triage-pending'])).toBe('triage-pending')
  })

  it('returns unknown when no pipeline labels present', () => {
    expect(classifyIssue(['some-other-label'])).toBe('unknown')
  })

  it('prioritizes autofix-done over other labels', () => {
    expect(classifyIssue(['jira-autofix-done', 'jira-autofix-review', 'jira-autofix'])).toBe('autofix-done')
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
    { created: recent, pipelineState: 'autofix-done', components: ['A'] },
    { created: recent, pipelineState: 'autofix-review', components: ['A'] },
    { created: recent, pipelineState: 'triage-needs-info', components: ['B'] },
    { created: recent, pipelineState: 'triage-not-fixable', components: ['B'] },
    { created: old, pipelineState: 'autofix-done', components: ['A'] }
  ]

  it('computes metrics for a week window', () => {
    const m = computeAutofixMetrics(issues, 'week')
    expect(m.windowTotal).toBe(4)
    expect(m.triageVerdicts.ready).toBe(2)
    expect(m.triageVerdicts.needsInfo).toBe(1)
    expect(m.triageVerdicts.notFixable).toBe(1)
    expect(m.autofixStates.done).toBe(1)
    expect(m.autofixStates.review).toBe(1)
    expect(m.totalIssues).toBe(5)
  })

  it('computes success rate from terminal states only (done + blocked)', () => {
    const m = computeAutofixMetrics(issues, 'week')
    expect(m.autofixTotal).toBe(2)
    // done=1, needsInfo=0 → terminal=1, successRate = 1/1 = 100%
    // in-review issues don't count against the rate
    expect(m.successRate).toBe(100)
  })

  it('returns zero success rate when no autofix issues in window', () => {
    const m = computeAutofixMetrics([], 'week')
    expect(m.successRate).toBe(0)
  })
})

describe('buildTrendData', () => {
  it('returns weekly data points', () => {
    const issues = [
      { created: new Date().toISOString(), pipelineState: 'autofix-done', components: [] }
    ]
    const trend = buildTrendData(issues, 'week')
    expect(trend).toHaveLength(4)
    expect(trend[0]).toHaveProperty('date')
    expect(trend[0]).toHaveProperty('triaged')
    expect(trend[0]).toHaveProperty('autofixed')
    expect(trend[0]).toHaveProperty('done')
  })

  it('returns 13 points for 3months window', () => {
    const trend = buildTrendData([], '3months')
    expect(trend).toHaveLength(13)
  })
})


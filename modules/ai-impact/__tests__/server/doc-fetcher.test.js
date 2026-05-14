import { describe, it, expect } from 'vitest'

const {
  processIssue,
  extractLabelAdditionEvents,
  extractMrUrlFromAdf,
  computeDocMetrics,
  buildDocTrendData
} = require('../../server/jira/doc-fetcher')

const DEFAULT_CONFIG = {
  docContributedLabel: 'ai1st-doc-contributed',
  docInvokedLabel: 'ai1st-doc-invoked'
}

describe('processIssue', () => {
  it('extracts fields and detects doc labels', () => {
    const issue = {
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Feature needing docs',
        status: { name: 'Review' },
        labels: ['ai1st-doc-contributed', 'ai1st-doc-invoked', 'other'],
        created: '2026-04-10T10:00:00Z',
        updated: '2026-05-01T10:00:00Z'
      },
      changelog: {
        histories: [
          {
            created: '2026-04-20T12:00:00Z',
            items: [{
              field: 'labels',
              fromString: 'other',
              toString: 'other ai1st-doc-invoked'
            }]
          },
          {
            created: '2026-04-25T14:00:00Z',
            items: [{
              field: 'labels',
              fromString: 'other ai1st-doc-invoked',
              toString: 'other ai1st-doc-invoked ai1st-doc-contributed'
            }]
          }
        ]
      }
    }

    const result = processIssue(issue, DEFAULT_CONFIG)
    expect(result.key).toBe('RHAISTRAT-100')
    expect(result.summary).toBe('Feature needing docs')
    expect(result.status).toBe('Review')
    expect(result.hasDocContributed).toBe(true)
    expect(result.hasDocInvoked).toBe(true)
    expect(result.docContributedDate).toBe('2026-04-25T14:00:00Z')
    expect(result.docInvokedDate).toBe('2026-04-20T12:00:00Z')
    expect(result.ccsEpic).toBeNull()
    expect(result.mrLinks).toEqual([])
  })

  it('handles issue without doc labels', () => {
    const issue = {
      key: 'RHAISTRAT-200',
      fields: {
        summary: 'Untouched feature',
        status: { name: 'Review' },
        labels: ['other-label'],
        created: '2026-04-15T10:00:00Z',
        updated: '2026-04-15T10:00:00Z'
      },
      changelog: null
    }

    const result = processIssue(issue, DEFAULT_CONFIG)
    expect(result.hasDocContributed).toBe(false)
    expect(result.hasDocInvoked).toBe(false)
    expect(result.docContributedDate).toBeNull()
    expect(result.docInvokedDate).toBeNull()
  })

  it('handles missing optional fields', () => {
    const issue = {
      key: 'RHAISTRAT-300',
      fields: {
        summary: 'Minimal issue',
        status: null,
        labels: [],
        created: '2026-04-10T10:00:00Z',
        updated: null
      },
      changelog: null
    }

    const result = processIssue(issue, DEFAULT_CONFIG)
    expect(result.status).toBe('Unknown')
    expect(result.labels).toEqual([])
  })
})

describe('extractLabelAdditionEvents', () => {
  it('returns empty array for null changelog', () => {
    expect(extractLabelAdditionEvents(null, ['ai1st-doc-invoked'], 'KEY-1')).toEqual([])
    expect(extractLabelAdditionEvents(undefined, ['ai1st-doc-invoked'], 'KEY-1')).toEqual([])
  })

  it('returns empty array for changelog with no label changes', () => {
    const changelog = {
      histories: [{
        created: '2026-04-10T10:00:00Z',
        items: [{ field: 'status', fromString: 'Open', toString: 'In Progress' }]
      }]
    }
    expect(extractLabelAdditionEvents(changelog, ['ai1st-doc-invoked'], 'KEY-1')).toEqual([])
  })

  it('detects label additions', () => {
    const changelog = {
      histories: [{
        created: '2026-04-15T09:00:00Z',
        items: [{
          field: 'labels',
          fromString: '',
          toString: 'ai1st-doc-invoked'
        }]
      }]
    }

    const events = extractLabelAdditionEvents(changelog, ['ai1st-doc-invoked', 'ai1st-doc-contributed'], 'KEY-1')
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      label: 'ai1st-doc-invoked',
      date: '2026-04-15T09:00:00Z',
      issueKey: 'KEY-1'
    })
  })

  it('detects multiple label additions in one changelog entry', () => {
    const changelog = {
      histories: [{
        created: '2026-04-15T09:00:00Z',
        items: [{
          field: 'labels',
          fromString: '',
          toString: 'ai1st-doc-invoked ai1st-doc-contributed'
        }]
      }]
    }

    const events = extractLabelAdditionEvents(changelog, ['ai1st-doc-invoked', 'ai1st-doc-contributed'], 'KEY-1')
    expect(events).toHaveLength(2)
  })

  it('ignores label removals', () => {
    const changelog = {
      histories: [{
        created: '2026-04-15T09:00:00Z',
        items: [{
          field: 'labels',
          fromString: 'ai1st-doc-invoked',
          toString: ''
        }]
      }]
    }

    const events = extractLabelAdditionEvents(changelog, ['ai1st-doc-invoked'], 'KEY-1')
    expect(events).toHaveLength(0)
  })

  it('ignores labels not in target list', () => {
    const changelog = {
      histories: [{
        created: '2026-04-15T09:00:00Z',
        items: [{
          field: 'labels',
          fromString: '',
          toString: 'some-other-label'
        }]
      }]
    }

    const events = extractLabelAdditionEvents(changelog, ['ai1st-doc-invoked'], 'KEY-1')
    expect(events).toHaveLength(0)
  })
})

describe('extractMrUrlFromAdf', () => {
  it('returns null for null/undefined input', () => {
    expect(extractMrUrlFromAdf(null)).toBeNull()
    expect(extractMrUrlFromAdf(undefined)).toBeNull()
  })

  it('extracts URL from ADF document', () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'https://gitlab.example.com/merge_requests/123',
          marks: [{
            type: 'link',
            attrs: { href: 'https://gitlab.example.com/merge_requests/123' }
          }]
        }]
      }]
    }

    expect(extractMrUrlFromAdf(adf)).toBe('https://gitlab.example.com/merge_requests/123')
  })

  it('returns null for ADF without links', () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'just plain text'
        }]
      }]
    }

    expect(extractMrUrlFromAdf(adf)).toBeNull()
  })

  it('returns first URL when multiple links exist', () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'first',
            marks: [{ type: 'link', attrs: { href: 'https://first.example.com' } }]
          },
          {
            type: 'text',
            text: 'second',
            marks: [{ type: 'link', attrs: { href: 'https://second.example.com' } }]
          }
        ]
      }]
    }

    expect(extractMrUrlFromAdf(adf)).toBe('https://first.example.com')
  })
})

describe('computeDocMetrics', () => {
  it('computes metrics from issues and label events', () => {
    const issues = [
      { hasDocContributed: true, hasDocInvoked: true },
      { hasDocContributed: true, hasDocInvoked: true },
      { hasDocContributed: false, hasDocInvoked: true },
      { hasDocContributed: false, hasDocInvoked: false },
      { hasDocContributed: false, hasDocInvoked: false }
    ]

    const now = new Date()
    const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

    const labelEvents = [
      { label: 'ai1st-doc-invoked', date: recent, issueKey: 'K-1' },
      { label: 'ai1st-doc-contributed', date: recent, issueKey: 'K-1' },
      { label: 'ai1st-doc-invoked', date: old, issueKey: 'K-2' }
    ]

    const m = computeDocMetrics(issues, labelEvents)
    expect(m.demandCount).toBe(5)
    expect(m.coverageCount).toBe(2)
    expect(m.coverageRate).toBe(40)
    expect(m.invokedCount).toBe(3)
    expect(m.totalLabelEvents).toBe(2)
  })

  it('handles empty issues', () => {
    const m = computeDocMetrics([], [])
    expect(m.demandCount).toBe(0)
    expect(m.coverageCount).toBe(0)
    expect(m.coverageRate).toBe(0)
    expect(m.invokedCount).toBe(0)
    expect(m.totalLabelEvents).toBe(0)
  })
})

describe('buildDocTrendData', () => {
  it('returns 30 daily data points with all graph fields', () => {
    const trend = buildDocTrendData([], [])
    expect(trend).toHaveLength(30)
    expect(trend[0]).toHaveProperty('date')
    expect(trend[0]).toHaveProperty('demand')
    expect(trend[0]).toHaveProperty('coverageCount')
    expect(trend[0]).toHaveProperty('coverageRate')
    expect(trend[0]).toHaveProperty('invokedRate')
    expect(trend[0]).toHaveProperty('contributedRate')
    expect(trend[0]).toHaveProperty('activityRate')
    expect(trend[0]).toHaveProperty('activityAccel')
  })

  it('computes demand from issues created on or before each day', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: fiveDaysAgo, hasDocContributed: false, docContributedDate: null },
      { created: twoDaysAgo, hasDocContributed: false, docContributedDate: null }
    ]

    const trend = buildDocTrendData(issues, [])
    // 6 days ago: 0 issues existed yet
    expect(trend[trend.length - 7].demand).toBe(0)
    // 5 days ago: 1 issue existed
    expect(trend[trend.length - 6].demand).toBe(1)
    // today: both issues exist
    expect(trend[trend.length - 1].demand).toBe(2)
  })

  it('computes coverage rate from doc-contributed dates', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const issues = [
      { created: tenDaysAgo, hasDocContributed: true, docContributedDate: fiveDaysAgo },
      { created: tenDaysAgo, hasDocContributed: false, docContributedDate: null }
    ]

    const trend = buildDocTrendData(issues, [])
    // 6 days ago: 2 issues exist, 0 contributed -> 0%
    expect(trend[trend.length - 7].coverageRate).toBe(0)
    // today: 2 issues exist, 1 contributed -> 50%
    expect(trend[trend.length - 1].coverageRate).toBe(50)
  })

  it('computes rolling average rates for tool activity', () => {
    const today = new Date().toISOString().slice(0, 10)
    const labelEvents = [
      { label: 'ai1st-doc-invoked', date: `${today}T09:00:00Z`, issueKey: 'K-1' },
      { label: 'ai1st-doc-invoked', date: `${today}T14:00:00Z`, issueKey: 'K-2' },
      { label: 'ai1st-doc-contributed', date: `${today}T16:00:00Z`, issueKey: 'K-1' }
    ]

    const trend = buildDocTrendData([], labelEvents)
    const todayPoint = trend[trend.length - 1]
    expect(todayPoint.date).toBe(today)
    expect(todayPoint.invokedRate).toBeGreaterThan(0)
    expect(todayPoint.contributedRate).toBeGreaterThan(0)
    expect(todayPoint.activityRate).toBeGreaterThan(0)
  })

  it('shows positive acceleration when events start', () => {
    const today = new Date().toISOString().slice(0, 10)
    const labelEvents = [
      { label: 'ai1st-doc-invoked', date: `${today}T09:00:00Z`, issueKey: 'K-1' }
    ]

    const trend = buildDocTrendData([], labelEvents)
    const todayPoint = trend[trend.length - 1]
    expect(todayPoint.activityAccel).toBeGreaterThan(0)
  })

  it('returns zeros for days without events or issues', () => {
    const trend = buildDocTrendData([], [])
    for (const point of trend) {
      expect(point.demand).toBe(0)
      expect(point.coverageRate).toBe(0)
      expect(point.invokedRate).toBe(0)
      expect(point.contributedRate).toBe(0)
      expect(point.activityRate).toBe(0)
      expect(point.activityAccel).toBe(0)
    }
  })
})

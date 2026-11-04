import { describe, expect, it } from 'vitest'

const {
  buildTrendResponse,
  buildTrendSnapshot,
  normalizeTrendSnapshot,
  sixMonthWindow
} = require('../../../server/tech-debt/trends')

function rawIssue(key, overrides = {}) {
  return {
    key,
    fields: {
      issuetype: { name: 'Bug' },
      components: [{ name: 'AI Gateway' }],
      created: '2026-07-10T12:00:00.000Z',
      resolutiondate: null,
      labels: [],
      reporter: { accountId: 'person-1', displayName: 'Engineer' },
      customfield_10847: null,
      ...overrides
    }
  }
}

describe('Tech Debt trend snapshot', function () {
  it('uses the current UTC month and previous five calendar months', function () {
    expect(sixMonthWindow(new Date('2026-01-15T23:59:00.000Z'))).toEqual({
      months: ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'],
      startDate: '2025-08-01',
      endExclusive: '2026-02-01',
      timezone: 'UTC'
    })
  })

  it('deduplicates Jira pages and classifies Bug and Vulnerability events', function () {
    const now = new Date('2026-10-29T06:00:00.000Z')
    const snapshot = buildTrendSnapshot([
      rawIssue('RHAI-1', {
        components: [{ name: 'AI Gateway' }, { name: 'Model Serving' }],
        created: '2026-08-01T00:00:00.000Z',
        resolutiondate: '2026-10-20T10:00:00.000Z'
      }),
      rawIssue('RHAI-1'),
      rawIssue('RHAI-2', {
        issuetype: { name: 'Bug' },
        labels: ['test-failed'],
        reporter: { accountId: 'bot', displayName: 'DevTestOps Jira Bot' },
        created: '2026-09-01T00:00:00.000Z'
      }),
      rawIssue('RHAI-3', {
        issuetype: { name: 'Vulnerability' },
        components: [{ name: 'Model Serving' }],
        created: '2026-04-01T00:00:00.000Z',
        resolutiondate: '2026-10-01T00:00:00.000Z'
      })
    ], new Set(['RHAI-1']), now)

    expect(snapshot.issueCount).toBe(3)
    expect(snapshot.events).toEqual([
      expect.objectContaining({ key: 'RHAI-1', category: 'customer-linked', createdMonth: '2026-08', resolvedMonth: '2026-10' }),
      expect.objectContaining({ key: 'RHAI-2', category: 'devtestops-e2e', createdMonth: '2026-09' }),
      expect.objectContaining({ key: 'RHAI-3', category: 'vulnerability', createdMonth: null, resolvedMonth: '2026-10' })
    ])
  })

  it('counts an issue in each component panel but once in overall totals', function () {
    const snapshot = buildTrendSnapshot([
      rawIssue('RHAI-1', {
        components: [{ name: 'AI Gateway' }, { name: 'Model Serving' }],
        created: '2026-08-01T00:00:00.000Z',
        resolutiondate: '2026-10-20T10:00:00.000Z'
      }),
      rawIssue('RHAI-2', {
        components: [{ name: 'AI Gateway' }],
        created: '2026-09-01T00:00:00.000Z'
      })
    ], new Set(), new Date('2026-10-29T06:00:00.000Z'))

    const response = buildTrendResponse(snapshot, ['AI Gateway', 'Model Serving'], null, new Date('2026-10-29T07:00:00.000Z'))
    expect(response.totals).toEqual({ received: 2, resolved: 1 })
    expect(response.components.map(function (panel) { return panel.totals })).toEqual([
      { received: 2, resolved: 1 },
      { received: 1, resolved: 1 }
    ])
    expect(response.components[0].months.find(function (month) { return month.month === '2026-08' }).received.categories['component-team']).toBe(1)
  })

  it('filters categories and events by issue type', function () {
    const snapshot = buildTrendSnapshot([
      rawIssue('RHAI-1'),
      rawIssue('RHAI-2', { issuetype: { name: 'Vulnerability' } })
    ], new Set(), new Date('2026-10-29T06:00:00.000Z'))
    const response = buildTrendResponse(snapshot, ['AI Gateway'], 'Vulnerability')

    expect(response.totals.received).toBe(1)
    expect(response.categories.map(function (category) { return category.code })).toEqual(['vulnerability'])
  })

  it('rejects malformed snapshots and marks old snapshots stale', function () {
    expect(normalizeTrendSnapshot({ schemaVersion: 1, generatedAt: 'bad', events: [] }).error).toContain('generatedAt')
    const snapshot = buildTrendSnapshot([rawIssue('RHAI-1')], new Set(), new Date('2026-10-20T00:00:00.000Z'))
    const response = buildTrendResponse(snapshot, ['AI Gateway'], null, new Date('2026-10-23T00:00:01.000Z'))
    expect(response.stale).toBe(true)
    expect(response.warning).toContain('48 hours')
  })
})

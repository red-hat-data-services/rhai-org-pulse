import { describe, expect, it } from 'vitest'

const {
  buildTrendResponse,
  buildTrendSnapshot,
  buildWeeklyBugTrendResponse,
  isoWeekId,
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

  it('uses ISO weeks in UTC across year boundaries and timestamp offsets', function () {
    expect(isoWeekId('2026-01-01T00:00:00.000Z')).toBe('2026-W01')
    expect(isoWeekId('2027-01-01T12:00:00.000Z')).toBe('2026-W53')
    expect(isoWeekId('2026-01-05T00:30:00+14:00')).toBe('2026-W01')
    expect(isoWeekId('2026-01-05T00:30:00-10:00')).toBe('2026-W02')
  })

  it('precomputes zero-filled weekly Bug totals across all component states', function () {
    const snapshot = buildTrendSnapshot([
      rawIssue('RHAI-MULTI', {
        components: [{ name: 'AI Gateway' }, { name: 'Model Serving' }],
        created: '2026-10-05T12:00:00.000Z',
        resolutiondate: '2026-10-19T12:00:00.000Z'
      }),
      rawIssue('RHAI-MULTI', { created: '2026-10-06T12:00:00.000Z' }),
      rawIssue('RHAI-EMPTY', {
        components: [],
        created: '2026-10-06T12:00:00.000Z'
      }),
      rawIssue('RHAI-BOTH', {
        created: '2026-10-12T12:00:00.000Z',
        resolutiondate: '2026-10-15T12:00:00.000Z'
      }),
      rawIssue('RHAI-REOPENED', {
        created: '2026-10-20T12:00:00.000Z',
        resolutiondate: null
      }),
      rawIssue('RHAI-CVE', {
        issuetype: { name: 'Vulnerability' },
        created: '2026-10-05T12:00:00.000Z',
        resolutiondate: '2026-10-20T12:00:00.000Z'
      })
    ], new Set(), new Date('2026-10-29T06:00:00.000Z'))

    expect(snapshot.weeklyBugs.weeks[0]).toEqual({
      week: '2026-W18',
      startDate: '2026-04-27',
      created: 0,
      resolved: 0
    })
    expect(snapshot.weeklyBugs.weeks.at(-1).week).toBe('2026-W44')
    expect(snapshot.weeklyBugs.throughDate).toBe('2026-10-29')
    expect(snapshot.weeklyBugs.totals).toEqual({ created: 4, resolved: 2 })
    expect(snapshot.weeklyBugs.weeks.find(function (week) { return week.week === '2026-W42' })).toEqual(
      expect.objectContaining({ created: 1, resolved: 1 })
    )

    const response = buildWeeklyBugTrendResponse(snapshot, new Date('2026-10-29T07:00:00.000Z'))
    expect(response.issueType).toBe('Bug')
    expect(response.componentScope).toBe('all')
    expect(response.includeNoComponent).toBe(true)
    expect(response.totals).toEqual({ created: 4, resolved: 2 })
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

  it('preserves componentless events and combines them with named component panels', function () {
    const snapshot = buildTrendSnapshot([
      rawIssue('RHAI-NAMED', {
        components: [{ name: 'AI Gateway' }],
        created: '2026-08-01T00:00:00.000Z'
      }),
      rawIssue('RHAI-EMPTY', {
        components: [],
        created: '2026-09-01T00:00:00.000Z',
        resolutiondate: '2026-10-20T10:00:00.000Z'
      })
    ], new Set(), new Date('2026-10-29T06:00:00.000Z'))

    expect(snapshot.events.find(function (event) { return event.key === 'RHAI-EMPTY' }).components).toEqual([])
    const normalized = normalizeTrendSnapshot(snapshot)
    expect(normalized.error).toBeUndefined()

    const response = buildTrendResponse(
      normalized.snapshot,
      ['AI Gateway'],
      null,
      new Date('2026-10-29T07:00:00.000Z'),
      true
    )
    expect(response.totals).toEqual({ received: 2, resolved: 1 })
    expect(response.includeNoComponent).toBe(true)
    expect(response.components).toEqual([
      expect.objectContaining({ component: 'AI Gateway', noComponent: false, totals: { received: 1, resolved: 0 } }),
      expect.objectContaining({ component: 'No component', noComponent: true, totals: { received: 1, resolved: 1 } })
    ])
  })

  it('classifies the expanded Bug source taxonomy', function () {
    const snapshot = buildTrendSnapshot([
      rawIssue('RHAI-DASHBOARD', { labels: ['cypress_found_bug'] }),
      rawIssue('RHAI-BUILD', { labels: ['dsc-not-ready'] }),
      rawIssue('RHAI-SNYK', {
        labels: ['snyk', 'dependency'],
        reporter: { accountId: 'automation', displayName: 'RHOAIENG AutomationBot' }
      }),
      rawIssue('RHAI-OPERATOR', {
        labels: ['odh-operator-auto-e2e-blocker'],
        reporter: { accountId: 'automation', displayName: 'RHOAIENG AutomationBot' }
      }),
      rawIssue('RHAI-AUTOMATION', {
        reporter: { accountId: 'automation', displayName: 'RHOAIENG AutomationBot' }
      })
    ], new Set(), new Date('2026-10-29T06:00:00.000Z'))

    expect(Object.fromEntries(snapshot.events.map(function (event) { return [event.key, event.category] }))).toEqual({
      'RHAI-AUTOMATION': 'unclassified-automation',
      'RHAI-BUILD': 'build-cannot-run',
      'RHAI-DASHBOARD': 'dashboard-integration-e2e',
      'RHAI-OPERATOR': 'operator-e2e',
      'RHAI-SNYK': 'snyk'
    })
  })

  it('continues to accept stored snapshots using the legacy devtestops-e2e category code', function () {
    const normalized = normalizeTrendSnapshot({
      schemaVersion: 1,
      generatedAt: '2026-10-29T06:00:00.000Z',
      window: {
        months: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
        startDate: '2026-05-01',
        endExclusive: '2026-11-01'
      },
      events: [{
        key: 'RHAI-1',
        issueType: 'Bug',
        category: 'devtestops-e2e',
        components: ['AI Gateway'],
        createdMonth: '2026-10',
        resolvedMonth: null
      }]
    })

    expect(normalized.error).toBeUndefined()
    expect(normalized.snapshot.events[0].category).toBe('devtestops-e2e')
    expect(normalized.snapshot.weeklyBugs).toBeUndefined()
    expect(buildWeeklyBugTrendResponse(normalized.snapshot)).toBeNull()
  })

  it('rejects malformed weekly totals without invalidating snapshots that omit weekly data', function () {
    const snapshot = buildTrendSnapshot([
      rawIssue('RHAI-1', { created: '2026-10-01T00:00:00.000Z' })
    ], new Set(), new Date('2026-10-29T06:00:00.000Z'))
    snapshot.weeklyBugs.totals.created += 1

    expect(normalizeTrendSnapshot(snapshot).error).toContain('weeklyBugs.totals')

    delete snapshot.weeklyBugs
    expect(normalizeTrendSnapshot(snapshot).error).toBeUndefined()
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

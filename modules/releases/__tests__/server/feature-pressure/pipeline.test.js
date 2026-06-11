import { describe, it, expect } from 'vitest'

const {
  normalizeIssue,
  normalizeFeature,
  normalizeRfe,
  toMonth,
  nextMonth,
  generateMonthRange,
  lookbackDate,
  classifyByMonth,
  computeComponentPressure,
  computeRfePipeline,
  computeBacklogHalfLife,
  buildHeatmapMatrix,
  computeTrend,
  computeScorecard,
  jqlUrl,
  quoteComponent,
  sanitizeInfinity,
  RFE_ACCEPTED,
  RFE_PENDING
} = require('../../../server/feature-pressure/routes')

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeIssue(overrides) {
  var fields = Object.assign({
    summary: 'Test feature',
    status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
    components: [{ name: 'Dashboard' }],
    created: '2026-03-15T10:00:00.000Z',
    resolutiondate: null
  }, (overrides && overrides.fields) || {})
  return Object.assign({
    key: 'RHAISTRAT-100',
    fields: fields
  }, overrides ? { key: overrides.key || 'RHAISTRAT-100' } : {})
}

function makeRfeIssue(overrides) {
  var fields = Object.assign({
    summary: 'Test RFE',
    status: { name: 'New', statusCategory: { name: 'To Do' } },
    components: [{ name: 'Serving' }],
    created: '2026-03-10T10:00:00.000Z',
    resolutiondate: null
  }, (overrides && overrides.fields) || {})
  return Object.assign({
    key: 'RHAIRFE-200',
    fields: fields
  }, overrides ? { key: overrides.key || 'RHAIRFE-200' } : {})
}

function makeFeature(key, comp, created, resolved, status, statusCategory) {
  return {
    key: key,
    url: 'https://redhat.atlassian.net/browse/' + key,
    summary: 'Feature ' + key,
    status: status || 'In Progress',
    statusCategory: statusCategory || 'In Progress',
    components: Array.isArray(comp) ? comp : [comp],
    created: created,
    resolved: resolved || null
  }
}

function makeRfe(key, comp, status, created) {
  return {
    key: key,
    url: 'https://redhat.atlassian.net/browse/' + key,
    summary: 'RFE ' + key,
    status: status,
    statusCategory: 'To Do',
    components: Array.isArray(comp) ? comp : [comp],
    created: created || '2026-03-01T00:00:00.000Z',
    resolved: null
  }
}

// ---------------------------------------------------------------------------
// Helper tests
// ---------------------------------------------------------------------------

describe('toMonth', function () {
  it('extracts YYYY-MM from ISO date string', function () {
    expect(toMonth('2026-03-15T10:00:00.000Z')).toBe('2026-03')
  })

  it('pads single-digit months', function () {
    expect(toMonth('2026-01-05T00:00:00.000Z')).toBe('2026-01')
  })

  it('returns null for null/undefined/empty', function () {
    expect(toMonth(null)).toBeNull()
    expect(toMonth(undefined)).toBeNull()
    expect(toMonth('')).toBeNull()
  })

  it('returns null for invalid date strings', function () {
    expect(toMonth('not-a-date')).toBeNull()
  })
})

describe('nextMonth', function () {
  it('increments month within a year', function () {
    expect(nextMonth('2026-03')).toBe('2026-04')
  })

  it('rolls over December to January of next year', function () {
    expect(nextMonth('2026-12')).toBe('2027-01')
  })

  it('pads single-digit months', function () {
    expect(nextMonth('2026-08')).toBe('2026-09')
    expect(nextMonth('2026-09')).toBe('2026-10')
  })
})

describe('generateMonthRange', function () {
  it('generates correct number of months', function () {
    var range = generateMonthRange(6)
    expect(range).toHaveLength(6)
  })

  it('ends with the current month', function () {
    var range = generateMonthRange(3)
    var now = new Date()
    var m = now.getMonth() + 1
    var expected = now.getFullYear() + '-' + (m < 10 ? '0' : '') + m
    expect(range[range.length - 1]).toBe(expected)
  })

  it('returns months in ascending order', function () {
    var range = generateMonthRange(6)
    for (var i = 1; i < range.length; i++) {
      expect(range[i] > range[i - 1]).toBe(true)
    }
  })
})

describe('lookbackDate', function () {
  it('returns a date string in YYYY-MM-DD format', function () {
    var result = lookbackDate(12)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('jqlUrl', function () {
  it('encodes JQL into a search URL', function () {
    var url = jqlUrl('project = TEST')
    expect(url).toContain('https://redhat.atlassian.net/issues/?jql=')
    expect(url).toContain(encodeURIComponent('project = TEST'))
  })
})

describe('quoteComponent', function () {
  it('wraps component name in double quotes', function () {
    expect(quoteComponent('Dashboard')).toBe('"Dashboard"')
  })

  it('escapes quotes within names', function () {
    expect(quoteComponent('AI "Core"')).toBe('"AI \\"Core\\""')
  })
})

// ---------------------------------------------------------------------------
// normalizeFeature
// ---------------------------------------------------------------------------

describe('normalizeFeature', function () {
  it('extracts key, url, summary, status, components, created, resolved', function () {
    var result = normalizeFeature(makeIssue())
    expect(result.key).toBe('RHAISTRAT-100')
    expect(result.url).toContain('/browse/RHAISTRAT-100')
    expect(result.summary).toBe('Test feature')
    expect(result.status).toBe('In Progress')
    expect(result.components).toEqual(['Dashboard'])
    expect(result.created).toBe('2026-03-15T10:00:00.000Z')
    expect(result.resolved).toBeNull()
  })

  it('truncates long summaries to 120 chars', function () {
    var result = normalizeFeature(makeIssue({ fields: { summary: 'A'.repeat(200) } }))
    expect(result.summary.length).toBe(120)
  })

  it('handles missing components (empty array)', function () {
    var result = normalizeFeature(makeIssue({ fields: { components: [] } }))
    expect(result.components).toEqual([])
  })

  it('handles null components field', function () {
    var result = normalizeFeature(makeIssue({ fields: { components: null } }))
    expect(result.components).toEqual([])
  })

  it('handles missing fields gracefully', function () {
    var result = normalizeFeature({ key: 'X-1', fields: {} })
    expect(result.summary).toBe('')
    expect(result.status).toBe('')
    expect(result.components).toEqual([])
    expect(result.created).toBeNull()
    expect(result.resolved).toBeNull()
  })

  it('handles completely missing fields object', function () {
    var result = normalizeFeature({ key: 'X-1' })
    expect(result.key).toBe('X-1')
    expect(result.summary).toBe('')
  })

  it('extracts resolved date when present', function () {
    var result = normalizeFeature(makeIssue({ fields: { resolutiondate: '2026-04-01T00:00:00.000Z' } }))
    expect(result.resolved).toBe('2026-04-01T00:00:00.000Z')
  })

  it('handles multiple components', function () {
    var result = normalizeFeature(makeIssue({
      fields: { components: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }
    }))
    expect(result.components).toEqual(['A', 'B', 'C'])
  })
})

// ---------------------------------------------------------------------------
// normalizeRfe
// ---------------------------------------------------------------------------

describe('normalizeRfe', function () {
  it('extracts key, url, summary, status, components, created', function () {
    var result = normalizeRfe(makeRfeIssue())
    expect(result.key).toBe('RHAIRFE-200')
    expect(result.url).toContain('/browse/RHAIRFE-200')
    expect(result.summary).toBe('Test RFE')
    expect(result.status).toBe('New')
    expect(result.components).toEqual(['Serving'])
  })

  it('handles missing fields gracefully', function () {
    var result = normalizeRfe({ key: 'R-1', fields: {} })
    expect(result.status).toBe('')
    expect(result.components).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// classifyByMonth
// ---------------------------------------------------------------------------

describe('classifyByMonth', function () {
  it('buckets features by created month', function () {
    var now = new Date()
    var thisMonth = now.getFullYear() + '-' + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1)
    var features = [
      makeFeature('F-1', 'A', now.toISOString(), null)
    ]
    var result = classifyByMonth(features, 3)
    var thisRow = result.months.find(function (m) { return m.month === thisMonth })
    expect(thisRow).toBeDefined()
    expect(thisRow.created).toBe(1)
  })

  it('buckets features by resolved month', function () {
    var now = new Date()
    var thisMonth = now.getFullYear() + '-' + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1)
    var features = [
      makeFeature('F-1', 'A', '2020-01-01T00:00:00.000Z', now.toISOString(), 'Closed', 'Done')
    ]
    var result = classifyByMonth(features, 3)
    var thisRow = result.months.find(function (m) { return m.month === thisMonth })
    expect(thisRow.resolved).toBe(1)
  })

  it('computes net = created - resolved per month', function () {
    var now = new Date()
    var thisMonth = now.getFullYear() + '-' + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1)
    var features = [
      makeFeature('F-1', 'A', now.toISOString(), null),
      makeFeature('F-2', 'A', now.toISOString(), null),
      makeFeature('F-3', 'A', '2020-01-01T00:00:00.000Z', now.toISOString(), 'Closed', 'Done')
    ]
    var result = classifyByMonth(features, 3)
    var thisRow = result.months.find(function (m) { return m.month === thisMonth })
    expect(thisRow.net).toBe(1) // 2 created - 1 resolved
  })

  it('computes cumulative correctly', function () {
    var result = classifyByMonth([], 3)
    expect(result.months).toHaveLength(3)
    // All zero — cumulative stays 0
    for (var i = 0; i < result.months.length; i++) {
      expect(result.months[i].cumulative).toBe(0)
    }
  })

  it('handles empty input', function () {
    var result = classifyByMonth([], 6)
    expect(result.months).toHaveLength(6)
    result.months.forEach(function (m) {
      expect(m.created).toBe(0)
      expect(m.resolved).toBe(0)
      expect(m.net).toBe(0)
    })
  })

  it('ignores features outside the lookback window', function () {
    var features = [
      makeFeature('F-old', 'A', '2015-01-01T00:00:00.000Z', null)
    ]
    var result = classifyByMonth(features, 3)
    var total = result.months.reduce(function (sum, m) { return sum + m.created }, 0)
    expect(total).toBe(0)
  })

  it('includes JQL URLs for each month', function () {
    var result = classifyByMonth([], 3)
    result.months.forEach(function (m) {
      expect(m.created_jql).toContain('jql=')
      expect(m.resolved_jql).toContain('jql=')
    })
  })
})

// ---------------------------------------------------------------------------
// computeComponentPressure
// ---------------------------------------------------------------------------

describe('computeComponentPressure', function () {
  it('groups features by component', function () {
    var now = new Date()
    var features = [
      makeFeature('F-1', 'Dashboard', now.toISOString(), null),
      makeFeature('F-2', 'Dashboard', now.toISOString(), now.toISOString(), 'Closed', 'Done'),
      makeFeature('F-3', 'Serving', now.toISOString(), null)
    ]
    var result = computeComponentPressure(features, 12)
    expect(result.length).toBe(2)
    var dashboard = result.find(function (r) { return r.component === 'Dashboard' })
    expect(dashboard).toBeDefined()
    expect(dashboard.created).toBe(2)
    expect(dashboard.resolved).toBe(1)
  })

  it('handles features with multiple components (counted in each)', function () {
    var now = new Date()
    var features = [
      makeFeature('F-1', ['A', 'B'], now.toISOString(), null)
    ]
    var result = computeComponentPressure(features, 12)
    var a = result.find(function (r) { return r.component === 'A' })
    var b = result.find(function (r) { return r.component === 'B' })
    expect(a.created).toBe(1)
    expect(b.created).toBe(1)
  })

  it('computes pressure_ratio = created / resolved', function () {
    var now = new Date()
    var features = [
      makeFeature('F-1', 'X', now.toISOString(), null),
      makeFeature('F-2', 'X', now.toISOString(), null),
      makeFeature('F-3', 'X', '2020-01-01T00:00:00.000Z', now.toISOString(), 'Closed', 'Done')
    ]
    var result = computeComponentPressure(features, 12)
    var x = result.find(function (r) { return r.component === 'X' })
    expect(x.pressure_ratio).toBe(2) // 2 created / 1 resolved
  })

  it('returns Infinity ratio when resolved is zero and created > 0', function () {
    var now = new Date()
    var features = [
      makeFeature('F-1', 'X', now.toISOString(), null)
    ]
    var result = computeComponentPressure(features, 12)
    var x = result.find(function (r) { return r.component === 'X' })
    expect(x.pressure_ratio).toBe(Infinity)
  })

  it('returns 0 ratio when both created and resolved are zero', function () {
    // Feature created outside window but still open
    var features = [
      makeFeature('F-1', 'X', '2015-01-01T00:00:00.000Z', null)
    ]
    var result = computeComponentPressure(features, 12)
    var x = result.find(function (r) { return r.component === 'X' })
    expect(x.pressure_ratio).toBe(0)
    expect(x.open).toBe(1) // still open
  })

  it('generates correct JQL URLs for each count', function () {
    var now = new Date()
    var features = [makeFeature('F-1', 'Dashboard', now.toISOString(), null)]
    var result = computeComponentPressure(features, 12)
    var d = result.find(function (r) { return r.component === 'Dashboard' })
    expect(d.created_jql).toContain('Dashboard')
    expect(d.open_jql).toContain('statusCategory')
  })

  it('sorts by net descending', function () {
    var now = new Date()
    var features = [
      makeFeature('F-1', 'Low', now.toISOString(), now.toISOString(), 'Closed', 'Done'),
      makeFeature('F-2', 'High', now.toISOString(), null),
      makeFeature('F-3', 'High', now.toISOString(), null)
    ]
    var result = computeComponentPressure(features, 12)
    expect(result[0].component).toBe('High')
    expect(result[0].net).toBe(2)
  })

  it('filters out components with zero created and zero open', function () {
    var features = []
    var result = computeComponentPressure(features, 12)
    expect(result).toHaveLength(0)
  })

  it('uses (No Component) for features without components', function () {
    var now = new Date()
    // makeFeature wraps comp as array, so build manually for empty components
    var feat = {
      key: 'F-1', url: '', summary: '', status: 'In Progress',
      components: [], created: now.toISOString(), resolved: null
    }
    var result = computeComponentPressure([feat], 12)
    var noComp = result.find(function (r) { return r.component === '(No Component)' })
    expect(noComp).toBeDefined()
    expect(noComp.created).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// computeRfePipeline
// ---------------------------------------------------------------------------

describe('computeRfePipeline', function () {
  it('counts accepted vs pending correctly using STATUS constants', function () {
    var rfes = [
      makeRfe('R-1', 'A', 'Approved'),
      makeRfe('R-2', 'A', 'New'),
      makeRfe('R-3', 'A', 'Draft'),
      makeRfe('R-4', 'A', 'In Progress')
    ]
    var result = computeRfePipeline(rfes, 12)
    expect(result.status_breakdown.accepted.count).toBe(2) // Approved, In Progress
    expect(result.status_breakdown.pending.count).toBe(2) // New, Draft
  })

  it('handles unknown status as other', function () {
    var rfes = [makeRfe('R-1', 'A', 'WontDo')]
    var result = computeRfePipeline(rfes, 12)
    expect(result.status_breakdown.other.count).toBe(1)
    expect(result.status_breakdown.accepted.count).toBe(0)
    expect(result.status_breakdown.pending.count).toBe(0)
  })

  it('computes monthly arrivals', function () {
    var now = new Date()
    var rfes = [
      makeRfe('R-1', 'A', 'New', now.toISOString()),
      makeRfe('R-2', 'A', 'New', now.toISOString())
    ]
    var result = computeRfePipeline(rfes, 3)
    var thisMonth = now.getFullYear() + '-' + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1)
    var thisRow = result.monthly_arrivals.find(function (m) { return m.month === thisMonth })
    expect(thisRow.count).toBe(2)
  })

  it('groups pending by component', function () {
    var rfes = [
      makeRfe('R-1', 'Serving', 'New'),
      makeRfe('R-2', 'Serving', 'Draft'),
      makeRfe('R-3', 'Training', 'New')
    ]
    var result = computeRfePipeline(rfes, 12)
    var serving = result.per_component_pending.find(function (p) { return p.component === 'Serving' })
    expect(serving.count).toBe(2)
    var training = result.per_component_pending.find(function (p) { return p.component === 'Training' })
    expect(training.count).toBe(1)
  })

  it('generates JQL URLs for all counts', function () {
    var rfes = [makeRfe('R-1', 'A', 'New')]
    var result = computeRfePipeline(rfes, 12)
    expect(result.status_breakdown.total.jql).toContain('jql=')
    expect(result.status_breakdown.accepted.jql).toContain('jql=')
    expect(result.status_breakdown.pending.jql).toContain('jql=')
  })

  it('handles empty RFE list', function () {
    var result = computeRfePipeline([], 6)
    expect(result.status_breakdown.total.count).toBe(0)
    expect(result.status_breakdown.accepted.count).toBe(0)
    expect(result.status_breakdown.pending.count).toBe(0)
    expect(result.per_component_pending).toHaveLength(0)
  })

  it('sorts per_component_pending by count descending', function () {
    var rfes = [
      makeRfe('R-1', 'Low', 'New'),
      makeRfe('R-2', 'High', 'New'),
      makeRfe('R-3', 'High', 'Draft'),
      makeRfe('R-4', 'High', 'Stakeholder review')
    ]
    var result = computeRfePipeline(rfes, 12)
    expect(result.per_component_pending[0].component).toBe('High')
    expect(result.per_component_pending[0].count).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// computeBacklogHalfLife
// ---------------------------------------------------------------------------

describe('computeBacklogHalfLife', function () {
  it('returns correct months for normal case', function () {
    var pressure = [
      { component: 'A', created: 12, resolved: 6, open: 18, net: 6, open_jql: '' }
    ]
    var result = computeBacklogHalfLife(pressure, 12)
    expect(result).toHaveLength(1)
    // resolved_per_month = 6/12 = 0.5, months_to_clear = 18/0.5 = 36
    expect(result[0].months_to_clear).toBe(36)
    expect(result[0].resolved_per_month).toBe(0.5)
  })

  it('returns Infinity when resolved is zero', function () {
    var pressure = [
      { component: 'A', created: 5, resolved: 0, open: 10, net: 5, open_jql: '' }
    ]
    var result = computeBacklogHalfLife(pressure, 12)
    expect(result[0].months_to_clear).toBe(Infinity)
  })

  it('excludes components with zero open', function () {
    var pressure = [
      { component: 'A', created: 5, resolved: 5, open: 0, net: 0, open_jql: '' }
    ]
    var result = computeBacklogHalfLife(pressure, 12)
    expect(result).toHaveLength(0)
  })

  it('sorts with Infinity first (worst), then descending months', function () {
    var pressure = [
      { component: 'Fast', created: 10, resolved: 10, open: 5, net: 0, open_jql: '' },
      { component: 'Stuck', created: 5, resolved: 0, open: 5, net: 5, open_jql: '' },
      { component: 'Slow', created: 12, resolved: 2, open: 20, net: 10, open_jql: '' }
    ]
    var result = computeBacklogHalfLife(pressure, 12)
    expect(result[0].component).toBe('Stuck')
    expect(result[0].months_to_clear).toBe(Infinity)
    expect(result[1].component).toBe('Slow') // 20 / (2/12) = 120 months
    expect(result[2].component).toBe('Fast') // 5 / (10/12) = 6 months
  })
})

// ---------------------------------------------------------------------------
// buildHeatmapMatrix
// ---------------------------------------------------------------------------

describe('buildHeatmapMatrix', function () {
  it('produces correct dimensions (components x months)', function () {
    var now = new Date()
    var features = []
    // Create 4 features in same component to pass >= 3 threshold
    for (var i = 0; i < 4; i++) {
      features.push(makeFeature('F-' + i, 'A', now.toISOString(), null))
    }
    var result = buildHeatmapMatrix(features, 6)
    expect(result.months).toHaveLength(6)
    expect(result.components).toHaveLength(1)
    expect(result.matrix).toHaveLength(1)
    expect(result.matrix[0]).toHaveLength(6)
  })

  it('cell values match created - resolved', function () {
    var now = new Date()
    var thisMonth = now.getFullYear() + '-' + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1)
    // 3 created this month (including the resolved one), 1 resolved this month
    // Net = 3 - 1 = 2
    var features = [
      makeFeature('F-1', 'A', now.toISOString(), null),
      makeFeature('F-2', 'A', now.toISOString(), null),
      makeFeature('F-3', 'A', now.toISOString(), now.toISOString(), 'Closed', 'Done')
    ]
    var result = buildHeatmapMatrix(features, 3)
    var monthIdx = result.months.indexOf(thisMonth)
    if (result.components.length > 0) {
      expect(result.matrix[0][monthIdx]).toBe(2) // 3 created - 1 resolved = 2
    }
  })

  it('filters out components with < 3 total activity', function () {
    var now = new Date()
    var features = [
      makeFeature('F-1', 'SmallComp', now.toISOString(), null),
      makeFeature('F-2', 'SmallComp', now.toISOString(), null)
    ]
    var result = buildHeatmapMatrix(features, 6)
    expect(result.components).not.toContain('SmallComp')
  })

  it('handles empty features list', function () {
    var result = buildHeatmapMatrix([], 6)
    expect(result.months).toHaveLength(6)
    expect(result.components).toHaveLength(0)
    expect(result.matrix).toHaveLength(0)
  })

  it('limits to 25 components', function () {
    var now = new Date()
    var features = []
    for (var i = 0; i < 30; i++) {
      // Each component needs 3+ features
      for (var j = 0; j < 3; j++) {
        features.push(makeFeature('F-' + i + '-' + j, 'Comp' + i, now.toISOString(), null))
      }
    }
    var result = buildHeatmapMatrix(features, 6)
    expect(result.components.length).toBeLessThanOrEqual(25)
  })

  it('skips features with no components', function () {
    var now = new Date()
    var feat = {
      key: 'F-1', url: '', summary: '', status: 'In Progress',
      components: [], created: now.toISOString(), resolved: null
    }
    var result = buildHeatmapMatrix([feat], 6)
    expect(result.components).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// computeTrend
// ---------------------------------------------------------------------------

describe('computeTrend', function () {
  it('identifies worsening when second_half_net > first_half_net', function () {
    var now = new Date()
    var sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 9) // in first half of 12mo window

    var features = [
      // First half: 1 created, 1 resolved (net 0)
      makeFeature('F-1', 'A', sixMonthsAgo.toISOString(), sixMonthsAgo.toISOString(), 'Closed', 'Done'),
      // Second half: 3 created, 0 resolved (net 3)
      makeFeature('F-2', 'A', now.toISOString(), null),
      makeFeature('F-3', 'A', now.toISOString(), null),
      makeFeature('F-4', 'A', now.toISOString(), null)
    ]
    var result = computeTrend(features, 12)
    var a = result.find(function (r) { return r.component === 'A' })
    expect(a.direction).toBe('worsening')
    expect(a.delta).toBeGreaterThan(0)
  })

  it('identifies improving when second_half_net < first_half_net', function () {
    var now = new Date()
    var nineMonthsAgo = new Date(now)
    nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9)

    var features = [
      // First half: 3 created, 0 resolved (net 3)
      makeFeature('F-1', 'B', nineMonthsAgo.toISOString(), null),
      makeFeature('F-2', 'B', nineMonthsAgo.toISOString(), null),
      makeFeature('F-3', 'B', nineMonthsAgo.toISOString(), null),
      // Second half: 0 created, 1 resolved (net -1)
      makeFeature('F-4', 'B', '2020-01-01T00:00:00.000Z', now.toISOString(), 'Closed', 'Done')
    ]
    var result = computeTrend(features, 12)
    var b = result.find(function (r) { return r.component === 'B' })
    expect(b.direction).toBe('improving')
    expect(b.delta).toBeLessThan(0)
  })

  it('identifies stable when nets are equal', function () {
    var now = new Date()
    var nineMonthsAgo = new Date(now)
    nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9)

    var features = [
      makeFeature('F-1', 'C', nineMonthsAgo.toISOString(), null),
      makeFeature('F-2', 'C', now.toISOString(), null)
    ]
    var result = computeTrend(features, 12)
    var c = result.find(function (r) { return r.component === 'C' })
    expect(c.direction).toBe('stable')
    expect(c.delta).toBe(0)
  })

  it('sorts by delta descending (worst first)', function () {
    var now = new Date()
    var features = [
      makeFeature('F-1', 'Better', '2020-01-01T00:00:00.000Z', now.toISOString(), 'Closed', 'Done'),
      makeFeature('F-2', 'Worse', now.toISOString(), null),
      makeFeature('F-3', 'Worse', now.toISOString(), null)
    ]
    var result = computeTrend(features, 12)
    expect(result[0].component).toBe('Worse')
  })

  it('handles empty features', function () {
    var result = computeTrend([], 12)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// computeScorecard
// ---------------------------------------------------------------------------

describe('computeScorecard', function () {
  it('computes risk score with correct weights', function () {
    var pressure = [
      { component: 'A', created: 10, resolved: 5, open: 20, net: 5, pressure_ratio: 2, open_jql: '' }
    ]
    var rfePipeline = { per_component_pending: [{ component: 'A', count: 5, jql: '' }] }
    var halfLife = [{ component: 'A', open: 20, months_to_clear: 24 }]
    var trend = [{ component: 'A', direction: 'worsening' }]

    var result = computeScorecard(pressure, rfePipeline, halfLife, trend)
    expect(result).toHaveLength(1)
    expect(result[0].component).toBe('A')
    // netScore = min(5/5, 10) = 1, backlogScore = min(20/10, 10) = 2, rfeScore = min(5/5, 10) = 1
    // risk = 1*0.4 + 2*0.3 + 1*0.3 = 0.4 + 0.6 + 0.3 = 1.3
    expect(result[0].risk_score).toBe(1.3)
    expect(result[0].risk_level).toBe('low')
    expect(result[0].trend).toBe('worsening')
  })

  it('caps individual scores at 10', function () {
    var pressure = [
      { component: 'A', created: 100, resolved: 0, open: 200, net: 100, pressure_ratio: Infinity, open_jql: '' }
    ]
    var rfePipeline = { per_component_pending: [{ component: 'A', count: 100, jql: '' }] }
    var halfLife = [{ component: 'A', open: 200, months_to_clear: Infinity }]
    var trend = [{ component: 'A', direction: 'worsening' }]

    var result = computeScorecard(pressure, rfePipeline, halfLife, trend)
    // All capped: net=10, backlog=10, rfe=10 -> 10*0.4 + 10*0.3 + 10*0.3 = 10
    expect(result[0].risk_score).toBe(10)
    expect(result[0].risk_level).toBe('critical')
  })

  it('handles components with no RFE data', function () {
    var pressure = [
      { component: 'X', created: 5, resolved: 3, open: 5, net: 2, pressure_ratio: 1.67, open_jql: '' }
    ]
    var rfePipeline = { per_component_pending: [] }
    var halfLife = [{ component: 'X', open: 5, months_to_clear: 10 }]
    var trend = [{ component: 'X', direction: 'stable' }]

    var result = computeScorecard(pressure, rfePipeline, halfLife, trend)
    expect(result[0].rfe_pending).toBe(0)
  })

  it('sorts by risk_score descending', function () {
    var pressure = [
      { component: 'Low', created: 1, resolved: 1, open: 1, net: 0, pressure_ratio: 1, open_jql: '' },
      { component: 'High', created: 50, resolved: 0, open: 100, net: 50, pressure_ratio: Infinity, open_jql: '' }
    ]
    var rfePipeline = { per_component_pending: [] }
    var halfLife = []
    var trend = []

    var result = computeScorecard(pressure, rfePipeline, halfLife, trend)
    expect(result[0].component).toBe('High')
  })

  it('assigns correct risk levels', function () {
    // Build scenarios for each level
    var pressure = [
      { component: 'Critical', created: 100, resolved: 0, open: 200, net: 100, pressure_ratio: Infinity, open_jql: '' },
      { component: 'High', created: 30, resolved: 5, open: 80, net: 25, pressure_ratio: 6, open_jql: '' },
      { component: 'Medium', created: 15, resolved: 5, open: 30, net: 10, pressure_ratio: 3, open_jql: '' },
      { component: 'Low', created: 2, resolved: 2, open: 3, net: 0, pressure_ratio: 1, open_jql: '' }
    ]
    var rfePipeline = { per_component_pending: [
      { component: 'Critical', count: 50, jql: '' },
      { component: 'High', count: 20, jql: '' }
    ] }
    var halfLife = []
    var trend = []

    var result = computeScorecard(pressure, rfePipeline, halfLife, trend)
    var critical = result.find(function (r) { return r.component === 'Critical' })
    var low = result.find(function (r) { return r.component === 'Low' })
    expect(critical.risk_level).toBe('critical')
    expect(low.risk_level).toBe('low')
  })
})

// ---------------------------------------------------------------------------
// Status constants sanity
// ---------------------------------------------------------------------------

describe('status constants', function () {
  it('RFE_ACCEPTED includes all expected values', function () {
    expect(RFE_ACCEPTED).toContain('Approved')
    expect(RFE_ACCEPTED).toContain('In Progress')
    expect(RFE_ACCEPTED).toContain('Resolved')
  })

  it('RFE_PENDING includes all expected values', function () {
    expect(RFE_PENDING).toContain('New')
    expect(RFE_PENDING).toContain('Draft')
    expect(RFE_PENDING).toContain('Stakeholder review')
    expect(RFE_PENDING).toContain('Stakeholder Feedback')
    expect(RFE_PENDING).toContain('Pending Approval')
  })
})

// ---------------------------------------------------------------------------
// normalizeIssue (shared normaliser)
// ---------------------------------------------------------------------------

describe('normalizeIssue', function () {
  it('normalizeFeature and normalizeRfe are aliases for normalizeIssue', function () {
    expect(normalizeFeature).toBe(normalizeIssue)
    expect(normalizeRfe).toBe(normalizeIssue)
  })

  it('returns the same result regardless of which alias is used', function () {
    var issue = makeIssue({ key: 'TEST-1' })
    expect(normalizeFeature(issue)).toEqual(normalizeRfe(issue))
  })
})

// ---------------------------------------------------------------------------
// sanitizeInfinity
// ---------------------------------------------------------------------------

describe('sanitizeInfinity', function () {
  it('replaces Infinity with "Infinity" string in flat objects', function () {
    var obj = { a: 1, b: Infinity, c: 'hello' }
    sanitizeInfinity(obj)
    expect(obj.b).toBe('Infinity')
    expect(obj.a).toBe(1)
    expect(obj.c).toBe('hello')
  })

  it('replaces Infinity in nested objects', function () {
    var obj = { nested: { val: Infinity } }
    sanitizeInfinity(obj)
    expect(obj.nested.val).toBe('Infinity')
  })

  it('replaces Infinity in arrays', function () {
    var obj = { arr: [1, Infinity, 3] }
    sanitizeInfinity(obj)
    expect(obj.arr).toEqual([1, 'Infinity', 3])
  })

  it('survives JSON round-trip after sanitisation', function () {
    var obj = { months_to_clear: Infinity }
    sanitizeInfinity(obj)
    var json = JSON.stringify(obj)
    var parsed = JSON.parse(json)
    expect(parsed.months_to_clear).toBe('Infinity')
  })

  it('handles null and non-object inputs gracefully', function () {
    expect(sanitizeInfinity(null)).toBeNull()
    expect(sanitizeInfinity(42)).toBe(42)
    expect(sanitizeInfinity('hello')).toBe('hello')
  })

  it('handles computeBacklogHalfLife output with stalled components', function () {
    var pressure = [{ component: 'Stuck', created: 5, resolved: 0, open: 10, net: 5, pressure_ratio: Infinity, open_jql: 'https://test' }]
    var result = computeBacklogHalfLife(pressure, 12)
    expect(result[0].months_to_clear).toBe(Infinity)

    sanitizeInfinity(result)
    expect(result[0].months_to_clear).toBe('Infinity')
    expect(JSON.parse(JSON.stringify(result))[0].months_to_clear).toBe('Infinity')
  })
})

// ---------------------------------------------------------------------------
// quoteComponent escaping
// ---------------------------------------------------------------------------

describe('quoteComponent edge cases', function () {
  it('escapes backslashes before double quotes', function () {
    var result = quoteComponent('test\\name')
    expect(result).toBe('"test\\\\name"')
  })

  it('escapes both backslashes and quotes', function () {
    var result = quoteComponent('test\\"name')
    expect(result).toBe('"test\\\\\\"name"')
  })
})

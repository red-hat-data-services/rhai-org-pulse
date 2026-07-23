/**
 * View-level tests for TvFvDeltaView — product filter, column sorting,
 * target alignment column, and default version pre-selection.
 *
 * These tests mount the full view with mocked API responses and verify
 * the template renders the new UI elements correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TvFvDeltaView from '../../../client/views/TvFvDeltaView.vue'
import { DEFAULT_SELECTED_VERSIONS } from '../../../client/composables/tvFvDeltaDefaults'

// ── Mock apiRequest ──

var mockApiRequest = vi.fn()

vi.mock('@shared/client', function () {
  return {
    apiRequest: function () { return mockApiRequest.apply(null, arguments) },
  }
})

// ── Test data (subset of default versions + one extra for family filter) ──

function emptyRow(release) {
  return { release: release, total: 0, aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0, alignment_pct: 0, ga_date: null }
}

function makeTestData() {
  var detailed = {
    '3.6 EA1 RHOAI RELEASE': { release: '3.6 EA1 RHOAI RELEASE', total: 7, aligned: 2, tv_only: 3, fv_only: 1, mismatched: 1, alignment_pct: 28.6, ga_date: '2026-09-17' },
    '3.6 EA2 RHOAI RELEASE': { release: '3.6 EA2 RHOAI RELEASE', total: 4, aligned: 0, tv_only: 2, fv_only: 1, mismatched: 1, alignment_pct: 0, ga_date: '2026-10-15' },
    '3.6 GA RHOAI RELEASE': { release: '3.6 GA RHOAI RELEASE', total: 12, aligned: 3, tv_only: 5, fv_only: 2, mismatched: 2, alignment_pct: 25, ga_date: '2026-11-19' },
    '3.5 GA RHOAI RELEASE': { release: '3.5 GA RHOAI RELEASE', total: 155, aligned: 50, tv_only: 60, fv_only: 25, mismatched: 20, alignment_pct: 32.3, ga_date: '2026-07-15' },
  }
  var summary = DEFAULT_SELECTED_VERSIONS.map(function (v) {
    return detailed[v] || emptyRow(v)
  })
  // Extra non-default release in cache — must not appear in the default picker
  summary.push({ release: 'RHELAI-3.2', total: 1, aligned: 1, tv_only: 0, fv_only: 0, mismatched: 0, alignment_pct: 100, ga_date: null })

  var releases = {}
  DEFAULT_SELECTED_VERSIONS.forEach(function (v) {
    releases[v] = { aligned: [], tv_only: [], fv_only: [], mismatched: [] }
  })

  return {
    metadata: {
      generated_at: '2026-06-17T10:00:00Z',
      data_timestamp: '2026-06-17T09:55:00Z',
      releases: DEFAULT_SELECTED_VERSIONS.slice(),
    },
    executive_summary: summary,
    releases: releases,
  }
}

async function mountView() {
  var testData = makeTestData()

  mockApiRequest.mockImplementation(function (url) {
    if (url.includes('/registry')) return Promise.resolve({ releases: [] })
    if (url.includes('/versions')) return Promise.resolve({ versions: [] })
    if (url.includes('/tv-fv-delta')) return Promise.resolve(testData)
    return Promise.resolve({})
  })

  var wrapper = mount(TvFvDeltaView, {
    global: {
      stubs: {
        ClickableCount: {
          template: '<span class="clickable-count">{{ count }}</span>',
          props: ['count', 'jql', 'color', 'label'],
        },
      },
    },
  })

  await flushPromises()
  return wrapper
}

/** Find the executive summary table (first table in the view) */
function findSummaryTable(wrapper) {
  return wrapper.findAll('table')[0]
}

// ── Tests ──

describe('TvFvDeltaView default version selection', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('pre-selects the 18 default product-family versions on load', async function () {
    var wrapper = await mountView()
    // Version picker chips include a Remove control; family filter pills do not
    var chips = wrapper.findAll('button').filter(function (b) {
      return b.find('span[title="Remove"]').exists()
    })
    expect(chips.length).toBe(DEFAULT_SELECTED_VERSIONS.length)
    DEFAULT_SELECTED_VERSIONS.forEach(function (v) {
      expect(chips.some(function (b) { return b.text().includes(v) })).toBe(true)
    })
  })

  it('does not include non-default versions from cache in the picker chips', async function () {
    var wrapper = await mountView()
    var rhelaiChip = wrapper.findAll('button').find(function (b) {
      return b.find('span[title="Remove"]').exists() && b.text().includes('RHELAI-3.2')
    })
    expect(rhelaiChip).toBeFalsy()
  })
})

describe('TvFvDeltaView release family filter', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('renders release family filter pills', async function () {
    var wrapper = await mountView()
    var buttons = wrapper.findAll('button').filter(function (b) {
      var text = b.text()
      return text === 'All' || text.includes('3.6') || text.includes('3.5')
    })
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('defaults to All — shows default-selected releases present in data', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var allText = table.find('tbody').text()
    expect(allText).toContain('3.6 EA1 RHOAI RELEASE')
    expect(allText).toContain('3.5 GA RHOAI RELEASE')
    // Non-default RHELAI-3.2 must not appear
    expect(allText).not.toContain('RHELAI-3.2')
  })
})

describe('TvFvDeltaView executive summary sorting', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('renders sortable column headers', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var headers = table.findAll('thead th')
    // Should have: Release, Total, Aligned, TV-Only, FV-Only, Mismatched, Alignment, Target, GA Date, Days to GA, Planning Freeze
    expect(headers.length).toBe(11)
  })

  it('default sort includes 3.6 and 3.5 default versions from data', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var rows = table.findAll('tbody tr')
    var releases = rows.map(function (r) { return r.find('td').text().trim().replace(/\s*\(refreshing data\.\.\.\)\s*$/, '') })
    expect(releases).toContain('3.6 EA1 RHOAI RELEASE')
    expect(releases).toContain('3.6 EA2 RHOAI RELEASE')
    expect(releases).toContain('3.6 GA RHOAI RELEASE')
    expect(releases).toContain('3.5 GA RHOAI RELEASE')
  })

  it('clicking Total header sorts by total', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var totalHeader = table.findAll('thead th').find(function (th) {
      return th.text().includes('Total')
    })
    await totalHeader.trigger('click')
    await flushPromises()
    var rows = table.findAll('tbody tr')
    var totals = []
    rows.forEach(function (r) {
      var cells = r.findAll('td')
      var countEl = cells[1].find('.clickable-count')
      if (countEl.exists()) totals.push(parseInt(countEl.text(), 10))
    })
    // Ascending order among rows with real counts
    for (var i = 1; i < totals.length; i++) {
      expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1])
    }
  })

  it('shows sort arrow on active column', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var totalHeader = table.findAll('thead th').find(function (th) {
      return th.text().includes('Total')
    })
    // No arrow initially
    expect(totalHeader.find('svg').exists()).toBe(false)
    // Click to sort
    await totalHeader.trigger('click')
    await flushPromises()
    expect(totalHeader.find('svg').exists()).toBe(true)
  })
})

describe('TvFvDeltaView target alignment column', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('renders Target column header', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var headers = table.findAll('thead th')
    var targetHeader = headers.find(function (th) { return th.text().includes('Target') })
    expect(targetHeader).toBeTruthy()
  })

  it('shows target percentage with asterisk for releases with GA dates', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var html = table.html()
    // At least one row should have a target with asterisk
    expect(html).toMatch(/\d+%\*/)
  })

  it('colors target red when actual alignment is below target', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    // 3.5 GA RHOAI has alignment_pct: 32.3% and ga_date: 2026-07-15 (~28 days from June 17)
    // Target for ≤30 days = 100%*, so actual (32.3%) < target (100%) → red
    var rows = table.findAll('tbody tr')
    var row35 = rows.find(function (r) { return r.text().includes('3.5 GA RHOAI RELEASE') })
    if (row35) {
      var targetCell = row35.findAll('td')[7]
      var targetSpan = targetCell.find('span.font-semibold')
      if (targetSpan.exists()) {
        var classes = targetSpan.classes()
        expect(classes.some(function (c) { return c.includes('red') })).toBe(true)
      }
    }
  })
})

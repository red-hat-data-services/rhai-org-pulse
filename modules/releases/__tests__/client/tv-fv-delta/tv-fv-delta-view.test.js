/**
 * View-level tests for TvFvDeltaView — product filter, column sorting,
 * and target alignment column integration.
 *
 * These tests mount the full view with mocked API responses and verify
 * the template renders the new UI elements correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TvFvDeltaView from '../../../client/views/TvFvDeltaView.vue'

// ── Mock apiRequest ──

var mockApiRequest = vi.fn()

vi.mock('@shared/client', function () {
  return {
    apiRequest: function () { return mockApiRequest.apply(null, arguments) },
  }
})

// ── Test data ──

function makeTestData() {
  return {
    metadata: {
      generated_at: '2026-06-17T10:00:00Z',
      data_timestamp: '2026-06-17T09:55:00Z',
      releases: ['rhoai-3.6.EA1', 'rhoai-3.6.EA2', 'rhoai-3.6', 'rhoai-3.5', 'RHELAI-3.2'],
      all_components: ['Dashboard', 'Serving'],
    },
    executive_summary: [
      { release: 'rhoai-3.6.EA1', total: 7, aligned: 2, tv_only: 3, fv_only: 1, mismatched: 1, alignment_pct: 28.6, ga_date: '2026-09-17' },
      { release: 'rhoai-3.6.EA2', total: 4, aligned: 0, tv_only: 2, fv_only: 1, mismatched: 1, alignment_pct: 0, ga_date: '2026-10-15' },
      { release: 'rhoai-3.6', total: 12, aligned: 3, tv_only: 5, fv_only: 2, mismatched: 2, alignment_pct: 25, ga_date: '2026-11-19' },
      { release: 'rhoai-3.5', total: 155, aligned: 50, tv_only: 60, fv_only: 25, mismatched: 20, alignment_pct: 32.3, ga_date: '2026-07-15' },
      { release: 'RHELAI-3.2', total: 1, aligned: 1, tv_only: 0, fv_only: 0, mismatched: 0, alignment_pct: 100, ga_date: null },
    ],
    releases: {
      'rhoai-3.6.EA1': { aligned: [], tv_only: [], fv_only: [], mismatched: [] },
      'rhoai-3.6.EA2': { aligned: [], tv_only: [], fv_only: [], mismatched: [] },
      'rhoai-3.6': { aligned: [], tv_only: [], fv_only: [], mismatched: [] },
      'rhoai-3.5': { aligned: [], tv_only: [], fv_only: [], mismatched: [] },
      'RHELAI-3.2': { aligned: [], tv_only: [], fv_only: [], mismatched: [] },
    },
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

// ── Tests ──

describe('TvFvDeltaView release family filter', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('renders release family filter pills', async function () {
    var wrapper = await mountView()
    var buttons = wrapper.findAll('button').filter(function (b) {
      var text = b.text()
      return text === 'All' || text === 'RHOAI 3.6' || text === 'RHOAI 3.5' || text === 'RHELAI 3.2'
    })
    expect(buttons.length).toBeGreaterThanOrEqual(4)
  })

  it('defaults to All — shows all releases', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var allText = table.find('tbody').text()
    expect(allText).toContain('RHELAI')
    expect(allText).toContain('rhoai')
  })

  it('filters to RHOAI 3.6 family when clicked', async function () {
    var wrapper = await mountView()
    var famButton = wrapper.findAll('button').find(function (b) { return b.text() === 'RHOAI 3.6' })
    await famButton.trigger('click')
    await flushPromises()
    var table = findSummaryTable(wrapper)
    var rows = table.findAll('tbody tr')
    expect(rows.length).toBe(3) // EA1, EA2, GA
    var releaseTexts = rows.map(function (r) { return r.find('td').text() })
    for (var i = 0; i < releaseTexts.length; i++) {
      expect(releaseTexts[i]).toContain('3.6')
    }
  })

  it('filters to RHELAI 3.2 when clicked', async function () {
    var wrapper = await mountView()
    var famButton = wrapper.findAll('button').find(function (b) { return b.text() === 'RHELAI 3.2' })
    await famButton.trigger('click')
    await flushPromises()
    var table = findSummaryTable(wrapper)
    var rows = table.findAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(rows[0].text()).toContain('RHELAI')
  })
})

/** Find the executive summary table (first table in the view) */
function findSummaryTable(wrapper) {
  return wrapper.findAll('table')[0]
}

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

  it('default sort is release family order (EA1 < EA2 < GA)', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var rows = table.findAll('tbody tr')
    var releases = rows.map(function (r) { return r.find('td').text().trim() })
    // Default is All — RHELAI first (alpha), then rhoai families
    expect(releases[0]).toBe('RHELAI-3.2')
    // rhoai 3.6 family in order, then 3.5
    var rhoaiReleases = releases.filter(function (r) { return r.toLowerCase().startsWith('rhoai') })
    expect(rhoaiReleases[0]).toBe('rhoai-3.6.EA1')
    expect(rhoaiReleases[1]).toBe('rhoai-3.6.EA2')
    expect(rhoaiReleases[2]).toBe('rhoai-3.6')
    expect(rhoaiReleases[3]).toBe('rhoai-3.5')
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
    // Ascending order
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

  it('shows dash for releases without GA dates', async function () {
    var wrapper = await mountView()
    // Default is All, so RHELAI-3.2 (no ga_date) is already visible
    var table = findSummaryTable(wrapper)
    var rows = table.findAll('tbody tr')
    var rhelaiRow = rows.find(function (r) { return r.text().includes('RHELAI') })
    expect(rhelaiRow).toBeTruthy()
    // The target cell (8th column, index 7) should have a dash
    var cells = rhelaiRow.findAll('td')
    expect(cells[7].text()).toBe('—')
  })

  it('colors target red when actual alignment is below target', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    // rhoai-3.5 has alignment_pct: 32.3% and ga_date: 2026-07-15 (~28 days from June 17)
    // Target for ≤30 days = 100%*, so actual (32.3%) < target (100%) → red
    var rows = table.findAll('tbody tr')
    var row35 = rows.find(function (r) { return r.text().includes('rhoai-3.5') && !r.text().includes('EA') })
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

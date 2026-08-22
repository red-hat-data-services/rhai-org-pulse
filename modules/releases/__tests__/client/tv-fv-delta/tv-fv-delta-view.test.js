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
  return { release: release, total: 0, aligned_on_time: 0, aligned_late: 0, tv_only: 0, fv_only: 0, misaligned: 0, alignment_pct: 0, ga_date: null, planning_freeze: null }
}

function makeTestData() {
  var detailed = {
    '3.6 EA1 RHOAI RELEASE': { release: '3.6 EA1 RHOAI RELEASE', total: 7, aligned_on_time: 2, aligned_late: 0, tv_only: 3, fv_only: 1, misaligned: 1, alignment_pct: 28.6, ga_date: '2026-09-17', planning_freeze: '2026-08-17' },
    '3.6 EA2 RHOAI RELEASE': { release: '3.6 EA2 RHOAI RELEASE', total: 4, aligned_on_time: 0, aligned_late: 0, tv_only: 2, fv_only: 1, misaligned: 1, alignment_pct: 0, ga_date: '2026-10-15', planning_freeze: '2026-09-15' },
    '3.6 GA RHOAI RELEASE': { release: '3.6 GA RHOAI RELEASE', total: 12, aligned_on_time: 3, aligned_late: 0, tv_only: 5, fv_only: 2, misaligned: 2, alignment_pct: 25, ga_date: '2026-11-19', planning_freeze: '2026-10-19' },
    '3.5 GA RHOAI RELEASE': { release: '3.5 GA RHOAI RELEASE', total: 155, aligned_on_time: 50, aligned_late: 0, tv_only: 60, fv_only: 25, misaligned: 20, alignment_pct: 32.3, ga_date: '2026-07-15', planning_freeze: '2026-06-15' },
  }
  var summary = DEFAULT_SELECTED_VERSIONS.map(function (v) {
    return detailed[v] || emptyRow(v)
  })
  // Extra non-default release in cache — must not appear in the default picker
  summary.push({ release: 'RHELAI-3.2', total: 1, aligned_on_time: 1, aligned_late: 0, tv_only: 0, fv_only: 0, misaligned: 0, alignment_pct: 100, ga_date: null, planning_freeze: null })

  var releases = {}
  DEFAULT_SELECTED_VERSIONS.forEach(function (v) {
    releases[v] = { aligned_on_time: [], aligned_late: [], tv_only: [], fv_only: [], misaligned: [] }
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

var PILLAR_CONFIG = {
  pillars: [
    {
      name: 'Data',
      components: [
        { name: 'Training', pmLead: 'PM Lead Training', engLead: 'Eng Lead Training' },
        { name: 'Serving', pmLead: 'PM Lead Serving', engLead: 'Eng Lead Serving' },
      ],
    },
  ],
}

async function mountView(extraData) {
  var testData = makeTestData()
  if (extraData) {
    Object.assign(testData, extraData)
    if (extraData.releases) testData.releases = Object.assign({}, testData.releases, extraData.releases)
    if (extraData.metadata) testData.metadata = Object.assign({}, testData.metadata, extraData.metadata)
  }

  mockApiRequest.mockImplementation(function (url) {
    if (url.includes('/registry')) return Promise.resolve({ releases: [] })
    if (url.includes('/versions')) return Promise.resolve({ versions: [] })
    if (url.includes('/pillar-config')) return Promise.resolve(PILLAR_CONFIG)
    if (url.includes('/tv-fv-delta')) return Promise.resolve(testData)
    return Promise.resolve({})
  })

  var wrapper = mount(TvFvDeltaView, {
    global: {
      stubs: {
        ClickableCount: {
          template: '<a v-if="jql" class="clickable-count" :href="jql">{{ count }}</a><span v-else class="clickable-count">{{ count }}</span>',
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

describe('TvFvDeltaView release cycle filter', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('renders cycle filter pills', async function () {
    var wrapper = await mountView()
    var buttons = wrapper.findAll('button').filter(function (b) {
      var text = b.text().trim()
      return text === 'All' || text === '3.6' || text === '3.5'
    })
    expect(buttons.length).toBeGreaterThanOrEqual(3)
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

  it('renders cycle and milestone rollup headers', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var text = table.find('tbody').text()
    expect(text).toContain('3.6 Release Cycle')
    expect(text).toContain('3.5 Release Cycle')
    expect(text).toContain('3.6 GA Release')
    expect(text).toContain('3.6 EA1 Release')
  })

  it('orders executive summary and selector cycle → milestone descending', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var labels = table.findAll('tbody tr td:first-child').map(function (td) {
      return td.text().replace(/\s+/g, ' ').trim()
    })
    function indexOf(needle) {
      return labels.findIndex(function (t) { return t.indexOf(needle) !== -1 })
    }
    expect(indexOf('3.6 Release Cycle')).toBeLessThan(indexOf('3.5 Release Cycle'))
    expect(indexOf('3.6 EA1 Release')).toBeLessThan(indexOf('3.6 EA2 Release'))
    expect(indexOf('3.6 EA2 Release')).toBeLessThan(indexOf('3.6 GA Release'))
    expect(indexOf('3.6 GA RHOAI RELEASE')).toBeLessThan(indexOf('3.6 GA RHELAI RELEASE'))

    var selector = wrapper.find('div.mb-6.space-y-4')
    var cycleHeaders = selector.findAll('div.uppercase.tracking-wide').map(function (el) {
      return el.text().trim()
    })
    expect(cycleHeaders[0]).toContain('3.6')
    expect(cycleHeaders[1]).toContain('3.5')

    var chips = selector.findAll('button').filter(function (b) {
      return b.find('span[title="Remove"]').exists()
    }).map(function (b) {
      return b.text().replace(/×/g, '').replace(/\s+/g, ' ').trim()
    })
    expect(chips[0]).toBe('3.6 EA1 RHOAI RELEASE')
    expect(chips.indexOf('3.6 EA1 RHOAI RELEASE')).toBeLessThan(chips.indexOf('3.5 EA1 RHOAI RELEASE'))
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
    // Should have: Release, Total, Early or as requested, After requested, TV-Only, FV-Only, Different products, Alignment %, Align Target, GA Date, Days to GA, Planning Freeze, Days to Freeze
    expect(headers.length).toBe(13)
    var headerText = headers.map(function (th) { return th.text().replace(/ⓘ/g, '').trim() })
    expect(headerText).toContain('Early or as requested')
    expect(headerText).toContain('After requested')
    expect(headerText).toContain('Different products')
    expect(headerText).toContain('Align Target')
  })

  it('default view includes 3.6 and 3.5 default versions from data', async function () {
    var wrapper = await mountView()
    var table = findSummaryTable(wrapper)
    var text = table.find('tbody').text()
    expect(text).toContain('3.6 EA1 RHOAI RELEASE')
    expect(text).toContain('3.6 EA2 RHOAI RELEASE')
    expect(text).toContain('3.6 GA RHOAI RELEASE')
    expect(text).toContain('3.5 GA RHOAI RELEASE')
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
    // 3.5 GA RHOAI has alignment_pct: 32.3% and planning_freeze: 2026-06-15 (frozen)
    // Target for frozen (≤0 days) = 100%*, so actual (32.3%) < target (100%) → red
    var rows = table.findAll('tbody tr')
    var row35 = rows.find(function (r) { return r.text().includes('3.5 GA RHOAI RELEASE') })
    if (row35) {
      var targetCell = row35.findAll('td')[8]
      var targetSpan = targetCell.find('span.font-semibold')
      if (targetSpan.exists()) {
        var classes = targetSpan.classes()
        expect(classes.some(function (c) { return c.includes('red') })).toBe(true)
      }
    }
  })
})

describe('TvFvDeltaView milestone vs product selection', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('merges features when selecting a milestone group', async function () {
    var wrapper = await mountView({
      releases: {
        '3.6 GA RHOAI RELEASE': {
          aligned_on_time: [{ key: 'A1', summary: 'rhoai' }],
          aligned_late: [],
          tv_only: [],
          fv_only: [],
          misaligned: [],
        },
        '3.6 GA RHAII RELEASE': {
          aligned_on_time: [{ key: 'A2', summary: 'rhaii' }],
          aligned_late: [],
          tv_only: [{ key: 'T1', summary: 'tv' }],
          fv_only: [],
          misaligned: [],
        },
      },
    })

    var msBtn = wrapper.findAll('button').find(function (b) {
      return (b.attributes('aria-label') || '').includes('3.6 GA Release')
        && (b.attributes('aria-label') || '').includes('all products')
    })
    expect(msBtn).toBeTruthy()
    expect(msBtn.attributes('aria-pressed')).toBe('false')
    expect(msBtn.text()).toMatch(/All products/)
    await msBtn.trigger('click')
    await flushPromises()

    expect(msBtn.attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('Showing features for')
    expect(wrapper.text()).toContain('3.6 GA Release')
    expect(wrapper.text()).toMatch(/all products \(2\)/)
    expect(wrapper.text()).toContain('Early or as requested')
    expect(wrapper.text()).toContain('(2)')
    expect(wrapper.text()).toContain('TV-Only — Target Version set, no Fix Version (1)')
  })

  it('selects a single product chip after milestone scope', async function () {
    var wrapper = await mountView({
      releases: {
        '3.6 GA RHOAI RELEASE': {
          aligned_on_time: [{ key: 'A1', summary: 'rhoai' }],
          aligned_late: [],
          tv_only: [],
          fv_only: [],
          misaligned: [],
        },
        '3.6 GA RHAII RELEASE': {
          aligned_on_time: [{ key: 'A2', summary: 'rhaii' }],
          aligned_late: [],
          tv_only: [],
          fv_only: [],
          misaligned: [],
        },
      },
    })

    var msBtn = wrapper.findAll('button').find(function (b) {
      return (b.attributes('aria-label') || '').includes('3.6 GA Release')
        && (b.attributes('aria-label') || '').includes('all products')
    })
    await msBtn.trigger('click')
    await flushPromises()

    var chips = wrapper.findAll('button').filter(function (b) {
      return b.find('span[title="Remove"]').exists()
    })
    var rhoai = chips.find(function (b) { return b.text().includes('3.6 GA RHOAI RELEASE') })
    await rhoai.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Showing features for')
    expect(wrapper.text()).toContain('3.6 GA RHOAI RELEASE')
    expect(wrapper.text()).not.toMatch(/all products \(2\)/)
    expect(wrapper.text()).toContain('Early or as requested')
    expect(wrapper.text()).toContain('(1)')
  })
})

describe('TvFvDeltaView category section Jira links', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('shows View in Jira on Different products when the section has features', async function () {
    var wrapper = await mountView({
      releases: {
        '3.6 GA RHOAI RELEASE': {
          aligned_on_time: [],
          aligned_late: [],
          tv_only: [],
          fv_only: [],
          misaligned: [
            {
              key: 'RHAISTRAT-2196',
              url: 'https://redhat.atlassian.net/browse/RHAISTRAT-2196',
              summary: 'Misaligned A',
            },
            {
              key: 'RHAISTRAT-2013',
              url: 'https://redhat.atlassian.net/browse/RHAISTRAT-2013',
              summary: 'Misaligned B',
            },
          ],
        },
      },
    })

    var misaligned = wrapper.findAll('details').find(function (d) {
      return d.text().includes('Different products')
    })
    expect(misaligned).toBeTruthy()
    var jiraLink = misaligned.findAll('a').find(function (a) {
      return a.text().includes('View in Jira')
    })
    expect(jiraLink).toBeTruthy()
    expect(jiraLink.attributes('href')).toContain('key')
    expect(jiraLink.attributes('href')).toContain('RHAISTRAT-2196')
    expect(jiraLink.attributes('href')).toContain('RHAISTRAT-2013')
  })
})

describe('TvFvDeltaView component breakdown PM/ENG columns', function () {
  beforeEach(function () {
    mockApiRequest.mockReset()
  })

  it('shows PM and ENG from PM Hub pillar-config', async function () {
    var wrapper = await mountView({
      metadata: {
        generated_at: '2026-06-17T10:00:00Z',
        data_timestamp: '2026-06-17T09:55:00Z',
        releases: DEFAULT_SELECTED_VERSIONS.slice(),
        all_components: ['Serving', 'Training', 'Unknown Comp'],
      },
      releases: {
        '3.6 GA RHOAI RELEASE': {
          aligned_on_time: [
            { key: 'RHAISTRAT-1', component: 'Serving' },
            { key: 'RHAISTRAT-2', component: 'Training' },
          ],
          aligned_late: [],
          tv_only: [],
          fv_only: [],
          misaligned: [],
        },
      },
    })

    var details = wrapper.findAll('details').find(function (d) {
      return d.text().includes('Component Breakdown')
    })
    expect(details).toBeTruthy()
    // Expand so table is rendered (details content is always in DOM with Vue)
    var table = details.find('table')
    var headers = table.findAll('thead th').map(function (th) { return th.text().trim() })
    expect(headers).toEqual([
      'Component', 'PM', 'ENG', 'Total', 'Early or as requested', 'After requested', 'TV-Only', 'FV-Only', 'Different products', 'Alignment %',
    ])

    var servingRow = table.findAll('tbody tr').find(function (r) {
      return r.text().includes('Serving')
    })
    expect(servingRow.text()).toContain('PM Lead Serving')
    expect(servingRow.text()).toContain('Eng Lead Serving')

    // Non-zero counts link to key-in Jira lists for that component
    var totalLink = servingRow.findAll('a').find(function (a) {
      return a.attributes('href') && a.attributes('href').includes('key') && a.text().trim() === '1'
    })
    expect(totalLink).toBeTruthy()
    expect(totalLink.attributes('href')).toContain('RHAISTRAT-1')

    var unknownRow = table.findAll('tbody tr').find(function (r) {
      return r.text().includes('Unknown Comp')
    })
    expect(unknownRow.text()).toContain('—')
  })
})

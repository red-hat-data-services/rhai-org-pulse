import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

const mockLoadData = vi.fn()
const mockRefresh = vi.fn()
const mockData = ref(null)
const mockLoading = ref(false)
const mockError = ref(null)
const mockRefreshing = ref(false)

vi.mock('../../client/reports/composables/useRhoaiComponentArchitectures', () => ({
  useRhoaiComponentArchitectures: () => ({
    data: mockData,
    loading: mockLoading,
    error: mockError,
    refreshing: mockRefreshing,
    loadData: mockLoadData,
    refresh: mockRefresh
  })
}))

import RhoaiComponentArchitecturesReport from '../../client/reports/RhoaiComponentArchitecturesReport.vue'

function makeComp(name, productComponent, arches = {}) {
  return {
    name,
    imageName: name + '-rhel9',
    image: `quay.io/rhoai/${name}-rhel9`,
    productComponent,
    architectures: {
      amd64: arches.amd64 || { status: 'supported' },
      arm64: arches.arm64 || { status: 'supported' },
      ppc64le: arches.ppc64le || { status: 'not_built' },
      s390x: arches.s390x || { status: 'not_built' }
    }
  }
}

function makeData(components, opts = {}) {
  return {
    fetchedAt: '2026-08-18T12:00:00.000Z',
    source: { owner: 'red-hat-data-services', repo: 'konflux-central' },
    branches: {
      [opts.branch || 'rhoai-3.5']: {
        reportAvailable: true,
        components,
        summary: {
          totalComponents: components.length,
          fullMultiArch: 1,
          withExceptions: 0,
          withIncompatible: 0,
          withNotBuilt: 1
        }
      }
    },
    maturity: {
      available: opts.maturityAvailable !== false,
      fetchedAt: '2026-08-18T12:00:00.000Z',
      warning: opts.maturityWarning || null,
      allProductComponents: opts.allProductComponents || []
    },
    ...(opts.recommendedBranch ? { recommendedBranch: opts.recommendedBranch } : {})
  }
}

function mountReport() {
  return mount(RhoaiComponentArchitecturesReport, {
    global: {
      provide: {
        moduleNav: {
          navigateTo: vi.fn(),
          goBack: vi.fn()
        }
      },
      stubs: {
        ArrowLeft: { template: '<span />' },
        RefreshCw: { template: '<span />' },
        Cpu: { template: '<span />' },
        Search: { template: '<span />' },
        Check: { template: '<span />' },
        Minus: { template: '<span />' },
        Package: { template: '<span />' },
        FileCode: { template: '<span />' },
        BookOpen: { template: '<span />' },
        AlertTriangle: { template: '<span data-testid="alert-triangle" />' },
        ExternalLink: { template: '<span data-testid="external-link" />' }
      }
    }
  })
}

function pcObj(name, owner = null, team = null) {
  return { name, owner, team }
}

describe('RhoaiComponentArchitecturesReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockData.value = null
    mockLoading.value = false
    mockError.value = null
    mockRefreshing.value = false
    mockLoadData.mockResolvedValue()
  })

  it('renders grouped table with Product Component column when maturity data exists', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-model-controller', 'Serving Orchestration'),
      makeComp('odh-dashboard', 'AI Core Dashboard')
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('AI Core Dashboard'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const headers = wrapper.findAll('th')
    expect(headers.some(h => h.text().includes('Product Component'))).toBe(true)

    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBeGreaterThanOrEqual(3)

    const rowspanCell = wrapper.find('td[rowspan]')
    expect(rowspanCell.exists()).toBe(true)
  })

  it('column headers are links when maturity data exists', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration')
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const headerLinks = wrapper.findAll('th a')
    const hrefs = headerLinks.map(a => a.attributes('href'))
    expect(hrefs.some(h => h && h.includes('konflux-central'))).toBe(true)
  })

  it('not-found-in-konflux card links to Component Maturity GitLab repo', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration')
    ]

    mockData.value = makeData(components, {
      branch: 'rhoai-3.5',
      allProductComponents: [pcObj('Serving Orchestration'), pcObj('Unmapped PC')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const konfluxCard = wrapper.find('#not-found-in-konflux')
    expect(konfluxCard.exists()).toBe(true)
    const maturityLink = konfluxCard.findAll('a').find(a =>
      a.attributes('href')?.includes('gitlab.cee.redhat.com/data-hub/component-maturity')
    )
    expect(maturityLink).toBeTruthy()
  })

  it('unmapped components shown in separate card with unknown', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const card = wrapper.find('#unknown-product-component')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('not matched to a Product Component')
    expect(card.text()).toContain('odh-unknown')
    expect(card.text()).toContain('unknown')
  })

  it('warning count messages live in a table <caption>, not confused with header/content', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const expected = {
      '#not-found-in-konflux': 'not found in Konflux',
      '#unknown-product-component': 'not matched to a Product Component'
    }
    for (const [id, text] of Object.entries(expected)) {
      const card = wrapper.find(id)
      expect(card.exists()).toBe(true)
      // The count message is a <caption> of the table — semantically the table's
      // title, so it is part of the table but cannot be a column header or a row.
      const caption = card.find('table caption')
      expect(caption.exists()).toBe(true)
      expect(caption.text()).toContain(text)
      // Rendered at the top and amber-tinted so it reads as a notice.
      expect(caption.classes()).toContain('caption-top')
      expect(caption.classes()).toContain('bg-amber-50')
      // It is a <caption>, never a <th>/<td> (would be confused with data/header).
      expect(caption.element.tagName).toBe('CAPTION')
      expect(caption.element.closest('thead')).toBeNull()
      expect(caption.find('th').exists()).toBe(false)
      expect(caption.find('td').exists()).toBe(false)
      // Carries a warning icon to reinforce it is a notice, not data.
      expect(caption.find('svg').exists()).toBe(true)
    }
  })

  it('table headers are not sticky — tables render as regular full-height HTML tables', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    // The tables are regular HTML tables: headers must not float/follow while
    // scrolling, so no header cell in any table may carry sticky positioning.
    const ths = wrapper.findAll('table thead th')
    expect(ths.length).toBeGreaterThan(0)
    for (const th of ths) {
      expect(th.classes()).not.toContain('sticky')
    }
  })

  it('Component Image header links to konflux-central on the selected branch', async () => {
    mockData.value = makeData([makeComp('odh-kserve-controller', 'Serving')], {
      allProductComponents: [pcObj('Serving')]
    })
    const wrapper = mountReport()
    await flushPromises()

    const branch = wrapper.find('select').element.value
    expect(branch).toBeTruthy()
    const link = wrapper.findAll('table thead th a')
      .find(a => a.text().includes('Component Image'))
    expect(link).toBeTruthy()
    expect(link.attributes('href')).toBe(
      `https://github.com/red-hat-data-services/konflux-central/tree/${branch}`
    )
  })

  it('renders without crashing when a component has no architectures object', async () => {
    // Regression: real konflux-central data can contain components with a missing
    // architectures key; indexing into it crashed the whole report (RHOAIENG-84746).
    const broken = { name: 'odh-no-arch', productComponent: 'Serving', image: 'quay.io/rhoai/x' }
    // No `architectures` property at all.
    mockData.value = makeData([broken], {
      allProductComponents: [pcObj('Serving')]
    })
    const wrapper = mountReport()
    await flushPromises()

    // Report renders the grouped table; the arch cells fall back to the em dash.
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('odh-no-arch')
  })

  it('renders the flat table without crashing when a component has no architectures object', async () => {
    // Regression (RHOAIENG-84746): the flat table path (no maturity data) also
    // indexes comp.architectures[arch] and must tolerate a missing key.
    const broken = { name: 'odh-flat-no-arch', productComponent: null, image: 'quay.io/rhoai/x' }
    mockData.value = makeData([broken], { maturityAvailable: false, allProductComponents: [] })

    const wrapper = mountReport()
    await flushPromises()

    // No maturity data => flat table (no Product Component column).
    const headers = wrapper.findAll('th')
    expect(headers.some(h => h.text().includes('Product Component'))).toBe(false)
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('odh-flat-no-arch')
  })

  it('renders the unknown-product-component section without crashing when a component has no architectures object', async () => {
    // Regression (RHOAIENG-84746): the unmapped-components table is a third path
    // that indexes comp.architectures[arch]; it must tolerate a missing key too.
    const mapped = makeComp('odh-kserve-controller', 'Serving Orchestration')
    const unmappedBroken = { name: 'odh-unmapped-no-arch', productComponent: null, image: 'quay.io/rhoai/y' }
    mockData.value = makeData([mapped, unmappedBroken], {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const card = wrapper.find('#unknown-product-component')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('odh-unmapped-no-arch')
  })

  it('renders without crashing when architectures is explicitly null', async () => {
    // Real upstream data is more likely to emit `architectures: null` than to omit
    // the key entirely; the optional-chaining guards must handle both.
    const broken = { name: 'odh-null-arch', productComponent: 'Serving', image: 'quay.io/rhoai/z', architectures: null }
    mockData.value = makeData([broken], {
      allProductComponents: [pcObj('Serving')]
    })

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('odh-null-arch')
  })

  it('renders without crashing when allProductComponents contains a null entry', async () => {
    // Defensive: a degenerate maturity payload with a null entry must not throw
    // while building the product-component map.
    const components = [makeComp('odh-kserve-controller', 'Serving Orchestration')]
    mockData.value = makeData(components, {
      allProductComponents: [null, pcObj('Serving Orchestration'), pcObj('Data Connect Hub')]
    })

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(true)
    // The valid entries still render (Data Connect Hub is unmatched in Konflux).
    expect(wrapper.text()).toContain('Data Connect Hub')
  })

  it('empty product components shown in separate card with unknown', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration')
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const card = wrapper.find('#not-found-in-konflux')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('Data Connect Hub')
    expect(card.text()).toContain('unknown')
    expect(card.text()).toContain('not found in Konflux')
  })

  it('empty product component rows show owner/team when available', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration')
    ]

    mockData.value = makeData(components, {
      allProductComponents: [
        pcObj('Data Connect Hub', 'jdoe', 'Data Team'),
        pcObj('Serving Orchestration')
      ]
    })

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.text()).toContain('Data Connect Hub')
    expect(wrapper.text()).toContain('(Data Team)')
  })

  it('mismatch sections shown as separate cards', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('not found in Konflux')
    expect(text).toContain('not matched to a Product Component')
  })

  it('explanation section visible when mismatches exist', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const konfluxCard = wrapper.find('#not-found-in-konflux')
    expect(konfluxCard.exists()).toBe(true)
    expect(konfluxCard.text()).toContain('To fix:')
    expect(konfluxCard.text()).toContain('Component Maturity')
  })

  it('explanation section hidden when no mismatches', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-dashboard', 'AI Core Dashboard')
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('AI Core Dashboard'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.find('#not-found-in-konflux').exists()).toBe(false)
    expect(wrapper.find('#unknown-product-component').exists()).toBe(false)
  })

  it('renders flat table without Product Component column when no maturity data', async () => {
    const components = [
      makeComp('odh-kserve-controller', null),
      makeComp('odh-dashboard', null)
    ]

    mockData.value = makeData(components, { maturityAvailable: false, allProductComponents: [] })

    const wrapper = mountReport()
    await flushPromises()

    const headers = wrapper.findAll('th')
    expect(headers.some(h => h.text().includes('Product Component'))).toBe(false)

    const componentHeader = headers.find(h => h.text().trim() === 'Component Image')
    expect(componentHeader).toBeTruthy()

    expect(wrapper.find('td[rowspan]').exists()).toBe(false)
  })

  it('shows maturity warning banner when data.maturity.warning exists', async () => {
    const components = [makeComp('odh-kserve-controller', null)]

    mockData.value = makeData(components, {
      maturityWarning: 'GITLAB_CEE_TOKEN not configured',
      maturityAvailable: false,
      allProductComponents: []
    })

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.text()).toContain('GITLAB_CEE_TOKEN not configured')
  })

  it('filters components by search query including product component name', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-dashboard', 'AI Core Dashboard')
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('AI Core Dashboard'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const input = wrapper.find('input[type="text"]')
    await input.setValue('Dashboard')
    await flushPromises()

    expect(wrapper.text()).toContain('AI Core Dashboard')
    expect(wrapper.text()).toContain('odh-dashboard')
    expect(wrapper.text()).not.toContain('odh-kserve-controller')
  })

  it('mismatch summary tiles show counts', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const tiles = wrapper.findAll('div[role="link"]')
    const konfluxTile = tiles.find(t => t.text().includes('Missing in Konflux'))
    expect(konfluxTile).toBeTruthy()

    const unknownTile = tiles.find(t => t.text().includes('Unknown Product Component'))
    expect(unknownTile).toBeTruthy()
  })

  it('mismatch tiles link to card sections', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]

    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const tiles = wrapper.findAll('div[role="link"]')
    expect(tiles.some(t => t.text().includes('Missing in Konflux'))).toBe(true)
    expect(tiles.some(t => t.text().includes('Unknown Product Component'))).toBe(true)
  })

  it('branch selector appears in header row', async () => {
    const components = [makeComp('odh-kserve-controller', 'Serving Orchestration')]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const header = wrapper.find('.flex.flex-wrap.items-center.gap-3.mb-4')
    expect(header.exists()).toBe(true)
    const select = header.find('select')
    expect(select.exists()).toBe(true)
  })

  it('search bar hidden when report not available', async () => {
    mockData.value = makeData([], { branch: 'rhoai-3.6-ea.2' })
    mockData.value.branches = { 'rhoai-3.6-ea.2': { reportAvailable: false, components: [], summary: null } }

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.text()).toContain('No multi-arch report')
    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
  })

  it('summary tiles appear before search bar in DOM order', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const html = wrapper.html()
    const tilesPos = html.indexOf('Missing in Konflux')
    const searchPos = html.indexOf('Filter components')
    expect(tilesPos).toBeGreaterThan(-1)
    expect(searchPos).toBeGreaterThan(-1)
    expect(tilesPos).toBeLessThan(searchPos)
  })

  it('legend is grouped with table, not separated by section spacing', async () => {
    const components = [makeComp('odh-kserve-controller', 'Serving Orchestration')]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const legendText = 'Konflux PipelineRun config'
    const legendContainer = wrapper.findAll('div').find(d =>
      d.text().includes(legendText) && d.find('table').exists()
    )
    expect(legendContainer).toBeTruthy()
  })

  it('table rows use alternating backgrounds per group', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-dashboard', 'AI Core Dashboard')
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('AI Core Dashboard'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    const dataRows = rows.filter(r => !r.classes().includes('border-b'))
    expect(dataRows.length).toBeGreaterThan(0)

    const hasAlternating = rows.some(r => r.classes().some(c => c.includes('bg-gray-50')))
    expect(hasAlternating).toBe(true)
  })

  it('hover uses blue tint distinct from alternating gray', async () => {
    const components = [makeComp('odh-kserve-controller', 'Serving Orchestration')]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    const hasBlueHover = rows.some(r => r.classes().some(c => c.includes('hover:bg-blue-50')))
    expect(hasBlueHover).toBe(true)
  })

  it('product component cells include JIRA search link', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration')
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const jiraLinks = wrapper.findAll('a').filter(a =>
      a.attributes('href')?.startsWith('https://redhat.atlassian.net/') &&
      a.attributes('href')?.includes('RHAI') &&
      a.text() === 'JIRA'
    )
    expect(jiraLinks.length).toBeGreaterThan(0)
    expect(jiraLinks[0].attributes('href')).toContain(encodeURIComponent('Serving Orchestration'))
  })

  it('product component cells include Maturity links', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration')
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const maturityLinks = wrapper.findAll('a').filter(a =>
      a.attributes('href') === '#/system-health/component-maturity' &&
      a.text() === 'Maturity'
    )
    expect(maturityLinks.length).toBeGreaterThan(0)

    const externalLinks = wrapper.findAll('a').filter(a =>
      a.attributes('href')?.includes('data-hub.pages.redhat.com/component-maturity')
    )
    expect(externalLinks.length).toBeGreaterThan(0)
  })

  it('card footers reference Component Maturity not Product Catalog or Supported Configs', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const text = wrapper.text()
    expect(text).not.toContain('Product Catalog')
    expect(text).not.toContain('Supported Configs')
    expect(text).toContain('Component Maturity')
  })

  it('unknown product component card rows do not show JIRA or Maturity links', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const card = wrapper.find('#unknown-product-component')
    expect(card.exists()).toBe(true)
    const jiraLinks = card.findAll('a').filter(a => a.text() === 'JIRA')
    expect(jiraLinks.length).toBe(0)
    const maturityLinks = card.findAll('a').filter(a => a.text() === 'Maturity')
    expect(maturityLinks.length).toBe(0)
  })

  it('not found in Konflux card includes JIRA links', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration')
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const card = wrapper.find('#not-found-in-konflux')
    expect(card.exists()).toBe(true)
    const jiraLink = card.findAll('a').find(a =>
      a.text() === 'JIRA' && a.attributes('href')?.includes('RHAI')
    )
    expect(jiraLink).toBeTruthy()
    expect(jiraLink.attributes('href')).toContain(encodeURIComponent('Data Connect Hub'))
  })

  it('defaults to recommendedBranch when provided by API', async () => {
    const components35 = [makeComp('odh-kserve-controller', 'Serving Orchestration')]
    const components36 = [makeComp('odh-dashboard', 'AI Core Dashboard')]

    mockData.value = {
      fetchedAt: '2026-08-18T12:00:00.000Z',
      source: { owner: 'red-hat-data-services', repo: 'konflux-central' },
      branches: {
        'rhoai-3.6': {
          reportAvailable: true,
          components: components36,
          summary: { totalComponents: 1, fullMultiArch: 1, withExceptions: 0, withIncompatible: 0, withNotBuilt: 0 }
        },
        'rhoai-3.5': {
          reportAvailable: true,
          components: components35,
          summary: { totalComponents: 1, fullMultiArch: 1, withExceptions: 0, withIncompatible: 0, withNotBuilt: 0 }
        }
      },
      maturity: { available: false, fetchedAt: null, warning: null, allProductComponents: [] },
      recommendedBranch: 'rhoai-3.5'
    }

    const wrapper = mountReport()
    await flushPromises()

    const select = wrapper.find('select')
    expect(select.element.value).toBe('rhoai-3.5')
  })

  it('explanation cards include JIRA Components links', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const notFoundCard = wrapper.find('#not-found-in-konflux')
    const notFoundJiraLinks = notFoundCard.findAll('a').filter(a =>
      a.attributes('href')?.includes('projects/RHAI/components') &&
      a.text() === 'JIRA Components'
    )
    expect(notFoundJiraLinks.length).toBeGreaterThan(0)

    const unknownCard = wrapper.find('#unknown-product-component')
    const unknownJiraLinks = unknownCard.findAll('a').filter(a =>
      a.attributes('href')?.includes('projects/RHAI/components') &&
      a.text() === 'JIRA Components'
    )
    expect(unknownJiraLinks.length).toBeGreaterThan(0)
  })

  it('column headers say Component Image not Component in Konflux', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration')
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Serving Orchestration')]
    })

    const wrapper = mountReport()
    await flushPromises()

    const headers = wrapper.findAll('th')
    expect(headers.some(h => h.text().includes('Component Image'))).toBe(true)
    expect(headers.some(h => h.text().includes('Component in Konflux'))).toBe(false)
  })

  it('branch selector shows latest branch first (descending release order)', async () => {
    const comp = makeComp('odh-kserve-controller', null)
    const branchData = {
      reportAvailable: true,
      components: [comp],
      summary: { totalComponents: 1, fullMultiArch: 0, withExceptions: 0, withIncompatible: 0, withNotBuilt: 1 }
    }
    mockData.value = {
      fetchedAt: '2026-08-18T12:00:00.000Z',
      source: { owner: 'red-hat-data-services', repo: 'konflux-central' },
      branches: {
        'rhoai-3.5': branchData,
        'rhoai-3.5-ea.1': branchData,
        'rhoai-3.6-ea.1': branchData,
        'rhoai-3.5-ea.2': branchData
      },
      maturity: { available: false, fetchedAt: null, warning: null, allProductComponents: [] },
      recommendedBranch: null
    }

    const wrapper = mountReport()
    await flushPromises()

    const options = wrapper.findAll('select option')
    const labels = options.map(o => o.text())
    // Latest release at the top; within a version EA precedes its GA.
    expect(labels).toEqual(['rhoai-3.6-ea.1', 'rhoai-3.5', 'rhoai-3.5-ea.2', 'rhoai-3.5-ea.1'])
    // Default selection (no recommendedBranch) is the latest branch.
    expect(wrapper.find('select').element.value).toBe('rhoai-3.6-ea.1')
  })

  it('top-level report sections have generous vertical spacing', async () => {
    mockData.value = makeData([makeComp('odh-kserve-controller', 'Serving')], {
      allProductComponents: [pcObj('Serving')]
    })
    const wrapper = mountReport()
    await flushPromises()

    // The data container stacks the summary cards, matrix, and extra tables.
    // Guard the gap so it can't silently shrink back to a cramped value.
    const summaryGrid = wrapper.find('.grid')
    const sectionContainer = summaryGrid.element.parentElement
    const spacingClass = [...sectionContainer.classList].find(c => /^space-y-\d+$/.test(c))
    expect(spacingClass).toBeTruthy()
    const gap = Number(spacingClass.replace('space-y-', ''))
    expect(gap).toBeGreaterThanOrEqual(10)
  })

  it('main table thead is not sticky (regular HTML table header)', async () => {
    mockData.value = makeData([makeComp('odh-kserve-controller', 'Serving')], {
      allProductComponents: [pcObj('Serving')]
    })
    const wrapper = mountReport()
    await flushPromises()

    const thead = wrapper.find('table thead')
    expect(thead.exists()).toBe(true)
    expect(thead.classes()).not.toContain('sticky')
    expect(thead.classes()).not.toContain('top-0')
  })

  it('tables have no height cap or vertical scroll box so they render as regular full-height tables', async () => {
    // The tables used to sit in max-h-[32rem] scroll boxes so their sticky
    // headers could pin. They are now regular HTML tables: the wrapper must not
    // cap the height or scroll vertically, so the table grows with its content
    // and the header scrolls away with the page (only horizontal overflow on
    // narrow screens is allowed).
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })
    const wrapper = mountReport()
    await flushPromises()

    const scrollDivs = wrapper.findAll('table').map(t => t.element.parentElement)
    expect(scrollDivs.length).toBeGreaterThan(0)
    for (const scrollDiv of scrollDivs) {
      expect(scrollDiv.className).not.toMatch(/max-h-\[/)
      expect(scrollDiv.className).not.toContain('overflow-auto')
    }
  })

  it('corner header cells are not sticky when maturity data exists', async () => {
    mockData.value = makeData([makeComp('odh-kserve-controller', 'Serving')], {
      allProductComponents: [pcObj('Serving')]
    })
    const wrapper = mountReport()
    await flushPromises()

    const ths = wrapper.findAll('table thead th')
    expect(ths.length).toBeGreaterThan(1)
    expect(ths[0].classes()).not.toContain('sticky')
    expect(ths[1].classes()).not.toContain('sticky')
  })

  it('handles loading, error, and missing branch data states', async () => {
    mockLoading.value = true
    const loadingWrapper = mountReport()
    expect(loadingWrapper.find('.animate-spin').exists()).toBe(true)

    mockLoading.value = false
    mockError.value = 'Unable to fetch report'
    const errorWrapper = mountReport()
    expect(errorWrapper.text()).toContain('Unable to fetch report')

    mockError.value = null
    mockData.value = { source: null, branches: null, maturity: null }
    const emptyWrapper = mountReport()
    await flushPromises()
    expect(emptyWrapper.find('table').exists()).toBe(true)
    expect(emptyWrapper.findAll('tbody tr')).toHaveLength(0)
  })

  it('sorts and falls back safely for non-release branch names', async () => {
    const branch = {
      reportAvailable: true,
      components: [makeComp('odh-kserve-controller', null)],
      summary: { totalComponents: 1, fullMultiArch: 0, withExceptions: 0, withIncompatible: 0, withNotBuilt: 1 }
    }
    mockData.value = {
      source: { owner: 'red-hat-data-services', repo: 'konflux-central' },
      branches: { main: branch, 'rhoai-3.5': branch },
      maturity: { available: false, allProductComponents: [] }
    }
    const wrapper = mountReport()
    await flushPromises()
    expect(wrapper.findAll('select option').map(option => option.text())).toEqual(['rhoai-3.5', 'main'])
  })

  it('invokes back and refresh actions from the report header', async () => {
    mockData.value = makeData([makeComp('odh-kserve-controller', null)], {
      maturityAvailable: false,
      allProductComponents: []
    })
    const wrapper = mountReport()
    await flushPromises()

    await wrapper.find('button[title="Back to Reports"]').trigger('click')
    expect(wrapper.vm.nav.navigateTo).toHaveBeenCalledWith('reports')
    await wrapper.findAll('button').find(button => button.text().includes('Refresh')).trigger('click')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('scrolls to mismatch cards when summary tiles are activated', async () => {
    const components = [
      makeComp('odh-kserve-controller', 'Serving Orchestration'),
      makeComp('odh-unknown', null)
    ]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })
    const wrapper = mountReport()
    await flushPromises()

    const scrollIntoView = vi.fn()
    const originalGetElementById = document.getElementById
    document.getElementById = vi.fn(() => ({ scrollIntoView }))
    try {
      const tiles = wrapper.findAll('div[role="link"]')
      await tiles.find(tile => tile.text().includes('Missing in Konflux')).trigger('click')
      await tiles.find(tile => tile.text().includes('Unknown Product Component')).trigger('keydown.enter')
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    } finally {
      document.getElementById = originalGetElementById
    }
  })

  it('filters empty and unmapped sections by search text', async () => {
    const components = [makeComp('odh-kserve-controller', 'Serving Orchestration'), makeComp('odh-dashboard', null)]
    mockData.value = makeData(components, {
      allProductComponents: [pcObj('Data Connect Hub'), pcObj('Serving Orchestration')]
    })
    const wrapper = mountReport()
    await flushPromises()

    await wrapper.find('input[type="text"]').setValue('does-not-match')
    await flushPromises()
    expect(wrapper.find('#not-found-in-konflux').exists()).toBe(false)
    expect(wrapper.find('#unknown-product-component').exists()).toBe(false)
  })

  it('covers branch selection and report URL helper fallbacks', async () => {
    const mapped = makeComp('odh-kserve-controller', 'Serving Orchestration')
    mapped.pipelineRunFile = 'pipelines/odh-kserve.yaml'
    mockData.value = makeData([mapped, makeComp('z-unmapped', null), makeComp('a-unmapped', null)], {
      allProductComponents: [pcObj('Serving Orchestration')]
    })
    const wrapper = mountReport()
    await flushPromises()

    const select = wrapper.find('select')
    await select.setValue('rhoai-3.5')
    expect(select.element.value).toBe('rhoai-3.5')
    expect(wrapper.vm.quayUrl()).toBe('#')
    expect(wrapper.vm.quayUrl('registry.example/image')).toContain('registry.example/image')
    expect(wrapper.vm.pipelineRunUrl({})).toBe('#')
    expect(wrapper.vm.pipelineRunUrl({ pipelineRunFile: 'pipelines/test.yaml' })).toContain('pipelines/test.yaml')
    wrapper.vm.selectedBranch = null
    expect(wrapper.vm.pipelineRunUrl({ pipelineRunFile: 'pipelines/test.yaml' })).toBe('#')
    expect(wrapper.vm.jiraSearchUrl()).toBeNull()
    expect(wrapper.vm.jiraSearchUrl('Serving Orchestration')).toContain('component')
    expect(wrapper.vm.formatDate()).toBe('')
  })

  it('refresh button in the empty state triggers a refresh', async () => {
    mockData.value = null
    const wrapper = mountReport()
    await flushPromises()

    const emptyState = wrapper.find('.py-24')
    expect(emptyState.exists()).toBe(true)
    await emptyState.findAll('button').find(button => button.text().includes('Refresh')).trigger('click')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('error state offers a Try refreshing action', async () => {
    mockError.value = 'Unable to fetch report'
    const wrapper = mountReport()

    await wrapper.findAll('button').find(button => button.text().includes('Try refreshing')).trigger('click')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('tolerates a missing section element when scrolling', async () => {
    mockData.value = makeData([makeComp('odh-unknown', null)])
    const wrapper = mountReport()
    await flushPromises()

    const originalGetElementById = document.getElementById
    document.getElementById = vi.fn(() => null)
    try {
      expect(() => wrapper.vm.scrollToSection('does-not-exist')).not.toThrow()
    } finally {
      document.getElementById = originalGetElementById
    }
  })

  it('konflux branch url falls back to the repo root without a selected branch', async () => {
    mockData.value = makeData([makeComp('odh-x', null)], { maturityAvailable: false })
    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.vm.konfluxBranchUrl).toContain('rhoai-3.5')
    wrapper.vm.selectedBranch = null
    expect(wrapper.vm.konfluxBranchUrl).toBe('https://github.com/red-hat-data-services/konflux-central')
  })

  it('covers architecture status fallbacks and flat-table branches', async () => {
    const mapped = makeComp('odh-statuses', 'Serving', {
      amd64: { status: 'incompatible' },
      arm64: { status: 'exception' },
      ppc64le: { status: 'supported' },
      s390x: { status: 'not_built' }
    })
    const unmapped = makeComp('odh-tracked-exception', null, {
      amd64: { status: 'exception', issueUrl: 'https://issues.example/123', reason: 'Temporary waiver', issueKey: 'RHOAI-123' },
      arm64: { status: 'incompatible', accelerator: 'GPU' },
      ppc64le: { status: 'supported' },
      s390x: { status: 'not_built' }
    })
    const unmappedFallback = makeComp('odh-untracked-exception', null, {
      amd64: { status: 'exception' }
    })
    mapped.image = null
    mapped.pipelineRunFile = 'pipelines/statuses.yaml'
    mockData.value = makeData([mapped, unmapped, unmappedFallback], {
      allProductComponents: ['Serving']
    })

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.text()).toContain('N/A')
    expect(wrapper.text()).toContain('EXC')
    expect(wrapper.text()).toContain('RHOAI-123')
    expect(wrapper.find('#unknown-product-component').exists()).toBe(true)
    expect(wrapper.vm.allProductComponentMap.get('Serving').name).toBe('Serving')

    // Force the computed-only fallback paths used when maturity data is absent.
    const flat = makeComp('odh-flat-statuses', null, {
      amd64: { status: 'incompatible' },
      arm64: { status: 'exception' },
      ppc64le: { status: 'supported' },
      s390x: { status: 'not_built' }
    })
    flat.pipelineRunFile = 'pipelines/flat-statuses.yaml'
    mockData.value = makeData([flat], { maturityAvailable: false })
    await flushPromises()
    expect(wrapper.vm.displayGroups).toEqual([])
    expect(wrapper.vm.emptyProductComponents).toEqual([])
    expect(wrapper.text()).toContain('odh-flat-statuses')

    wrapper.vm.selectedBranch = null
    expect(wrapper.vm.emptyProductComponents).toEqual([])

    mockData.value = { source: null, branches: null, maturity: undefined }
    await flushPromises()
    expect(wrapper.vm.allProductComponentMap.size).toBe(0)
  })

  it('renders the singular mismatch caption and refreshing states', async () => {
    mockData.value = makeData([makeComp('odh-only', 'Serving')], {
      allProductComponents: [pcObj('Serving'), pcObj('Missing', 'Owner')]
    })
    mockRefreshing.value = true
    const dataWrapper = mountReport()
    await flushPromises()
    expect(dataWrapper.text()).toContain('Refreshing...')
    expect(dataWrapper.find('#not-found-in-konflux').text()).toContain('1 component not found')

    mockData.value = null
    const emptyWrapper = mountReport()
    await flushPromises()
    expect(emptyWrapper.text()).toContain('Loading...')
  })
})

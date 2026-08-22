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
})

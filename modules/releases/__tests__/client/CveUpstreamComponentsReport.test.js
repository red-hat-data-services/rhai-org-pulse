import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCveSustaining } from '../../client/reports/composables/useCveSustaining.js'
import CveUpstreamComponentsReport from '../../client/reports/CveUpstreamComponentsReport.vue'

vi.mock('vue-chartjs', () => ({
  Doughnut: {
    name: 'MockDoughnut',
    props: ['data', 'options'],
    template: '<div class="donut-chart" />'
  }
}))

vi.mock('../../client/reports/composables/useCveSustaining.js', () => ({
  useCveSustaining: vi.fn()
}))

function issue(key, labels, upstreamComponent, versions = ['rhoai-2.17']) {
  return {
    key,
    summary: `CVE issue ${key}`,
    component: 'Model Serving',
    components: ['Model Serving'],
    versions,
    status: 'New',
    assignee: 'Alice',
    duedate: null,
    possiblyClosable: false,
    labels,
    upstreamComponent
  }
}

function payload(records = [
  issue('RHAI-1', ['ecosystem:pypi'], 'fickling', ['rhoai-2.16']),
  issue('RHAI-2', ['ecosystem:pypi'], 'fickling', ['rhoai-2.17']),
  issue('RHAI-3', ['ecosystem:pypi'], 'other-package'),
  issue('RHAI-4', ['ecosystem:golang'], 'example.org/lib/v2'),
  issue('RHAI-5', ['ecosystem:golang'], 'example.org/lib/v2', ['rhoai-2.16', 'rhoai-2.17']),
  issue('RHAI-6', ['ecosystem:pypi', 'ecosystem:golang'], 'shared-package'),
  issue('RHAI-7', [], null),
  issue('RHAI-8', [], 'unlabeled-package')
]) {
  return {
    upstreamComponentDataVersion: 1,
    jiraSearchBase: 'https://jira.example/issues/?jql=',
    lastRefreshed: '2026-11-02T12:30:00.000Z',
    openIssueRecords: records
  }
}

function normalizeCssColor(color) {
  const element = document.createElement('span')
  element.style.backgroundColor = color
  return element.style.backgroundColor
}

function createService(overrides = {}) {
  return {
    data: ref(payload()),
    loading: ref(false),
    error: ref(null),
    refreshError: ref(null),
    refreshing: ref(false),
    loadData: vi.fn(),
    refresh: vi.fn(),
    cleanup: vi.fn(),
    ...overrides
  }
}

function mountReport(service = createService()) {
  vi.mocked(useCveSustaining).mockReturnValue(service)
  const navigateTo = vi.fn()
  const wrapper = mount(CveUpstreamComponentsReport, {
    global: {
      provide: {
        moduleNav: { navigateTo }
      }
    }
  })
  return { wrapper, service, navigateTo }
}

describe('CveUpstreamComponentsReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the all-ticket ecosystem donut and visible count/percentage legend', () => {
    const { wrapper } = mountReport()
    const chart = wrapper.findComponent({ name: 'MockDoughnut' })

    expect(wrapper.get('h2').text()).toBe('CVE Upstream Components')
    expect(wrapper.text()).toContain('Last refreshed:')
    expect(wrapper.text()).toContain('Nov 2, 2026')
    expect(chart.props('data').labels).toEqual(['pypi', 'golang', 'Multiple ecosystems', 'Unknown'])
    expect(chart.props('data').datasets[0].data).toEqual([3, 2, 1, 1])
    expect(wrapper.get('[aria-label="Ecosystem distribution legend"]').text()).toContain('pypi')
    expect(wrapper.get('[aria-label="Ecosystem distribution legend"]').text()).toContain('3 tickets (42.86%)')
    expect(wrapper.get('[aria-label="Ecosystem distribution legend"]').text()).toContain('Multiple ecosystems')
    expect(wrapper.text()).toContain('The chart includes all 7 open tickets with an upstream component')
  })

  it('keeps each visible legend swatch aligned with its donut slice color', () => {
    const { wrapper } = mountReport()
    const chart = wrapper.findComponent({ name: 'MockDoughnut' })
    const legend = wrapper.get('[aria-label="Ecosystem distribution legend"]')
    const swatchColors = legend.findAll('li [aria-hidden="true"]')
      .map(swatch => swatch.element.style.backgroundColor)
    const chartColors = chart.props('data').datasets[0].backgroundColor

    expect(chart.props('data').labels).toEqual(['pypi', 'golang', 'Multiple ecosystems', 'Unknown'])
    expect(swatchColors).toEqual(chartColors.map(normalizeCssColor))
  })

  it('renders descending component rows, field headers, and safe live Jira links by default', () => {
    const { wrapper } = mountReport()

    expect(wrapper.findAll('thead th').map(header => header.text())).toEqual([
      'Upstream component', 'Ecosystem', 'Open tickets'
    ])
    const rowValues = wrapper.findAll('tbody tr').map(row => {
      const cells = row.findAll('td')
      return [cells[0].find('a').text(), cells[1].text(), cells[2].text()]
    })
    expect(rowValues).toEqual([
      ['example.org/lib/v2', 'golang', '2'],
      ['fickling', 'pypi', '2'],
      ['other-package', 'pypi', '1'],
      ['shared-package', 'golang, pypi', '1'],
      ['unlabeled-package', 'Unknown', '1']
    ])

    const componentLink = wrapper.findAll('tbody a').find(link => link.text() === 'example.org/lib/v2')
    expect(componentLink.attributes('href')).toMatch(/^https:\/\/jira\.example\/issues\/\?jql=/)
    expect(componentLink.attributes('target')).toBe('_blank')
    expect(componentLink.attributes('rel')).toContain('noopener')
    expect(componentLink.attributes('rel')).toContain('noreferrer')
    for (const link of wrapper.findAll('tbody a')) {
      expect(link.get('svg.lucide-external-link').attributes('aria-hidden')).toBe('true')
      expect(link.attributes('aria-label')).toBe(`${link.text()} (opens in a new tab)`)
    }
  })

  it('filters rows by ecosystem and restores all rows through the All ecosystems option', async () => {
    const { wrapper } = mountReport()
    const selector = wrapper.get('select[aria-label="Filter component rows by ecosystem"]')

    expect(selector.element.value).toBe('')
    await selector.setValue('pypi')
    expect(wrapper.findAll('tbody tr').map(row => row.text())).toEqual([
      expect.stringContaining('fickling'),
      expect.stringContaining('other-package'),
      expect.stringContaining('shared-package')
    ])
    expect(wrapper.findComponent({ name: 'MockDoughnut' }).props('data').datasets[0].data).toEqual([3, 2, 1, 1])

    await selector.setValue('')
    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
  })

  it('keeps the global phrase-search caveat without redundant table warnings', () => {
    const { wrapper } = mountReport()
    const unknownRow = wrapper.findAll('tbody tr').find(row => row.text().includes('Unknown'))

    expect(wrapper.text()).toContain('Jira phrase search is not exact equality')
    expect(unknownRow.findAll('td').map(cell => cell.text())).toEqual(['unlabeled-package', 'Unknown', '1'])
    expect(wrapper.text()).not.toContain('ecosystem membership is not constrained')
  })

  it('ignores tickets without components and explains non-overlapping multi-ecosystem groups', () => {
    const { wrapper } = mountReport()

    expect(wrapper.text()).not.toContain('no upstream component')
    expect(wrapper.text()).not.toContain('table row totals may overlap')
    expect(wrapper.text()).toContain('components associated with multiple ecosystems')
    expect(wrapper.findAll('tbody tr').filter(row => row.text().includes('shared-package'))).toHaveLength(1)
  })

  it('uses unique slice and matching legend colors beyond the old palette including special categories', () => {
    const records = Array.from({ length: 30 }, (_, index) => issue(
      `RHAI-COLOR-${index}`, [`ecosystem:eco-${index}`], `package-${index}`
    ))
    records.push(issue('RHAI-COLOR-UNKNOWN', [], 'unknown-color'))
    records.push(issue('RHAI-COLOR-MULTI', ['ecosystem:pypi', 'ecosystem:rpm'], 'multi-color'))
    const { wrapper } = mountReport(createService({ data: ref(payload(records)) }))
    const chart = wrapper.findComponent({ name: 'MockDoughnut' })
    const colors = chart.props('data').datasets[0].backgroundColor
    const swatches = wrapper.get('[aria-label="Ecosystem distribution legend"]')
      .findAll('li [aria-hidden="true"]').map(swatch => swatch.element.style.backgroundColor)

    expect(colors).toHaveLength(32)
    expect(new Set(colors).size).toBe(32)
    expect(swatches).toEqual(colors.map(normalizeCssColor))
    expect(new Set(swatches).size).toBe(32)
  })

  it('shows one case-insensitive component row with all known ecosystems and its full count', async () => {
    const { wrapper } = mountReport(createService({ data: ref(payload([
      issue('RHAI-PILLOW-1', ['ecosystem:pypi'], 'pillow'),
      issue('RHAI-PILLOW-2', [], 'PILLOW'),
      issue('RHAI-PILLOW-3', ['ecosystem:Unknown'], 'Pillow'),
      issue('RHAI-PILLOW-4', ['ecosystem:rpm'], 'pillow'),
      issue('RHAI-GO-1', ['ecosystem:golang'], 'golang; example.org/lib'),
      issue('RHAI-GO-2', [], 'EXAMPLE.ORG/LIB'),
      issue('RHAI-MISSING', ['ecosystem:ruby'], null)
    ])) }))

    expect(wrapper.findAll('tbody tr').map(row => row.findAll('td').map(cell => cell.text()))).toEqual([
      ['pillow', 'pypi, rpm', '4'],
      ['example.org/lib', 'golang', '2']
    ])
    const selector = wrapper.get('select')
    expect(selector.text()).not.toContain('Unknown')
    expect(selector.text()).not.toContain('ruby')
    const originalChart = wrapper.findComponent({ name: 'MockDoughnut' }).props('data')
    await selector.setValue('rpm')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody tr').text()).toContain('4')
    const jql = new URL(wrapper.get('tbody a').attributes('href')).searchParams.get('jql')
    expect(jql).not.toContain('labels = "ecosystem:')
    expect(wrapper.findComponent({ name: 'MockDoughnut' }).props('data')).toEqual(originalChart)
  })

  it('shows loading state while the sustaining snapshot is being fetched', () => {
    const service = createService({ loading: ref(true), data: ref(null) })
    const { wrapper } = mountReport(service)

    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('Loading CVE upstream component data')
    expect(service.loadData).toHaveBeenCalledOnce()
  })

  it('treats an initial 404 as no cache and offers a Jira refresh', async () => {
    const actual = await vi.importActual('../../client/reports/composables/useCveSustaining.js')
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(useCveSustaining).mockImplementation(actual.useCveSustaining)
    const wrapper = mount(CveUpstreamComponentsReport, {
      global: { provide: { moduleNav: { navigateTo: vi.fn() } } }
    })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/modules/releases/cve-sustaining')
    expect(wrapper.text()).toContain('No CVE data yet')
    expect(wrapper.text()).toContain('Refresh from Jira to load CVE data')
    expect(wrapper.text()).not.toContain('Failed to load')
    wrapper.unmount()
  })

  it('prompts a legacy cache to refresh instead of rendering unavailable fields as Unknown', () => {
    const oldCache = {
      lastRefreshed: '2026-10-30T12:00:00.000Z',
      openIssueRecords: [issue('RHAI-OLD', [], 'not-reliable')]
    }
    const { wrapper } = mountReport(createService({ data: ref(oldCache) }))

    expect(wrapper.text()).toContain('Refresh from Jira to load upstream component details')
    expect(wrapper.text()).not.toContain('No upstream component is available')
    expect(wrapper.find('tbody').exists()).toBe(false)
  })

  it('shows a genuine zero state for a refreshed snapshot with no open tickets', () => {
    const { wrapper } = mountReport(createService({ data: ref(payload([])) }))

    expect(wrapper.text()).toContain('No open CVE upstream components')
    expect(wrapper.get('[aria-label="Ecosystem distribution legend"]').text()).toContain('No open tickets')
    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Refresh from Jira to load upstream component details')
  })

  it('shows a load error and a refresh action when the snapshot request fails', () => {
    const { wrapper } = mountReport(createService({ data: ref(null), error: ref('Failed to load CVE data: Service Unavailable') }))

    expect(wrapper.get('[role="alert"]').text()).toContain('Failed to load CVE data: Service Unavailable')
    expect(wrapper.text()).toContain('Try refreshing from Jira')
  })

  it('retains rows and ecosystem selection when refresh fails', async () => {
    const service = createService()
    service.refresh.mockImplementation(() => {
      service.refreshError.value = 'Refresh failed: Jira is unavailable'
    })
    const { wrapper } = mountReport(service)
    await wrapper.get('select').setValue('pypi')
    await wrapper.get('button[aria-label="Refresh from Jira"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Refresh failed: Jira is unavailable')
    expect(wrapper.get('select').element.value).toBe('pypi')
    expect(wrapper.findAll('tbody tr').map(row => row.text())).toEqual([
      expect.stringContaining('fickling'),
      expect.stringContaining('other-package'),
      expect.stringContaining('shared-package')
    ])
  })

  it('resets a removed ecosystem selection to All after refreshed metadata changes', async () => {
    const service = createService()
    const { wrapper } = mountReport(service)
    await wrapper.get('select').setValue('pypi')
    service.data.value = payload([
      issue('RHAI-9', ['ecosystem:golang'], 'new-package')
    ])
    await flushPromises()

    expect(wrapper.get('select').element.value).toBe('')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('new-package')
  })

  it('navigates back to the Releases Reports view and cleans up on unmount', () => {
    const { wrapper, service, navigateTo } = mountReport()

    wrapper.get('button[aria-label="Back to Reports"]').trigger('click')
    expect(navigateTo).toHaveBeenCalledWith('reports')

    wrapper.unmount()
    expect(service.cleanup).toHaveBeenCalledOnce()
  })
})

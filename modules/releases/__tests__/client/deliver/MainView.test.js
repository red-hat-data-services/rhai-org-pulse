import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, reactive } from 'vue'
import MainView from '../../../client/deliver/views/MainView.vue'

const mockApiRequest = vi.fn()

vi.mock('@shared/client/services/api', () => ({
  apiRequest: (...args) => mockApiRequest(...args),
  SESSION_CACHE_PREFIX: 'tt_cache:session:'
}))

const minimalAnalysis = {
  generatedAt: new Date().toISOString(),
  baselineDays: 180,
  capacityMode: 'p90',
  releases: [],
  riskThresholds: { issuesPerDayGreenMax: 1, issuesPerDayYellowMax: 10 }
}

const mockReleases = [
  {
    releaseNumber: 'rhelai-9.9',
    productName: 'Example product',
    dueDate: '2030-06-01',
    daysRemaining: 400,
    risk: 'green',
    totals: { issues_to_do: 2, issues_doing: 1, issues_done: 3 },
    teams: {
      PROJ: {
        projectKey: 'PROJ',
        issues_to_do: 2,
        issues_doing: 1,
        issues_done: 3,
        risk: 'green',
        to_do: 1,
        doing: 1,
        done: 1,
        remaining: 2,
        total: 5
      }
    },
    issues: []
  }
]

function createMockFilter(releases = []) {
  return {
    filteredReleases: computed(() => releases),
    selectedProducts: reactive(new Set()),
    selectedVersions: reactive(new Set()),
    allProducts: computed(() => []),
    allVersions: computed(() => []),
    visibleProducts: computed(() => []),
    visibleVersions: computed(() => []),
    toggleProduct: vi.fn(),
    toggleVersion: vi.fn(),
    clearProducts: vi.fn(),
    clearVersions: vi.fn(),
    resetFilters: vi.fn()
  }
}

function createMockAnalysisState(overrides = {}) {
  return {
    loading: ref(false),
    refreshing: ref(false),
    error: ref(''),
    analysis: ref(minimalAnalysis),
    refreshAnalysis: vi.fn(),
    ...overrides
  }
}

function seedPortfolioConfig(releases) {
  const releaseNumbers = releases.map(function (r) { return r.releaseNumber })
  while (releaseNumbers.length < 3) releaseNumbers.push('placeholder-' + releaseNumbers.length)
  const config = {
    portfolioReleases: [{
      id: 'pf-test',
      name: 'Test Portfolio',
      releases: releaseNumbers.slice(0, 3),
      codeFreezeDate: null,
      dueDate: null,
      enabled: true
    }]
  }
  sessionStorage.setItem('tt_cache:session:risk-dashboard-config:v1', JSON.stringify({
    data: config,
    _cachedAt: Date.now()
  }))
}

function mountView(releases = [], analysisOverrides = {}) {
  if (releases.length) seedPortfolioConfig(releases)
  const mockFilter = createMockFilter(releases)
  const mockAnalysis = createMockAnalysisState(analysisOverrides)
  return mount(MainView, {
    global: {
      provide: {
        releaseFilter: mockFilter,
        analysisState: mockAnalysis
      }
    }
  })
}

describe('MainView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  })

  it('renders the module title', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Release Analysis')
  })

  it('shows error state from injected analysisState', async () => {
    const wrapper = mountView([], { error: ref('Jira unavailable') })
    await flushPromises()
    expect(wrapper.text()).toContain('Jira unavailable')
  })

  it('renders release data from filtered releases', async () => {
    const wrapper = mountView(mockReleases)
    await flushPromises()
    expect(wrapper.text()).toContain('rhelai-9.9')
    expect(wrapper.text()).toContain('Example product')
    expect(wrapper.text()).toMatch(/6\s+issues in scope/)
  })

  it('shows empty state when no releases match filter', async () => {
    const wrapper = mountView([])
    await flushPromises()
    expect(wrapper.text()).toContain('No analysis data')
  })
})

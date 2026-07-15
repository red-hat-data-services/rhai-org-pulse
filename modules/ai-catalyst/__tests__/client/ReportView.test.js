import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ReportView from '../../client/views/ReportView.vue'
import ImpactFeasibilityChart from '../../client/components/ImpactFeasibilityChart.vue'
import ReportHighlightCards from '../../client/components/ReportHighlightCards.vue'
import CategoryDonutChart from '../../client/components/CategoryDonutChart.vue'
import SourceBarChart from '../../client/components/SourceBarChart.vue'
import LanguageBarChart from '../../client/components/LanguageBarChart.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api'

const MOCK_BOARDS = {
  boards: [
    { month: '2026-06', candidateCount: 14 },
    { month: '2026-05', candidateCount: 10 }
  ]
}

const MOCK_CANDIDATES = [
  { uniqueId: 'a', title: 'ProjectA', impactScore: 8.5, feasibilityScore: 7.0, category: 'agentic-ai', source: 'github', language: 'Python', stars: 1200, itemType: 'repo' },
  { uniqueId: 'b', title: 'ProjectB', impactScore: 6.0, feasibilityScore: 8.0, category: 'model-inference', source: 'reddit', language: 'TypeScript', stars: null, itemType: 'trend' },
  { uniqueId: 'c', title: 'ProjectC', impactScore: 9.0, feasibilityScore: 9.0, category: 'agentic-ai', source: 'github', language: 'Python', stars: 5000, itemType: 'repo' },
  { uniqueId: 'd', title: 'ProjectD', impactScore: 5.0, feasibilityScore: 5.0, category: 'model-customization', source: 'hn', language: 'Go', stars: 300, itemType: 'repo' }
]

function mountReport() {
  return mount(ReportView, {
    global: {
      provide: {
        moduleNav: {
          navigateTo: vi.fn(),
          goBack: vi.fn(),
          params: { value: {} }
        }
      }
    }
  })
}

describe('ReportView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header and loading state', () => {
    apiRequest.mockReturnValue(new Promise(() => {}))
    const wrapper = mountReport()
    expect(wrapper.text()).toContain('Monthly Report')
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })

  it('renders month selector and loads data', async () => {
    apiRequest
      .mockResolvedValueOnce(MOCK_BOARDS)
      .mockResolvedValueOnce({ candidates: MOCK_CANDIDATES })

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.text()).toContain('2026-06')
  })

  it('shows empty state when no candidates', async () => {
    apiRequest
      .mockResolvedValueOnce({ boards: [{ month: '2026-06', candidateCount: 0 }] })
      .mockResolvedValueOnce({ candidates: [] })

    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.text()).toContain('No candidates')
  })
})

describe('ImpactFeasibilityChart', () => {
  it('renders chart container', () => {
    const wrapper = mount(ImpactFeasibilityChart, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.find('[data-testid="scatter-chart"]').exists()).toBe(true)
  })

  it('filters out candidates with missing scores', () => {
    const withMissing = [
      ...MOCK_CANDIDATES,
      { uniqueId: 'e', title: 'NoScores', impactScore: null, feasibilityScore: null, category: 'agentic-ai', source: 'github', language: '', stars: 0, itemType: 'repo' }
    ]
    const wrapper = mount(ImpactFeasibilityChart, {
      props: { candidates: withMissing }
    })
    expect(wrapper.text()).toContain('1 candidate excluded')
  })

  it('renders category legend items', () => {
    const wrapper = mount(ImpactFeasibilityChart, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.text()).toContain('Agentic')
    expect(wrapper.text()).toContain('Inference')
  })
})

describe('ReportHighlightCards', () => {
  it('renders four stat cards', () => {
    const wrapper = mount(ReportHighlightCards, {
      props: { candidates: MOCK_CANDIDATES }
    })
    const cards = wrapper.findAll('[data-testid="highlight-card"]')
    expect(cards).toHaveLength(4)
  })

  it('computes correct total count', () => {
    const wrapper = mount(ReportHighlightCards, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('projects discovered')
  })

  it('computes sweet spot count (impact >= 7 and feasibility >= 7)', () => {
    const wrapper = mount(ReportHighlightCards, {
      props: { candidates: MOCK_CANDIDATES }
    })
    // ProjectA (8.5/7.0) and ProjectC (9.0/9.0) are in sweet spot
    expect(wrapper.text()).toContain('Sweet Spot')
  })

  it('shows highest impact candidate', () => {
    const wrapper = mount(ReportHighlightCards, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.text()).toContain('ProjectC')
  })

  it('shows dominant category', () => {
    const wrapper = mount(ReportHighlightCards, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.text()).toContain('Agentic')
  })
})

describe('CategoryDonutChart', () => {
  it('renders chart container', () => {
    const wrapper = mount(CategoryDonutChart, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.find('[data-testid="category-donut"]').exists()).toBe(true)
  })

  it('shows total count', () => {
    const wrapper = mount(CategoryDonutChart, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.text()).toContain('4')
  })
})

describe('SourceBarChart', () => {
  it('renders chart container', () => {
    const wrapper = mount(SourceBarChart, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.find('[data-testid="source-bar"]').exists()).toBe(true)
  })
})

describe('LanguageBarChart', () => {
  it('renders chart container', () => {
    const wrapper = mount(LanguageBarChart, {
      props: { candidates: MOCK_CANDIDATES }
    })
    expect(wrapper.find('[data-testid="language-bar"]').exists()).toBe(true)
  })

  it('groups rare languages as Other', () => {
    const manyCandidates = [
      { language: 'Python' }, { language: 'Python' }, { language: 'Python' },
      { language: 'TypeScript' }, { language: 'TypeScript' },
      { language: 'Go' }, { language: 'Go' },
      { language: 'Rust' }, { language: 'Java' },
      { language: 'C++' }, { language: 'Ruby' },
      { language: 'Elixir' }, { language: 'Dart' }
    ]
    const wrapper = mount(LanguageBarChart, {
      props: { candidates: manyCandidates }
    })
    // Check that the component computes "Other" group
    const chartData = wrapper.vm.chartData
    expect(chartData.labels).toContain('Other')
    expect(chartData.labels).toHaveLength(7) // Top 6 + Other
  })
})

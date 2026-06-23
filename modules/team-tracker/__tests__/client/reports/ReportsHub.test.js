import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import ReportsHub from '../../../client/reports/ReportsHub.vue'

vi.mock('@/platform-loader', () => ({
  loadAllocationStrategy: () => ({
    id: 'ai-eng-40-40-20',
    name: '40/40/20 Allocation',
    categories: []
  })
}))

// Mock dependencies
vi.mock('@shared/client/composables/useRoster', () => ({
  useRoster: () => ({
    orgs: ref([]),
    teams: ref([]),
    selectedOrgKey: ref(null),
    selectOrg: vi.fn(),
    loadRoster: vi.fn(),
  })
}))

const mockNavigateTo = vi.fn()
const mockParams = ref({})

describe('ReportsHub', () => {
  function createWrapper(params = {}) {
    mockParams.value = params
    mockNavigateTo.mockClear()
    return mount(ReportsHub, {
      global: {
        provide: {
          moduleNav: {
            navigateTo: mockNavigateTo,
            goBack: vi.fn(),
            params: readonly(mockParams),
            moduleSlug: readonly(ref('team-tracker')),
          }
        },
        stubs: {
          // Stub out async components that would fail to load in tests
          TrendsReport: { template: '<div data-testid="trends-report">Trends</div>' },
          TeamComparisonReport: { template: '<div>Comparison</div>' },
          AllocationReport: { template: '<div>Allocation</div>' },
        }
      }
    })
  }

  it('renders catalog with report cards when no report param', () => {
    const wrapper = createWrapper()
    const cards = wrapper.findAll('[data-testid="report-card"]')
    expect(cards.length).toBe(3)
  })

  it('shows catalog title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Reports')
    expect(wrapper.text()).toContain('Explore team metrics and trends')
  })

  it('calls navigateTo when a card is clicked', async () => {
    const wrapper = createWrapper()
    const cards = wrapper.findAll('[data-testid="report-card"]')
    await cards[0].trigger('click')
    expect(mockNavigateTo).toHaveBeenCalledWith('reports', { report: 'trends' })
  })

  it('renders report shell when report param is present', () => {
    const wrapper = createWrapper({ report: 'trends' })
    expect(wrapper.find('[data-testid="report-shell-back"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Productivity Trends')
  })

  it('renders catalog when report param does not match any report', () => {
    const wrapper = createWrapper({ report: 'nonexistent' })
    const cards = wrapper.findAll('[data-testid="report-card"]')
    expect(cards.length).toBe(3)
  })
})

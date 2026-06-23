import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import AllocationReport from '../../../client/reports/AllocationReport.vue'

const mockOrgs = ref([{ name: 'AI Platform' }, { name: 'Core' }])

vi.mock('../../../client/composables/useOrgRoster', () => ({
  useOrgRoster: () => ({
    orgs: mockOrgs,
    loadOrgs: vi.fn(),
  })
}))

vi.mock('../../../client/composables/useAllocationStrategy', () => ({
  useAllocationStrategy: () => ({
    categories: {
      value: [
        { key: 'tech-debt-quality', name: 'Tech Debt & Quality', color: 'amber', target: 40 },
        { key: 'new-features', name: 'New Features', color: 'blue', target: 40 },
        { key: 'learning-enablement', name: 'Learning & Enablement', color: 'green', target: 20 }
      ]
    }
  })
}))

const mockSummary = {
  totalPoints: 100,
  totalCount: 20,
  teamCount: 3,
  boardCount: 5,
  estimatedIssueCount: 15,
  unestimatedIssueCount: 5,
  buckets: {
    'tech-debt-quality': { points: 40, count: 8 },
    'new-features': { points: 40, count: 8 },
    'learning-enablement': { points: 20, count: 4 },
    'uncategorized': { points: 0, count: 0 },
  },
  teams: [
    {
      teamId: 't1',
      teamName: 'Model Serving',
      totalPoints: 50,
      totalCount: 10,
      boardCount: 2,
      percentages: { 'tech-debt-quality': 40, 'new-features': 40, 'learning-enablement': 20 },
      buckets: {
        'tech-debt-quality': { points: 20, count: 4 },
        'new-features': { points: 20, count: 4 },
        'learning-enablement': { points: 10, count: 2 },
        'uncategorized': { points: 0, count: 0 },
      },
    }
  ]
}

vi.mock('../../../client/services/allocation-api', () => ({
  getOrgAllocationSummary: vi.fn(async () => mockSummary),
  getGlobalAllocationSummary: vi.fn(async () => mockSummary),
}))

describe('AllocationReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createWrapper() {
    return mount(AllocationReport, {
      global: {
        provide: {
          moduleNav: {
            navigateTo: vi.fn(),
            goBack: vi.fn(),
            params: readonly(ref({})),
            moduleSlug: readonly(ref('team-tracker')),
          }
        },
        stubs: {
          AllocationBar: { template: '<div data-testid="allocation-bar">Bar</div>', props: ['buckets', 'totalPoints', 'totalCount', 'metricMode'] },
          AllocationTeamCard: { template: '<div data-testid="allocation-team-card" @click="$emit(\'click\')">{{ teamName }}</div>', props: ['teamName', 'totalPoints', 'totalCount', 'boardCount', 'percentages', 'buckets', 'metricMode'], emits: ['click'] },
          MetricToggle: { template: '<div data-testid="metric-toggle">Toggle</div>', props: ['modelValue'], emits: ['update:modelValue'] },
          OrgSelector: { template: '<div data-testid="org-selector">Orgs</div>', props: ['orgs', 'modelValue'], emits: ['select'] },
        }
      }
    })
  }

  it('fetches global summary on mount', async () => {
    const { getGlobalAllocationSummary } = await import('../../../client/services/allocation-api')
    createWrapper()
    await flushPromises()
    expect(getGlobalAllocationSummary).toHaveBeenCalled()
  })

  it('renders allocation bar when data is available', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('[data-testid="allocation-bar"]').exists()).toBe(true)
  })

  it('renders team cards', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const cards = wrapper.findAll('[data-testid="allocation-team-card"]')
    expect(cards.length).toBe(1)
    expect(cards[0].text()).toContain('Model Serving')
  })

  it('renders stat cards including estimated/unestimated', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Estimated')
    expect(text).toContain('Unestimated')
  })

  it('renders metric toggle', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('[data-testid="metric-toggle"]').exists()).toBe(true)
  })

  it('renders org selector when multiple orgs', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('[data-testid="org-selector"]').exists()).toBe(true)
  })
})

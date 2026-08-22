import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import AllocationReport from '../../../client/reports/AllocationReport.vue'

const mockOrgs = ref([{ name: 'AI Platform' }, { name: 'Core' }])

vi.mock('../../../client/composables/useOrgList', () => ({
  useOrgList: () => ({
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

const mockIsAdmin = ref(false)
vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({ isAdmin: mockIsAdmin })
}))

const mockTriggerRefresh = vi.fn()
vi.mock('../../../client/composables/useAllocationRefresh', () => ({
  useAllocationRefresh: () => ({
    refreshing: ref(false),
    message: ref(''),
    triggerRefresh: mockTriggerRefresh
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
    },
    {
      teamId: 't2',
      teamName: 'Data Science',
      totalPoints: 30,
      totalCount: 6,
      boardCount: 1,
      percentages: { 'tech-debt-quality': 40, 'new-features': 40, 'learning-enablement': 20 },
      buckets: {},
      allocationConfigured: false,
    },
    {
      teamId: 't3',
      teamName: 'Platform Infra',
      totalPoints: 20,
      totalCount: 4,
      boardCount: 2,
      percentages: { 'tech-debt-quality': 40, 'new-features': 40, 'learning-enablement': 20 },
      buckets: {},
      allocationConfigured: true,
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
    mockIsAdmin.value = false
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
          AllocationTeamCard: { template: '<div data-testid="allocation-team-card" @click="$emit(\'click\')"><span v-if="!configured" data-testid="allocation-unconfigured-badge">Not configured</span>{{ teamName }}</div>', props: ['teamName', 'totalPoints', 'totalCount', 'boardCount', 'percentages', 'buckets', 'metricMode', 'configured'], emits: ['click'] },
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
    expect(cards.length).toBe(3)
    expect(cards.map(c => c.text()).join(' ')).toContain('Model Serving')
  })

  it('blatantly calls out teams that have not configured allocation', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const callout = wrapper.find('[data-testid="allocation-unconfigured-callout"]')
    expect(callout.exists()).toBe(true)
    expect(callout.text()).toContain('1 of 3 teams')
    // The unconfigured team card carries a "Not configured" badge.
    expect(wrapper.find('[data-testid="allocation-unconfigured-badge"]').exists()).toBe(true)
  })

  it('sorts unconfigured teams first', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const cards = wrapper.findAll('[data-testid="allocation-team-card"]')
    expect(cards[0].text()).toContain('Data Science') // the unconfigured one
  })

  it('renders a team search box', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('[data-testid="team-search"]').exists()).toBe(true)
  })

  it('filters team cards by search query (case-insensitive)', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.find('[data-testid="team-search"]').setValue('data')
    const cards = wrapper.findAll('[data-testid="allocation-team-card"]')
    expect(cards.length).toBe(1)
    expect(cards[0].text()).toContain('Data Science')
  })

  it('shows a no-match message when the search matches nothing', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.find('[data-testid="team-search"]').setValue('zzz')
    expect(wrapper.findAll('[data-testid="allocation-team-card"]').length).toBe(0)
    expect(wrapper.text()).toContain('No teams match "zzz"')
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

  it('shows the refresh panel with a full-refresh button for admins when there is no data', async () => {
    const { getGlobalAllocationSummary } = await import('../../../client/services/allocation-api')
    getGlobalAllocationSummary.mockResolvedValueOnce({ totalPoints: 0, totalCount: 0, teams: [], boardCount: 0 })
    mockIsAdmin.value = true

    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[data-testid="allocation-refresh-panel"]').exists()).toBe(true)
    const btn = wrapper.get('[data-testid="allocation-refresh-button"]')
    await btn.trigger('click')
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1)
  })

  it('shows guidance without a refresh button for non-admins when there is no data', async () => {
    const { getGlobalAllocationSummary } = await import('../../../client/services/allocation-api')
    getGlobalAllocationSummary.mockResolvedValueOnce({ totalPoints: 0, totalCount: 0, teams: [], boardCount: 0 })
    mockIsAdmin.value = false

    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[data-testid="allocation-refresh-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="allocation-refresh-button"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('ask an admin')
  })
})

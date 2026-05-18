import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, readonly, nextTick } from 'vue'
import TrendsReport from '../../../client/reports/TrendsReport.vue'

const mockOrgs = ref([
  {
    key: 'org1',
    displayName: 'Org One',
    teams: {
      'Team A': {
        displayName: 'Team A',
        members: [
          { name: 'Alice', githubUsername: 'alice-gh', gitlabUsername: 'alice-gl' },
        ]
      }
    }
  }
])

vi.mock('@shared/client/composables/useRoster', () => ({
  useRoster: () => ({
    orgs: mockOrgs,
    teams: ref([]),
    selectedOrgKey: ref(null),
    selectOrg: vi.fn(),
    loadRoster: vi.fn(),
  })
}))

const mockTrendsData = {
  jira: {
    '2025-01': { resolved: 10, avgCycleTimeDays: 5, byOrg: {}, byTeam: {} },
    '2025-02': { resolved: 15, avgCycleTimeDays: 4, byOrg: {}, byTeam: {} },
  },
  github: { users: {} },
  gitlab: { users: {} },
}

vi.mock('@shared/client/services/api', () => ({
  getTrends: vi.fn(async (onData) => {
    onData(mockTrendsData)
  }),
}))

describe('TrendsReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createWrapper() {
    return mount(TrendsReport, {
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
          TrendChart: {
            template: '<div data-testid="trend-chart">{{ title }}</div>',
            props: ['labels', 'datasets', 'title', 'unit'],
          }
        }
      }
    })
  }

  it('renders 4 TrendChart components after loading', async () => {
    const wrapper = createWrapper()
    await nextTick()
    await nextTick()
    const charts = wrapper.findAll('[data-testid="trend-chart"]')
    expect(charts.length).toBe(4)
  })

  it('shows no data message when trends data is null', async () => {
    const { getTrends } = await import('@shared/client/services/api')
    getTrends.mockImplementationOnce(async (_onData) => {
      // Don't call onData -- simulate no data
    })
    const wrapper = createWrapper()
    await nextTick()
    await nextTick()
    expect(wrapper.text()).toContain('No trend data available')
  })

  it('renders chart titles correctly', async () => {
    const wrapper = createWrapper()
    await nextTick()
    await nextTick()
    const text = wrapper.text()
    expect(text).toContain('Issues Resolved')
    expect(text).toContain('GitHub Contributions')
    expect(text).toContain('GitLab Contributions')
    expect(text).toContain('Avg Cycle Time')
  })

  it('does not show mode toggle when only one org/team selected', async () => {
    const wrapper = createWrapper()
    await nextTick()
    await nextTick()
    // No orgs selected by default, so mode toggle should be hidden
    expect(wrapper.text()).not.toContain('Aggregate')
    expect(wrapper.text()).not.toContain('Compare')
  })
})

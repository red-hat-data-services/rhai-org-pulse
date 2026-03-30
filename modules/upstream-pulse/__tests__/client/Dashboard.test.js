import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Dashboard from '../../client/views/Dashboard.vue'

const mockDashboard = {
  summary: { trackedProjects: 12, activeContributors: 45, periodDays: 30, periodStart: '2026-03-01', periodEnd: '2026-03-30' },
  contributions: {
    commits: { total: 200, team: 80, teamPercent: 40 },
    pullRequests: { total: 150, team: 60, teamPercent: 40 },
    reviews: { total: 100, team: 30, teamPercent: 30 },
    issues: { total: 50, team: 10, teamPercent: 20 },
    all: { total: 500, team: 180, teamPercent: 36 },
  },
  trends: {
    contributions: { current: 180, previous: 150, changePercent: 20, direction: 'up' },
    activeContributors: { current: 45, previous: 40, changePercent: 12.5, direction: 'up' },
  },
  topContributors: [],
}

const mockContributors = {
  contributors: [
    { id: '1', name: 'Alice', githubUsername: 'alice', contributions: { commits: 20, prs: 10, reviews: 5, issues: 2, total: 37 } },
    { id: '2', name: 'Bob', githubUsername: 'bob', contributions: { commits: 15, prs: 8, reviews: 3, issues: 1, total: 27 } },
  ],
  count: 2,
  days: 30,
}

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn((path) => {
    if (path.includes('/dashboard')) return Promise.resolve(mockDashboard)
    if (path.includes('/contributors')) return Promise.resolve(mockContributors)
    if (path.includes('/leadership')) return Promise.resolve(null)
    return Promise.resolve({})
  }),
}))

describe('Upstream Pulse Dashboard', () => {
  let wrapper

  beforeEach(async () => {
    wrapper = mount(Dashboard, {
      global: {
        stubs: {
          StatCard: {
            template: '<div class="stat-card"><slot /></div>',
            props: ['label', 'value', 'trend', 'suffix', 'subValue', 'icon'],
          },
          ContributionTypeCard: {
            template: '<div class="contrib-card"><slot /></div>',
            props: ['label', 'icon', 'team', 'total', 'percent', 'color', 'bgColor', 'barColor'],
          },
        },
      },
    })
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()
  })

  it('renders the page title', () => {
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('renders the subtitle', () => {
    expect(wrapper.text()).toContain('open source impact')
  })

  it('renders period selector buttons', () => {
    expect(wrapper.text()).toContain('30d')
    expect(wrapper.text()).toContain('60d')
    expect(wrapper.text()).toContain('90d')
    expect(wrapper.text()).toContain('All')
  })
})

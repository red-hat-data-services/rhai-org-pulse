import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import TeamComparisonReport from '../../../client/reports/TeamComparisonReport.vue'

vi.mock('@shared/client/composables/useRoster', () => ({
  useRoster: () => ({
    orgs: ref([
      {
        key: 'org1',
        displayName: 'Org One',
        teams: {
          'Team A': {
            displayName: 'Team A',
            members: [{ name: 'Alice', githubUsername: 'alice-gh' }]
          }
        }
      }
    ]),
    teams: ref([]),
    selectedOrgKey: ref(null),
    selectOrg: vi.fn(),
    loadRoster: vi.fn(),
  })
}))

vi.mock('@shared/client/composables/useGithubStats', () => ({
  useGithubStats: () => ({
    getContributions: vi.fn(() => ({ totalContributions: 100 })),
    loadGithubStats: vi.fn(),
  })
}))

vi.mock('@shared/client/composables/useGitlabStats', () => ({
  useGitlabStats: () => ({
    getContributions: vi.fn(() => ({ totalContributions: 50 })),
    loadGitlabStats: vi.fn(),
  })
}))

vi.mock('@shared/client/services/api', () => ({
  getTeamMetrics: vi.fn(async () => ({
    memberCount: 5,
    aggregate: { resolvedCount: 20, avgCycleTimeDays: 3.5 }
  }))
}))

describe('TeamComparisonReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createWrapper() {
    return mount(TeamComparisonReport, {
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
          ReportChart: {
            template: '<div data-testid="report-chart">{{ title }}</div>',
            props: ['type', 'labels', 'data', 'title', 'unit'],
          }
        }
      }
    })
  }

  it('renders metric checkboxes', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Team Size')
    expect(wrapper.text()).toContain('Issues Resolved (90d)')
    expect(wrapper.text()).toContain('GitHub Contributions (1yr)')
  })

  it('renders chart type toggle', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Bar')
    expect(wrapper.text()).toContain('Horizontal')
    expect(wrapper.text()).toContain('Doughnut')
  })

  it('renders Run button', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Run')
  })

  it('shows empty state initially', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Select teams and metrics, then click Run')
  })

  it('Run button is disabled when no teams or metrics selected', () => {
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('button')
    const runButton = buttons.find(b => b.text().includes('Run'))
    expect(runButton.attributes('disabled')).toBeDefined()
  })
})

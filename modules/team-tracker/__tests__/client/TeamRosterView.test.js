import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import TeamRosterView from '../../client/views/TeamRosterView.vue'

// Mock all external dependencies
vi.mock('@shared/client/composables/useRoster', () => ({
  useRoster: () => ({
    teams: ref([
      {
        key: 'crobson::Model Serving',
        displayKey: 'AAET::Model Serving',
        displayName: 'Model Serving',
        org: 'AI Platform',
        members: [
          { name: 'Alice', jiraDisplayName: 'Alice', githubUsername: 'alice', gitlabUsername: 'alice' },
          { name: 'Bob', jiraDisplayName: 'Bob', githubUsername: 'bob', gitlabUsername: null },
        ]
      }
    ]),
    loading: ref(false),
    multiTeamMembers: ref(new Set()),
    getTeamsForPerson: () => ['Model Serving'],
    visibleFields: ref([]),
    primaryDisplayField: ref(null)
  })
}))

vi.mock('@shared/client/composables/useGitlabStats', () => ({
  useGitlabStats: () => ({
    loadGitlabStats: vi.fn(),
    getContributions: () => null
  })
}))

vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({ isAdmin: ref(false) })
}))

const mockLoadTeamDetail = vi.fn()
const mockLoadRfeConfig = vi.fn()

function setupMockLoadTeamDetail(data) {
  mockLoadTeamDetail.mockImplementation((_key, onData) => {
    if (onData) onData(data)
    return Promise.resolve(data)
  })
}

vi.mock('../../client/composables/useOrgRoster', () => ({
  useOrgRoster: () => ({
    loadTeamDetail: mockLoadTeamDetail,
    loadRfeConfig: mockLoadRfeConfig
  })
}))

vi.mock('@shared/client/services/api', () => ({
  refreshMetrics: vi.fn(),
  getTeamMetrics: vi.fn(),
  apiRequest: vi.fn().mockResolvedValue({})
}))

vi.mock('@shared/client/composables/useGithubStats', () => ({
  useGithubStats: () => ({ getContributions: () => null })
}))

vi.mock('../../client/composables/useViewPreference', () => ({
  useViewPreference: () => ({ viewPreference: ref('table') })
}))

vi.mock('@shared/client/composables/useModuleLink', () => ({
  useModuleLink: () => ({ linkTo: () => '#' })
}))

// Mock chart dependencies
vi.mock('vue-chartjs', () => ({
  Doughnut: { template: '<div></div>', props: ['data', 'options'] },
  Line: { template: '<div></div>', props: ['data', 'options'] }
}))
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  ArcElement: {}, Tooltip: {}, Legend: {},
  CategoryScale: {}, LinearScale: {}, PointElement: {}, LineElement: {}, Filler: {}, Title: {}
}))

function mountView(teamKey = 'AAET::Model Serving') {
  return mount(TeamRosterView, {
    global: {
      provide: {
        moduleNav: {
          params: ref({ teamKey }),
          goBack: vi.fn(),
          navigateTo: vi.fn()
        }
      }
    }
  })
}

describe('TeamRosterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockLoadTeamDetail({
      name: 'Model Serving',
      org: 'AI Platform',
      productManagers: ['Jane Doe'],
      engLeads: ['Alice B.'],
      boards: [{ url: 'https://jira.example.com/boards/123', name: 'MS Board' }],
      rfeCount: 5,
      rfeIssues: [],
      components: ['KServe'],
      headcount: { totalHeadcount: 10, byRole: { SE: 7, QE: 3 } }
    })
    mockLoadRfeConfig.mockResolvedValue({ jiraHost: 'https://redhat.atlassian.net' })
  })

  it('renders team header with name and member count', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Model Serving')
    expect(wrapper.text()).toContain('2 members')
  })

  it('shows enriched header details from org-teams', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('PM:')
    expect(wrapper.text()).toContain('Jane Doe')
    expect(wrapper.text()).toContain('Eng Lead:')
    expect(wrapper.text()).toContain('Alice B.')
    expect(wrapper.text()).toContain('5 open RFEs')
  })

  it('renders all 3 tabs', async () => {
    const wrapper = mountView()
    await flushPromises()
    const tabButtons = wrapper.findAll('nav button')
    const tabLabels = tabButtons.map(b => b.text())
    expect(tabLabels).toContain('Overview')
    expect(tabLabels).toContain('Delivery')
    expect(tabLabels).toContain('RFE Backlog')
  })

  it('always shows all 3 tabs', async () => {
    const wrapper = mountView()
    await flushPromises()
    const tabLabels = wrapper.findAll('nav button').map(b => b.text())
    expect(tabLabels).toHaveLength(3)
  })

  it('switches tabs when tab buttons are clicked', async () => {
    const wrapper = mountView()
    await flushPromises()

    // Default tab is Delivery
    const overviewTab = wrapper.findAll('nav button').find(b => b.text() === 'Overview')
    await overviewTab.trigger('click')

    // Overview content should be visible
    expect(wrapper.text()).toContain('Team Members')
  })

  it('degrades gracefully when loadTeamDetail fails', async () => {
    mockLoadTeamDetail.mockImplementation((_key, _onData) => {
      return Promise.reject(new Error('Not found'))
    })
    const wrapper = mountView()
    await flushPromises()

    // Header still shows roster data
    expect(wrapper.text()).toContain('Model Serving')
    expect(wrapper.text()).toContain('2 members')

    // Enriched details not shown
    expect(wrapper.text()).not.toContain('PM:')
    expect(wrapper.text()).not.toContain('Eng Lead:')

    // RFE Backlog tab shows fallback
    const backlogTab = wrapper.findAll('nav button').find(b => b.text() === 'RFE Backlog')
    await backlogTab.trigger('click')
    expect(wrapper.text()).toContain('not yet available')
  })

  it('renders board links in header', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Board:')
    expect(wrapper.text()).toContain('MS Board')
    const boardLink = wrapper.find('a[target="_blank"]')
    expect(boardLink.attributes('href')).toContain('boards/123')
  })
})

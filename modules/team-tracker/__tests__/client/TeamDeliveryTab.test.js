import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import TeamDeliveryTab from '../../client/components/TeamDeliveryTab.vue'

// --- Mocks ---

const mockGhContributions = {}
vi.mock('@shared/client/composables/useGithubStats', () => ({
  useGithubStats: () => ({
    getContributions: (username) => mockGhContributions[username] || null
  })
}))

const mockGlContributions = {}
vi.mock('@shared/client/composables/useGitlabStats', () => ({
  useGitlabStats: () => ({
    getContributions: (username) => mockGlContributions[username] || null
  })
}))

vi.mock('@shared/client/composables/useRoster', () => ({
  useRoster: () => ({
    multiTeamMembers: ref(new Set()),
    getTeamsForPerson: () => ['Model Serving'],
    visibleFields: ref([]),
    primaryDisplayField: ref(null)
  })
}))

vi.mock('@shared/client/composables/useModuleLink', () => ({
  useModuleLink: () => ({ linkTo: () => '#' })
}))

const mockGetTeamSnapshots = vi.fn()
const mockGetPersonSnapshots = vi.fn()
vi.mock('@shared/client/services/api', () => ({
  getTeamSnapshots: (...args) => mockGetTeamSnapshots(...args),
  getPersonSnapshots: (...args) => mockGetPersonSnapshots(...args)
}))

// --- Test data ---

const team = {
  key: 'crobson::Model Serving',
  displayName: 'Model Serving',
  members: [
    { name: 'Alice Smith', jiraDisplayName: 'Alice Smith', githubUsername: 'alice-gh', gitlabUsername: 'alice-gl' },
    { name: 'Bob Jones', jiraDisplayName: 'Bob Jones', githubUsername: 'bob-gh', gitlabUsername: null },
    { name: 'Charlie Lee', jiraDisplayName: 'Charlie Lee', githubUsername: null, gitlabUsername: 'charlie-gl' },
  ]
}

const teamMetrics = {
  aggregate: {
    resolvedCount: 150,
    resolvedPoints: 320,
    inProgressCount: 12,
    avgCycleTimeDays: 4.2
  },
  members: [
    { jiraDisplayName: 'Alice Smith', metrics: { resolvedCount: 80, resolvedPoints: 160, avgCycleTimeDays: 3.1, inProgressCount: 5 } },
    { jiraDisplayName: 'Bob Jones', metrics: { resolvedCount: 70, resolvedPoints: 160, avgCycleTimeDays: 5.3, inProgressCount: 7 } },
  ],
  resolvedIssues: [{ key: 'PROJ-1', summary: 'Fix bug' }]
}

function mountTab(overrides = {}) {
  return mount(TeamDeliveryTab, {
    props: {
      team,
      teamMetrics,
      teamDisplayName: 'Model Serving',
      ...overrides
    }
  })
}

describe('TeamDeliveryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockGhContributions).forEach(k => delete mockGhContributions[k])
    Object.keys(mockGlContributions).forEach(k => delete mockGlContributions[k])
    mockGetTeamSnapshots.mockResolvedValue({ snapshots: [] })
    mockGetPersonSnapshots.mockResolvedValue({ snapshots: [] })
  })

  // --- 1. Metric cards ---
  describe('metric cards', () => {
    it('renders all 6 metric cards with correct values', () => {
      const wrapper = mountTab()
      expect(wrapper.text()).toContain('Issues Resolved')
      expect(wrapper.text()).toContain('150')
      expect(wrapper.text()).toContain('Story Points')
      expect(wrapper.text()).toContain('320')
      expect(wrapper.text()).toContain('In Progress')
      expect(wrapper.text()).toContain('12')
      expect(wrapper.text()).toContain('Avg Cycle Time')
      expect(wrapper.text()).toContain('4.2')
      expect(wrapper.text()).toContain('GitHub Contributions')
      expect(wrapper.text()).toContain('GitLab Contributions')
    })

    it('shows -- for null metrics', () => {
      const wrapper = mountTab({ teamMetrics: null })
      const text = wrapper.text()
      // All metric values should show placeholder
      expect(text).toContain('--')
    })
  })

  // --- 2. CSV export ---
  describe('CSV export', () => {
    it('generates CSV with correct headers and data', () => {
      let downloadedContent = null
      const origCreateObjectURL = URL.createObjectURL
      const origRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = vi.fn(() => 'blob:test')
      URL.revokeObjectURL = vi.fn()

      // Intercept Blob creation
      const OrigBlob = global.Blob
      global.Blob = class extends OrigBlob {
        constructor(parts, options) {
          super(parts, options)
          downloadedContent = parts[0]
        }
      }

      // Intercept anchor click
      const mockClick = vi.fn()
      const origCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          const el = origCreateElement(tag)
          el.click = mockClick
          return el
        }
        return origCreateElement(tag)
      })

      const wrapper = mountTab()
      const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export CSV'))
      exportBtn.trigger('click')

      expect(mockClick).toHaveBeenCalled()
      expect(downloadedContent).toBeTruthy()

      const lines = downloadedContent.split('\n')
      const headers = lines[0]
      expect(headers).toContain('"Name"')
      expect(headers).toContain('"Issues Resolved"')
      expect(headers).toContain('"Story Points"')
      expect(headers).toContain('"Avg Cycle Time (days)"')
      expect(headers).toContain('"GitHub Contributions (1yr)"')
      expect(headers).toContain('"GitLab Contributions (1yr)"')
      expect(headers).toContain('"Teams"')

      // 3 members + 1 header = 4 lines
      expect(lines).toHaveLength(4)
      expect(lines[1]).toContain('"Alice Smith"')
      expect(lines[1]).toContain('"80"')
      expect(lines[2]).toContain('"Bob Jones"')

      // Cleanup
      URL.createObjectURL = origCreateObjectURL
      URL.revokeObjectURL = origRevokeObjectURL
      global.Blob = OrigBlob
      document.createElement.mockRestore?.()
    })

    it('disables export button when teamMetrics is null', () => {
      const wrapper = mountTab({ teamMetrics: null })
      const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export CSV'))
      expect(exportBtn.attributes('disabled')).toBeDefined()
    })
  })

  // --- 3. Snapshot history modals ---
  describe('snapshot history', () => {
    it('opens team history modal on View History click', async () => {
      mockGetTeamSnapshots.mockResolvedValue({ snapshots: [{ date: '2025-06-01', data: {} }] })

      const wrapper = mountTab()
      const historyBtn = wrapper.findAll('button').find(b => b.text() === 'View History')
      await historyBtn.trigger('click')
      await flushPromises()

      expect(mockGetTeamSnapshots).toHaveBeenCalledWith('crobson::Model Serving')
      expect(wrapper.text()).toContain('Model Serving - Metric History')
    })

    it('opens person history modal from PersonTable view-history event', async () => {
      mockGetPersonSnapshots.mockResolvedValue({ snapshots: [{ date: '2025-06-01', data: {} }] })

      const wrapper = mountTab()
      // PersonTable emits view-history — find the component and emit directly
      const personTable = wrapper.findComponent({ name: 'PersonTable' })
      await personTable.vm.$emit('view-history', { jiraDisplayName: 'Alice Smith', name: 'Alice Smith' })
      await flushPromises()

      expect(mockGetPersonSnapshots).toHaveBeenCalledWith('crobson::Model Serving', 'Alice Smith')
      expect(wrapper.text()).toContain('Alice Smith - Metric History')
    })
  })

  // --- 4. GitHub/GitLab contribution totals ---
  describe('contribution totals', () => {
    it('computes GitHub total from all members with usernames', () => {
      mockGhContributions['alice-gh'] = { totalContributions: 200 }
      mockGhContributions['bob-gh'] = { totalContributions: 150 }
      // Charlie has no githubUsername — should not be counted

      const wrapper = mountTab()
      // Total: 200 + 150 = 350
      expect(wrapper.text()).toContain('350')
    })

    it('computes GitLab total from all members with usernames', () => {
      mockGlContributions['alice-gl'] = { totalContributions: 100 }
      mockGlContributions['charlie-gl'] = { totalContributions: 75 }
      // Bob has no gitlabUsername — should not be counted

      const wrapper = mountTab()
      // Total: 100 + 75 = 175
      expect(wrapper.text()).toContain('175')
    })

    it('shows configured count when not all members have GitLab usernames', () => {
      const wrapper = mountTab()
      // 2 out of 3 members have gitlabUsername (Alice + Charlie)
      expect(wrapper.text()).toContain('2/3 members configured')
    })

    it('shows "Last year" subtitle when all members have GitLab usernames', () => {
      const allGlTeam = {
        ...team,
        members: team.members.map(m => ({ ...m, gitlabUsername: m.gitlabUsername || `${m.name}-gl` }))
      }
      const wrapper = mountTab({ team: allGlTeam })
      // All 3 members have gitlabUsername — subtitle should be "Last year"
      const metricCards = wrapper.findAll('.grid > *')
      const gitlabCard = metricCards[5]
      expect(gitlabCard.text()).toContain('Last year')
    })

    it('returns 0 for GitHub total when no contributions data', () => {
      const wrapper = mountTab()
      expect(wrapper.text()).toContain('GitHub Contributions')
      // With no mock data, the total should be 0
      expect(wrapper.text()).toMatch(/GitHub Contributions\s*0/)
    })
  })

  // --- 5. Always shows PersonTable ---
  describe('person table', () => {
    it('shows PersonTable', () => {
      const wrapper = mountTab()
      expect(wrapper.findComponent({ name: 'PersonTable' }).exists()).toBe(true)
    })
  })

  // --- Deduplication ---
  describe('member deduplication', () => {
    it('deduplicates members by jiraDisplayName', () => {
      const dupeTeam = {
        ...team,
        members: [
          ...team.members,
          { name: 'Alice Smith', jiraDisplayName: 'Alice Smith', githubUsername: 'alice-gh', gitlabUsername: 'alice-gl' },
        ]
      }
      const wrapper = mountTab({ team: dupeTeam })
      // Should still show 3 unique members, not 4
      const personTable = wrapper.findComponent({ name: 'PersonTable' })
      expect(personTable.props('members')).toHaveLength(3)
    })
  })
})

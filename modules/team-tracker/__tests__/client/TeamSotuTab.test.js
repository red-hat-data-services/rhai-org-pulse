import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import TeamSotuTab from '../../client/components/TeamSotuTab.vue'

const mockNavigateTo = vi.fn()

vi.mock('@shared/client/composables/useModuleLink', () => ({
  useModuleLink: () => ({
    navigateTo: mockNavigateTo,
    linkTo: vi.fn()
  })
}))

const mockUser = ref({ email: 'jsmith@redhat.com', isManager: false })
const mockIsManager = computed(() => mockUser.value?.isManager === true)

vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isManager: mockIsManager,
    isAdmin: ref(false)
  })
}))

const mockUserUid = ref('jsmith')

vi.mock('@shared/client/composables/usePermissions', () => ({
  usePermissions: () => ({
    userUid: mockUserUid,
    loading: ref(false)
  })
}))

const mockRosterData = ref(null)
const mockRosterLoading = ref(false)

vi.mock('@shared/client/composables/useRoster', () => ({
  useRoster: () => ({
    rosterData: mockRosterData,
    loading: mockRosterLoading,
    loadRoster: vi.fn()
  })
}))

const mockDefinitions = ref({ personFields: [], teamFields: [] })
const mockDefsLoading = ref(false)

vi.mock('@shared/client/composables/useFieldDefinitions', () => ({
  useFieldDefinitions: () => ({
    definitions: mockDefinitions,
    loading: mockDefsLoading,
    fetchDefinitions: vi.fn()
  })
}))

const mockManagedTeams = ref([])
const mockManagerLoading = ref(false)
const mockManagerError = ref(null)
const mockIncludeIndirect = ref(false)
const mockLoadManagerDashboard = vi.fn(() => Promise.resolve())

vi.mock('../../client/composables/useManagerDashboard', () => ({
  useManagerDashboard: () => ({
    teams: mockManagedTeams,
    loading: mockManagerLoading,
    error: mockManagerError,
    includeIndirect: mockIncludeIndirect,
    load: mockLoadManagerDashboard
  })
}))

function makeRosterData(orgTeams) {
  // orgTeams: [{ orgKey, teams: { TeamName: { displayName, members, metadata } } }]
  return {
    orgs: orgTeams.map(o => ({
      key: o.orgKey,
      displayName: o.orgKey,
      teams: o.teams
    }))
  }
}

function makeFieldDefs({ personFields = [], teamFields = [] } = {}) {
  return { personFields, teamFields }
}

beforeEach(() => {
  mockUser.value = { email: 'jsmith@redhat.com', isManager: false }
  mockUserUid.value = 'jsmith'
  mockRosterData.value = null
  mockRosterLoading.value = false
  mockDefinitions.value = { personFields: [], teamFields: [] }
  mockDefsLoading.value = false
  mockManagedTeams.value = []
  mockManagerLoading.value = false
  mockManagerError.value = null
  mockIncludeIndirect.value = false
  mockNavigateTo.mockClear()
  mockLoadManagerDashboard.mockClear()
  mockLoadManagerDashboard.mockImplementation(() => Promise.resolve())
})

describe('TeamSotuTab', () => {
  it('shows loading skeleton while data loads', () => {
    mockRosterLoading.value = true
    const wrapper = mount(TeamSotuTab)
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  describe('team member view (non-manager)', () => {
    it('renders cards for teams the user belongs to', async () => {
      mockRosterData.value = makeRosterData([{
        orgKey: 'org',
        teams: {
          TeamA: { displayName: 'Team A', members: [{ uid: 'jsmith', email: 'jsmith@redhat.com', name: 'Jane Smith', customFields: {} }], metadata: {} },
          TeamB: { displayName: 'Team B', members: [{ uid: 'other', email: 'other@redhat.com', name: 'Other', customFields: {} }], metadata: {} }
        }
      }])

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      const buttons = wrapper.findAll('button')
      const teamCards = buttons.filter(b => b.text().includes('Team A'))
      expect(teamCards.length).toBe(1)
      // Should not show Team B (user is not a member)
      expect(wrapper.text()).not.toContain('Team B')
    })

    it('shows empty state when user has no teams', async () => {
      mockRosterData.value = makeRosterData([{
        orgKey: 'org',
        teams: {
          TeamB: { displayName: 'Team B', members: [{ uid: 'other', email: 'other@redhat.com', name: 'Other', customFields: {} }], metadata: {} }
        }
      }])

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      expect(wrapper.text()).toContain('You are not assigned to any teams')
    })

    it('shows Engineering Speciality from primary display field', async () => {
      mockDefinitions.value = makeFieldDefs({
        personFields: [{ id: 'field_spec', label: 'Speciality', primaryDisplay: true, deleted: false }]
      })
      mockRosterData.value = makeRosterData([{
        orgKey: 'org',
        teams: {
          TeamA: { displayName: 'Team A', members: [{ uid: 'jsmith', email: 'jsmith@redhat.com', name: 'Jane Smith', customFields: { field_spec: 'Backend Engineer' } }], metadata: {} }
        }
      }])

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      expect(wrapper.text()).toContain('Speciality')
      expect(wrapper.text()).toContain('Backend Engineer')
    })

    it('shows team components from metadata', async () => {
      mockDefinitions.value = makeFieldDefs({
        teamFields: [{ id: 'field_comp', label: 'Component', optionsRef: 'component', deleted: false }]
      })
      mockRosterData.value = makeRosterData([{
        orgKey: 'org',
        teams: {
          TeamA: { displayName: 'Team A', members: [{ uid: 'jsmith', email: 'jsmith@redhat.com', name: 'Jane Smith', customFields: {} }], metadata: { field_comp: ['Model Serving', 'LLM-D'] } }
        }
      }])

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      expect(wrapper.text()).toContain('Model Serving')
      expect(wrapper.text()).toContain('LLM-D')
    })

    it('navigates to team-detail with from=sotu on card click', async () => {
      mockRosterData.value = makeRosterData([{
        orgKey: 'org',
        teams: {
          TeamA: { displayName: 'Team A', members: [{ uid: 'jsmith', email: 'jsmith@redhat.com', name: 'Jane Smith', customFields: {} }], metadata: {} }
        }
      }])

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      const card = wrapper.findAll('button').find(b => b.text().includes('Team A'))
      await card.trigger('click')

      expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'team-detail', { teamKey: 'org::TeamA', from: 'sotu' })
    })

    it('matches user by email when uid is not available', async () => {
      mockUserUid.value = null
      mockRosterData.value = makeRosterData([{
        orgKey: 'org',
        teams: {
          TeamA: { displayName: 'Team A', members: [{ uid: 'jsmith', email: 'jsmith@redhat.com', name: 'Jane Smith', customFields: {} }], metadata: {} }
        }
      }])

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      expect(wrapper.text()).toContain('Team A')
    })
  })

  describe('manager view', () => {
    beforeEach(() => {
      mockUser.value = { email: 'manager@redhat.com', isManager: true }
      mockUserUid.value = 'mgr'
    })

    it('renders managed team cards', async () => {
      mockManagedTeams.value = [
        { id: 'team_1', name: 'Platform', orgKey: 'eng', directReportUids: ['a', 'b'], totalMemberCount: 5, metadata: {} }
      ]

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      expect(wrapper.text()).toContain('Managed Teams')
      expect(wrapper.text()).toContain('Platform')
      expect(wrapper.text()).toContain('2 direct reports')
      expect(wrapper.text()).toContain('5 total members')
    })

    it('renders My Teams link card', async () => {
      mockManagedTeams.value = []

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      expect(wrapper.text()).toContain('My Teams')
      expect(wrapper.text()).toContain('View your full manager dashboard')
    })

    it('navigates to manager-dashboard on My Teams click', async () => {
      mockManagedTeams.value = []

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      const myTeamsCard = wrapper.findAll('button').find(b => b.text().includes('View your full manager dashboard'))
      await myTeamsCard.trigger('click')

      expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'manager-dashboard', { from: 'sotu' })
    })

    it('navigates to team-detail on managed team card click', async () => {
      mockManagedTeams.value = [
        { id: 'team_1', name: 'Platform', orgKey: 'eng', directReportUids: ['a'], totalMemberCount: 3, metadata: {} }
      ]

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      const card = wrapper.findAll('button').find(b => b.text().includes('Platform'))
      await card.trigger('click')

      expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'team-detail', { teamKey: 'eng::Platform', from: 'sotu' })
    })

    it('shows error state when manager dashboard fails', async () => {
      mockLoadManagerDashboard.mockImplementation(() => Promise.reject(new Error('403')))

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      expect(wrapper.text()).toContain('Unable to load managed teams')
    })

    it('resets includeIndirect before loading', async () => {
      mockIncludeIndirect.value = true

      mount(TeamSotuTab)
      await flushPromises()

      expect(mockIncludeIndirect.value).toBe(false)
    })

    it('shows components on managed team cards', async () => {
      mockDefinitions.value = makeFieldDefs({
        teamFields: [{ id: 'field_comp', label: 'Component', optionsRef: 'component', deleted: false }]
      })
      mockManagedTeams.value = [
        { id: 'team_1', name: 'Platform', orgKey: 'eng', directReportUids: ['a'], totalMemberCount: 3, metadata: { field_comp: ['API', 'Auth'] } }
      ]

      const wrapper = mount(TeamSotuTab)
      await flushPromises()

      expect(wrapper.text()).toContain('API')
      expect(wrapper.text()).toContain('Auth')
    })
  })
})

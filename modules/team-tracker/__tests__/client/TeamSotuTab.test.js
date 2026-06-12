import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import ManagedTeamsWidget from '../../client/widgets/ManagedTeamsWidget.vue'
import MyTeamsWidget from '../../client/widgets/MyTeamsWidget.vue'
import QuickLinksWidget from '../../client/widgets/QuickLinksWidget.vue'

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

describe('ManagedTeamsWidget', () => {
  it('shows non-manager message for ICs', async () => {
    const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).toContain('This widget is for managers')
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
      const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
      await flushPromises()
      expect(wrapper.text()).toContain('Managed Teams')
      expect(wrapper.text()).toContain('Platform')
      expect(wrapper.text()).toContain('2 direct reports')
      expect(wrapper.text()).toContain('5 total')
    })

    it('navigates to team-detail on card click', async () => {
      mockManagedTeams.value = [
        { id: 'team_1', name: 'Platform', orgKey: 'eng', directReportUids: ['a'], totalMemberCount: 3, metadata: {} }
      ]
      const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
      await flushPromises()
      const card = wrapper.findAll('button').find(b => b.text().includes('Platform'))
      await card.trigger('click')
      expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'team-detail', { teamKey: 'eng::Platform', from: 'sotu' })
    })

    it('shows error state when manager dashboard fails', async () => {
      mockLoadManagerDashboard.mockImplementation(() => Promise.reject(new Error('403')))
      const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
      await flushPromises()
      expect(wrapper.text()).toContain('Unable to load managed teams')
    })

    it('shows components on managed team cards', async () => {
      mockDefinitions.value = makeFieldDefs({
        teamFields: [{ id: 'field_comp', label: 'Component', optionsRef: 'component', deleted: false }]
      })
      mockManagedTeams.value = [
        { id: 'team_1', name: 'Platform', orgKey: 'eng', directReportUids: ['a'], totalMemberCount: 3, metadata: { field_comp: ['API', 'Auth'] } }
      ]
      const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
      await flushPromises()
      expect(wrapper.text()).toContain('API')
      expect(wrapper.text()).toContain('Auth')
    })
  })
})

describe('MyTeamsWidget', () => {
  it('shows empty state when user has no teams', async () => {
    mockRosterData.value = makeRosterData([{
      orgKey: 'org',
      teams: {
        TeamB: { displayName: 'Team B', members: [{ uid: 'other', email: 'other@redhat.com', name: 'Other', customFields: {} }], metadata: {} }
      }
    }])
    const wrapper = mount(MyTeamsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('You are not assigned to any teams')
  })

  it('renders cards for teams the user belongs to', async () => {
    mockRosterData.value = makeRosterData([{
      orgKey: 'org',
      teams: {
        TeamA: { displayName: 'Team A', members: [{ uid: 'jsmith', email: 'jsmith@redhat.com', name: 'Jane Smith', customFields: {} }], metadata: {} },
        TeamB: { displayName: 'Team B', members: [{ uid: 'other', email: 'other@redhat.com', name: 'Other', customFields: {} }], metadata: {} }
      }
    }])
    const wrapper = mount(MyTeamsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Team A')
    expect(wrapper.text()).not.toContain('Team B')
  })

  it('navigates to team-detail with from=sotu on card click', async () => {
    mockRosterData.value = makeRosterData([{
      orgKey: 'org',
      teams: {
        TeamA: { displayName: 'Team A', members: [{ uid: 'jsmith', email: 'jsmith@redhat.com', name: 'Jane Smith', customFields: {} }], metadata: {} }
      }
    }])
    const wrapper = mount(MyTeamsWidget, { props: { size: 'half' } })
    await flushPromises()
    const card = wrapper.findAll('button').find(b => b.text().includes('Team A'))
    await card.trigger('click')
    expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'team-detail', { teamKey: 'org::TeamA', from: 'sotu' })
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
    const wrapper = mount(MyTeamsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Speciality')
    expect(wrapper.text()).toContain('Backend Engineer')
  })
})

describe('QuickLinksWidget', () => {
  it('renders non-manager links for non-managers', () => {
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    expect(wrapper.text()).not.toContain('My Teams')
    expect(wrapper.text()).toContain('Team Directory')
    expect(wrapper.text()).toContain('People')
  })

  it('renders all links including My Teams for managers', () => {
    mockUser.value = { ...mockUser.value, isManager: true }
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    expect(wrapper.text()).toContain('My Teams')
    expect(wrapper.text()).toContain('Team Directory')
    expect(wrapper.text()).toContain('People')
  })

  it('navigates on link click (manager)', async () => {
    mockUser.value = { ...mockUser.value, isManager: true }
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    const myTeamsBtn = wrapper.findAll('button').find(b => b.text().includes('My Teams'))
    await myTeamsBtn.trigger('click')
    expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'manager-dashboard', { from: 'sotu' })
  })
})

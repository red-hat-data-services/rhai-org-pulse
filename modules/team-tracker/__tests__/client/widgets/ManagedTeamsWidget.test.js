import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import ManagedTeamsWidget from '../../../client/widgets/ManagedTeamsWidget.vue'

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

const mockDefinitions = ref({ personFields: [], teamFields: [] })
vi.mock('@shared/client/composables/useFieldDefinitions', () => ({
  useFieldDefinitions: () => ({
    definitions: mockDefinitions,
    loading: ref(false),
    fetchDefinitions: vi.fn()
  })
}))

const mockManagedTeams = ref([])
const mockManagerLoading = ref(false)
const mockIncludeIndirect = ref(false)
const mockLoadManagerDashboard = vi.fn(() => Promise.resolve())

vi.mock('../../../client/composables/useManagerDashboard', () => ({
  useManagerDashboard: () => ({
    teams: mockManagedTeams,
    loading: mockManagerLoading,
    error: ref(null),
    includeIndirect: mockIncludeIndirect,
    load: mockLoadManagerDashboard
  })
}))

beforeEach(() => {
  mockUser.value = { email: 'jsmith@redhat.com', isManager: false }
  mockDefinitions.value = { personFields: [], teamFields: [] }
  mockManagedTeams.value = []
  mockManagerLoading.value = false
  mockIncludeIndirect.value = false
  mockNavigateTo.mockClear()
  mockLoadManagerDashboard.mockClear()
  mockLoadManagerDashboard.mockImplementation(() => Promise.resolve())
})

describe('ManagedTeamsWidget', () => {
  it('mounts with size prop and renders header', async () => {
    const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Managed Teams')
  })

  it('accepts half size prop', async () => {
    const wrapper = mount(ManagedTeamsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Managed Teams')
  })

  it('shows non-manager message for ICs', async () => {
    const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).toContain('This widget is for managers')
  })

  describe('manager view', () => {
    beforeEach(() => {
      mockUser.value = { email: 'manager@redhat.com', isManager: true }
    })

    it('renders managed team cards', async () => {
      mockManagedTeams.value = [
        { id: 'team_1', name: 'Platform', orgKey: 'eng', directReportUids: ['a', 'b'], totalMemberCount: 5, metadata: {} }
      ]
      const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
      await flushPromises()
      expect(wrapper.text()).toContain('Platform')
      expect(wrapper.text()).toContain('2 direct reports')
      expect(wrapper.text()).toContain('5 total')
    })

    it('shows loading skeleton while loading', async () => {
      mockManagerLoading.value = true
      const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
      await flushPromises()
      expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
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

    it('shows empty state when no managed teams', async () => {
      mockManagedTeams.value = []
      const wrapper = mount(ManagedTeamsWidget, { props: { size: 'full' } })
      await flushPromises()
      expect(wrapper.text()).toContain('No managed teams found')
    })

    it('shows components on managed team cards', async () => {
      mockDefinitions.value = {
        personFields: [],
        teamFields: [{ id: 'field_comp', label: 'Component', optionsRef: 'component', deleted: false }]
      }
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

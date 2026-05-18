import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ManagerDashboardView from '../../client/views/ManagerDashboardView.vue'

// Mock the composable
const mockLoad = vi.fn()
const mockRefresh = vi.fn()
const mockManager = ref(null)
const mockDirectReports = ref([])
const mockIndirectReports = ref([])
const mockTeams = ref([])
const mockAllOrgTeams = ref([])
const mockReferencedPeople = ref({})
const mockFieldDefinitions = ref({ person: [], team: [] })
const mockLoading = ref(false)
const mockError = ref(null)
const mockReason = ref(null)
const mockIncludeIndirect = ref(false)

vi.mock('../../client/composables/useManagerDashboard', () => ({
  useManagerDashboard: () => ({
    manager: mockManager,
    directReports: mockDirectReports,
    indirectReports: mockIndirectReports,
    teams: mockTeams,
    allOrgTeams: mockAllOrgTeams,
    referencedPeople: mockReferencedPeople,
    fieldDefinitions: mockFieldDefinitions,
    loading: mockLoading,
    error: mockError,
    reason: mockReason,
    includeIndirect: mockIncludeIndirect,
    load: mockLoad,
    refresh: mockRefresh
  })
}))

// Mock useManagerTutorial
vi.mock('../../client/composables/useManagerTutorial', () => ({
  useManagerTutorial: () => ({
    showTutorial: ref(false),
    launchTutorial: vi.fn(),
    destroyTour: vi.fn(),
    checkFirstVisit: vi.fn(),
    resumeTourIfActive: vi.fn()
  })
}))

// Mock PersonFieldEditor
vi.mock('../../client/components/PersonFieldEditor.vue', () => ({
  default: {
    name: 'PersonFieldEditor',
    template: '<div class="person-field-editor" :data-uid="uid"></div>',
    props: ['uid', 'customFields', 'fieldDefinitions', 'canEdit', 'people'],
    emits: ['updated']
  }
}))

// Mock useFieldDefinitions (needed by PersonFieldEditor)
vi.mock('@shared/client/composables/useFieldDefinitions', () => ({
  useFieldDefinitions: () => ({
    demoToast: ref(null),
    updatePersonFields: vi.fn().mockResolvedValue({})
  })
}))

function mountView() {
  return mount(ManagerDashboardView, {
    global: {
      provide: {
        moduleNav: {
          navigateTo: vi.fn(),
          goBack: vi.fn(),
          params: ref({})
        }
      },
      stubs: {
        ExternalLink: { template: '<span class="external-link-icon" />' },
        ChevronDown: { template: '<span class="chevron-down-icon" />' },
        AlertTriangle: { template: '<span class="alert-triangle-icon" />' },
        CircleQuestionMark: { template: '<span />' },
        ConstrainedAutocomplete: { template: '<div />', props: ['modelValue', 'options', 'multiValue'] },
        PersonAutocomplete: { template: '<div />', props: ['modelValue', 'people'] }
      }
    }
  })
}

beforeEach(() => {
  mockManager.value = null
  mockDirectReports.value = []
  mockIndirectReports.value = []
  mockTeams.value = []
  mockAllOrgTeams.value = []
  mockReferencedPeople.value = {}
  mockFieldDefinitions.value = { person: [], team: [] }
  mockLoading.value = false
  mockError.value = null
  mockReason.value = null
  mockIncludeIndirect.value = false
  mockLoad.mockClear()
  mockRefresh.mockClear()
})

describe('ManagerDashboardView', () => {
  it('renders reports tab by default', async () => {
    mockDirectReports.value = [
      { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: ['team_a'], customFields: {} }
    ]
    mockTeams.value = [
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', directReportUids: ['alice'], totalMemberCount: 3, metadata: {}, boards: [] }
    ]

    const wrapper = mountView()
    await flushPromises()

    // Should show My Reports tab as active (default tab is 'reports')
    expect(wrapper.text()).toContain('My Reports')
    expect(wrapper.text()).toContain('Alice')
  })

  it('shows direct reports with editable fields in table view', async () => {
    mockDirectReports.value = [
      { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: 'backend' } }
    ]
    mockFieldDefinitions.value = {
      person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
      team: []
    }

    const wrapper = mountView()
    await flushPromises()

    // Default is table view — field values should be shown inline as column
    expect(wrapper.text()).toContain('Focus') // column header
    expect(wrapper.text()).toContain('backend') // field value
  })

  it('shows teams tab with team names in table', async () => {
    mockDirectReports.value = [
      { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: ['team_a'], customFields: {} }
    ]
    mockTeams.value = [
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', directReportUids: ['alice'], totalMemberCount: 5, metadata: {}, boards: [] }
    ]

    const wrapper = mountView()
    await flushPromises()

    // Switch to teams tab
    const teamsTab = wrapper.findAll('button').find(b => b.text().includes('My Teams'))
    await teamsTab.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Alpha')
  })

  it('handles reason "no-registry-identity" empty state', async () => {
    mockReason.value = 'no-registry-identity'

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('No Registry Identity')
    expect(wrapper.text()).toContain('not linked to the people registry')
  })

  it('handles reason "no-direct-reports" empty state', async () => {
    mockReason.value = 'no-direct-reports'

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('No Direct Reports')
    expect(wrapper.text()).toContain('no direct reports in the system')
  })

  it('navigates to person detail on name click', async () => {
    const navMock = { navigateTo: vi.fn(), goBack: vi.fn(), params: ref({}) }
    mockDirectReports.value = [
      { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: {} }
    ]

    const wrapper = mount(ManagerDashboardView, {
      global: {
        provide: { moduleNav: navMock },
        stubs: {
          ExternalLink: { template: '<span />' },
          ChevronDown: { template: '<span />' },
          PersonFieldEditor: { template: '<div />', props: ['uid', 'customFields', 'fieldDefinitions', 'canEdit', 'people'] }
        }
      }
    })
    await flushPromises()

    const nameButton = wrapper.findAll('button').find(b => b.text().includes('Alice'))
    await nameButton.trigger('click')

    expect(navMock.navigateTo).toHaveBeenCalledWith('person-detail', { uid: 'alice' })
  })

  it('navigates to team detail on team name click', async () => {
    const navMock = { navigateTo: vi.fn(), goBack: vi.fn(), params: ref({}) }
    mockDirectReports.value = [
      { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: ['team_a'], customFields: {} }
    ]
    mockTeams.value = [
      { id: 'team_a', name: 'Alpha', orgKey: 'org1', directReportUids: ['alice'], totalMemberCount: 3, metadata: {}, boards: [] }
    ]

    const wrapper = mount(ManagerDashboardView, {
      global: {
        provide: { moduleNav: navMock },
        stubs: {
          ExternalLink: { template: '<span />' },
          ChevronDown: { template: '<span />' },
          AlertTriangle: { template: '<span />' },
          PersonFieldEditor: { template: '<div />', props: ['uid', 'customFields', 'fieldDefinitions', 'canEdit', 'people'] }
        }
      }
    })
    await flushPromises()

    // Switch to teams tab
    const teamsTab = wrapper.findAll('button').find(b => b.text().includes('My Teams'))
    await teamsTab.trigger('click')
    await flushPromises()

    const teamButton = wrapper.findAll('button').find(b => b.text().includes('Alpha'))
    await teamButton.trigger('click')

    expect(navMock.navigateTo).toHaveBeenCalledWith('team-detail', { teamKey: 'org1::Alpha' })
  })

  // --- Field completeness warning tests ---

  describe('field completeness warnings', () => {
    it('shows banner when people have incomplete fields', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: '' } },
        { uid: 'bob', name: 'Bob', email: 'bob@example.com', title: 'Designer', teamIds: [], customFields: { field_f1: 'backend' } }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.text()).toContain('1 of 2 people have incomplete fields')
      expect(wrapper.text()).toContain('Show incomplete only')
    })

    it('does NOT show banner when all fields are complete', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: 'backend' } }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.text()).not.toContain('incomplete fields')
    })

    it('hides banner when dismissed', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: '' } }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.text()).toContain('incomplete fields')

      // Click dismiss button (the X button inside the banner)
      const dismissBtn = wrapper.findAll('button').find(b => b.find('.w-4.h-4').exists() && b.classes().some(c => c.includes('amber-500')))
      await dismissBtn.trigger('click')
      await nextTick()

      expect(wrapper.text()).not.toContain('incomplete fields')
    })

    it('keeps banner visible during bulk edit mode', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: '' } }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.text()).toContain('incomplete fields')

      // Enter bulk edit — banner should still be visible
      const editBtn = wrapper.findAll('button').find(b => b.text().includes('Edit All Fields'))
      await editBtn.trigger('click')
      await nextTick()

      expect(wrapper.text()).toContain('incomplete fields')
    })

    it('"Show incomplete only" filter works correctly', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: '' } },
        { uid: 'bob', name: 'Bob', email: 'bob@example.com', title: 'Designer', teamIds: [], customFields: { field_f1: 'backend' } }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      // Both visible initially
      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.text()).toContain('Bob')

      // Click "Show incomplete only"
      const filterBtn = wrapper.findAll('button').find(b => b.text().includes('Show incomplete only'))
      await filterBtn.trigger('click')
      await nextTick()

      // Only Alice (incomplete) should be visible
      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.text()).not.toContain('Bob')
    })

    it('banner count uses base list total, not filtered count', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: '' } },
        { uid: 'bob', name: 'Bob', email: 'bob@example.com', title: 'Designer', teamIds: [], customFields: { field_f1: 'backend' } },
        { uid: 'carol', name: 'Carol', email: 'carol@example.com', title: 'PM', teamIds: [], customFields: { field_f1: '' } }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      // "2 of 3" — uses visibleReports.length (3), not filteredReports
      expect(wrapper.text()).toContain('2 of 3 people have incomplete fields')
    })

    it('inline highlighting applied to empty cells', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: '' } }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      // The display-mode div for the empty field should have amber highlighting
      const cells = wrapper.findAll('td')
      const fieldCell = cells.find(td => td.text().includes('—') && td.find('.bg-red-100').exists())
      expect(fieldCell).toBeTruthy()
    })

    it('shows team tab banner when teams have incomplete fields', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: ['team_a'], customFields: {} }
      ]
      mockTeams.value = [
        { id: 'team_a', name: 'Alpha', orgKey: 'org1', directReportUids: ['alice'], totalMemberCount: 3, metadata: { field_t1: '' }, boards: [{ url: 'https://board.example.com/a' }] },
        { id: 'team_b', name: 'Beta', orgKey: 'org1', directReportUids: ['alice'], totalMemberCount: 2, metadata: { field_t1: 'value' }, boards: [{ url: 'https://board.example.com/b' }] }
      ]
      mockFieldDefinitions.value = {
        person: [],
        team: [{ id: 'field_t1', label: 'Status', type: 'free-text', visible: true, deleted: false }]
      }

      const wrapper = mountView()
      await flushPromises()

      // Switch to teams tab
      const teamsTab = wrapper.findAll('button').find(b => b.text().includes('My Teams'))
      await teamsTab.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('1 of 2 teams have incomplete fields')
    })

    it('isFieldEmpty handles all field types: null, undefined, empty string, empty array, multi-value all-falsy', async () => {
      mockDirectReports.value = [
        { uid: 'a', name: 'A', email: 'a@x.com', title: 'T', teamIds: [], customFields: { f1: null, f2: undefined, f3: '', f4: [], f5: ['', ''] } },
        { uid: 'b', name: 'B', email: 'b@x.com', title: 'T', teamIds: [], customFields: { f1: 'v', f2: 'v', f3: 'v', f4: ['v'], f5: ['v'] } }
      ]
      mockFieldDefinitions.value = {
        person: [
          { id: 'f1', label: 'F1', type: 'free-text', visible: true, deleted: false },
          { id: 'f2', label: 'F2', type: 'free-text', visible: true, deleted: false },
          { id: 'f3', label: 'F3', type: 'free-text', visible: true, deleted: false },
          { id: 'f4', label: 'F4', type: 'constrained', visible: true, deleted: false, multiValue: true, allowedValues: ['v'] },
          { id: 'f5', label: 'F5', type: 'constrained', visible: true, deleted: false, multiValue: true, allowedValues: ['v'] }
        ],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      // Person A has all empty fields, person B has all complete
      // Banner should show "1 of 2"
      expect(wrapper.text()).toContain('1 of 2 people have incomplete fields')
    })

    it('does not crash when customFields is undefined (newly-added person)', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: undefined }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      // Should not crash, and the person should be counted as incomplete
      expect(wrapper.text()).toContain('1 of 1 person has incomplete fields')
    })

    it('preserves incomplete filter when entering bulk edit', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: [], customFields: { field_f1: '' } },
        { uid: 'bob', name: 'Bob', email: 'bob@example.com', title: 'Designer', teamIds: [], customFields: { field_f1: 'backend' } }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      // Activate "show incomplete only"
      const filterBtn = wrapper.findAll('button').find(b => b.text().includes('Show incomplete only'))
      await filterBtn.trigger('click')
      await nextTick()

      // Only Alice visible
      expect(wrapper.text()).not.toContain('Bob')

      // Enter bulk edit — filter should be preserved, only Alice still visible
      const editBtn = wrapper.findAll('button').find(b => b.text().includes('Edit All Fields'))
      await editBtn.trigger('click')
      await nextTick()

      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.text()).not.toContain('Bob')
    })

    it('resets both filter and dismiss on tab switch', async () => {
      mockDirectReports.value = [
        { uid: 'alice', name: 'Alice', email: 'alice@example.com', title: 'Engineer', teamIds: ['team_a'], customFields: { field_f1: '' } }
      ]
      mockTeams.value = [
        { id: 'team_a', name: 'Alpha', orgKey: 'org1', directReportUids: ['alice'], totalMemberCount: 3, metadata: {}, boards: [] }
      ]
      mockFieldDefinitions.value = {
        person: [{ id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: false }],
        team: []
      }

      const wrapper = mountView()
      await flushPromises()

      // Dismiss the banner
      const dismissBtn = wrapper.findAll('button').find(b => b.classes().some(c => c.includes('amber-500')))
      await dismissBtn.trigger('click')
      await nextTick()

      expect(wrapper.text()).not.toContain('incomplete fields')

      // Switch to teams tab and back — banner should reappear
      const teamsTab = wrapper.findAll('button').find(b => b.text().includes('My Teams'))
      await teamsTab.trigger('click')
      await nextTick()

      const reportsTab = wrapper.findAll('button').find(b => b.text().includes('My Reports'))
      await reportsTab.trigger('click')
      await nextTick()

      expect(wrapper.text()).toContain('1 of 1 person has incomplete fields')
    })
  })
})

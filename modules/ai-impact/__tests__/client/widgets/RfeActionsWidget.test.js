import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import RfeActionsWidget from '../../../client/widgets/RfeActionsWidget.vue'

const mockNavigateTo = vi.fn()

vi.mock('@shared/client/composables/useModuleLink', () => ({
  useModuleLink: () => ({
    navigateTo: mockNavigateTo,
    linkTo: vi.fn()
  })
}))

const mockUser = ref({ email: 'test@redhat.com' })
vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isManager: ref(false),
    isAdmin: ref(false)
  })
}))

vi.mock('@shared/client/composables/useRoster', () => ({
  useRoster: () => ({
    rosterData: ref(null),
    loading: ref(false),
    loadRoster: vi.fn()
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

const mockRfeLoading = ref(false)
const mockRfeData = ref({ jiraHost: 'https://jira.example.com', fetchedAt: '2026-06-12T00:00:00Z' })
vi.mock('../../../client/composables/useAIImpact', () => ({
  useAIImpact: () => ({
    rfeData: mockRfeData,
    loading: mockRfeLoading,
    load: vi.fn()
  })
}))

const mockFeatureLoading = ref(false)
const mockFeatures = ref({})
vi.mock('../../../client/composables/useFeatures', () => ({
  useFeatures: () => ({
    features: mockFeatures,
    featureLoading: mockFeatureLoading,
    loadFeatures: vi.fn()
  })
}))

const mockAssessmentLoading = ref(false)
vi.mock('../../../client/composables/useAssessments', () => ({
  useAssessments: () => ({
    assessments: ref({}),
    assessmentLoading: mockAssessmentLoading,
    loadAssessments: vi.fn()
  })
}))

const mockWizardSeen = ref(true)
const mockMode = ref('auto')
const mockManualComponents = ref([])
const mockSetMode = vi.fn()
const mockSetManualComponents = vi.fn()
const mockMarkWizardSeen = vi.fn()
vi.mock('../../../client/composables/useForYouPreferences', () => ({
  useForYouPreferences: () => ({
    mode: mockMode,
    manualComponents: mockManualComponents,
    wizardSeen: mockWizardSeen,
    setMode: mockSetMode,
    setManualComponents: mockSetManualComponents,
    markWizardSeen: mockMarkWizardSeen
  }),
  sanitizeComponents: (stored, allowed) => stored.filter(s => allowed.includes(s))
}))

const mockActionNeeded = ref([])
const mockActionGroups = ref([])
const mockEverythingElse = ref([])
const mockStats = ref({ reviseRfes: 0, reviewFeatures: 0, queuedForStrat: 0, signedOffFeatures: 0, total: 0 })
const mockStageFilter = ref('')
const mockPriorityFilter = ref('')
const mockComponentFilter = ref('')
const mockAvailableItemComponents = ref([])
vi.mock('../../../client/composables/useForYou', () => ({
  useForYou: () => ({
    userComponents: ref([]),
    userDisplayName: ref(null),
    rosterResolutionState: ref('resolved'),
    actionNeeded: mockActionNeeded,
    actionGroups: mockActionGroups,
    everythingElse: mockEverythingElse,
    stats: mockStats,
    stageFilter: mockStageFilter,
    priorityFilter: mockPriorityFilter,
    componentFilter: mockComponentFilter,
    availableItemComponents: mockAvailableItemComponents,
    boardColumns: ref([])
  })
}))

// Stub child components
vi.mock('../../../client/components/ForYouWizard.vue', () => ({
  default: { template: '<div class="wizard-stub">Wizard</div>', props: ['availableComponents', 'componentsLoading'] }
}))
vi.mock('../../../client/components/ForYouSettings.vue', () => ({
  default: { template: '<div class="settings-stub">Settings</div>', props: ['mode', 'manualComponents', 'availableComponents', 'componentsLoading'] }
}))
vi.mock('../../../client/components/ForYouEmptyState.vue', () => ({
  default: { template: '<div class="empty-stub">Empty State</div>' }
}))
vi.mock('../../../client/components/ForYouActionsTab.vue', () => ({
  default: { template: '<div class="actions-tab-stub">Actions Tab</div>', props: ['actionNeeded', 'actionGroups', 'everythingElse', 'stats', 'stageFilter', 'priorityFilter', 'stageOptions', 'priorityOptions', 'componentFilter', 'availableItemComponents', 'jiraHost'] }
}))

beforeEach(() => {
  mockRfeLoading.value = false
  mockFeatureLoading.value = false
  mockAssessmentLoading.value = false
  mockWizardSeen.value = true
  mockMode.value = 'auto'
  mockManualComponents.value = []
  mockNavigateTo.mockClear()
})

describe('RfeActionsWidget', () => {
  it('mounts with size prop and renders header', async () => {
    const wrapper = mount(RfeActionsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).toContain('RFE Action Items')
  })

  it('accepts half size prop', async () => {
    const wrapper = mount(RfeActionsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('RFE Action Items')
  })

  it('shows loading skeleton when data is loading', async () => {
    mockRfeLoading.value = true
    const wrapper = mount(RfeActionsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows wizard when wizardSeen is false and not loading', async () => {
    mockWizardSeen.value = false
    const wrapper = mount(RfeActionsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.find('.wizard-stub').exists()).toBe(true)
  })

  it('hides wizard when wizardSeen is true', async () => {
    mockWizardSeen.value = true
    const wrapper = mount(RfeActionsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.find('.wizard-stub').exists()).toBe(false)
  })

  it('renders ForYouActionsTab when loaded', async () => {
    const wrapper = mount(RfeActionsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.find('.actions-tab-stub').exists()).toBe(true)
  })

  it('renders settings gear button', async () => {
    const wrapper = mount(RfeActionsWidget, { props: { size: 'full' } })
    await flushPromises()
    const settingsBtn = wrapper.find('button[title="Component settings"]')
    expect(settingsBtn.exists()).toBe(true)
  })

  it('toggles settings panel on gear click', async () => {
    const wrapper = mount(RfeActionsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.find('.settings-stub').exists()).toBe(false)
    const settingsBtn = wrapper.find('button[title="Component settings"]')
    await settingsBtn.trigger('click')
    expect(wrapper.find('.settings-stub').exists()).toBe(true)
  })

  it('shows sync timestamp in footer', async () => {
    const wrapper = mount(RfeActionsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).toContain('RFEs synced')
    expect(wrapper.text()).toContain('Features:')
  })
})
